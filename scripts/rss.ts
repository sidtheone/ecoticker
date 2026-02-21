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

// ─────────────────────────────────────────────────────────────────
// RSS FETCHER
// ─────────────────────────────────────────────────────────────────

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "EcoTicker/1.0" },
});

export async function fetchRssFeeds(): Promise<NewsArticle[]> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map((url) => parser.parseURL(url))
  );

  const articles: NewsArticle[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      const feed = result.value;
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
      }
    } else {
      console.error(
        `Failed to fetch RSS feed "${RSS_FEEDS[i]}":`,
        result.reason
      );
    }
  }

  return articles;
}
