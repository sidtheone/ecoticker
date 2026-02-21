import "dotenv/config";
import Parser from "rss-parser";

// ─────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────

const DEFAULT_FEEDS = [
  "https://www.theguardian.com/uk/environment/rss",
  "https://grist.org/feed/",
  "https://www.carbonbrief.org/feed/",
  "https://insideclimatenews.org/feed/",
  "https://www.eia.gov/rss/todayinenergy.xml",
  "https://www.eea.europa.eu/en/newsroom/rss-feeds/eeas-press-releases-rss",
  "https://www.ecowatch.com/feed",
  "https://feeds.npr.org/1025/rss.xml",
  "https://www.downtoearth.org.in/feed",
  "https://india.mongabay.com/feed/",
];

const RSS_FEEDS = (process.env.RSS_FEEDS || DEFAULT_FEEDS.join(","))
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface NewsArticle {
  title: string;
  url: string;
  source: { name: string };
  description: string | null;
  urlToImage: string | null;
  publishedAt: string;
}

export interface FeedHealth {
  name: string;       // feed.title for success, hostname for failures
  url: string;        // original feed URL
  status: "ok" | "error";
  articleCount: number; // 0 for failures
  durationMs: number;  // milliseconds elapsed for this feed
  error?: string;      // only present when status === "error"
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

export function feedHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ─────────────────────────────────────────────────────────────────
// RSS FETCHER
// ─────────────────────────────────────────────────────────────────

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "EcoTicker/1.0" },
});

export async function fetchRssFeeds(): Promise<{ articles: NewsArticle[]; feedHealth: FeedHealth[] }> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (url) => {
      const start = Date.now();
      try {
        const feed = await parser.parseURL(url);
        return { feed, durationMs: Date.now() - start, url };
      } catch (err) {
        throw { error: err, durationMs: Date.now() - start, url };
      }
    })
  );

  const articles: NewsArticle[] = [];
  const feedHealth: FeedHealth[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      const { feed, durationMs, url } = result.value;
      let articleCount = 0;
      for (const item of feed.items) {
        if (!item.title || !item.link) continue;
        const publishedAt = item.isoDate || item.pubDate;
        if (!publishedAt) {
          console.warn(
            `Skipping article "${item.title}" from "${feed.title || "Unknown"}": missing publication date`
          );
          continue;
        }
        articles.push({
          title: item.title,
          url: item.link,
          source: { name: feed.title || "Unknown" },
          description: item.contentSnippet || item.content || null,
          urlToImage: item.enclosure?.url || null,
          publishedAt,
        });
        articleCount++;
      }
      feedHealth.push({
        name: feed.title || feedHostname(url),
        url,
        status: "ok",
        articleCount,
        durationMs,
      });
    } else {
      const reason = result.reason as { error: unknown; durationMs: number; url: string };
      const url = reason.url || RSS_FEEDS[i];
      const durationMs = reason.durationMs || 0;
      const error = reason.error instanceof Error ? reason.error.message : String(reason.error);
      feedHealth.push({
        name: feedHostname(url),
        url,
        status: "error",
        articleCount: 0,
        durationMs,
        error,
      });
      console.error(
        `Failed to fetch RSS feed "${url}":`,
        reason.error
      );
    }
  }

  return { articles, feedHealth };
}
