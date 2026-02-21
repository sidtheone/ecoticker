import { NextRequest, NextResponse } from "next/server";
import Parser from "rss-parser";
import { db } from "@/db";
import { topics, articles, scoreHistory, topicKeywords } from "@/db/schema";
import slugify from "slugify";
import { requireAdminKey, getUnauthorizedResponse } from "@/lib/auth";
import { createErrorResponse } from "@/lib/errors";
import { logSuccess, logFailure } from "@/lib/audit-log";
import { sql } from "drizzle-orm";
import {
  validateScore,
  computeOverallScore,
  deriveUrgency,
  detectAnomaly,
} from "@/lib/scoring";

/**
 * Batch processing endpoint - fetches real news and updates database
 *
 * This endpoint replicates the functionality of scripts/batch.ts but works
 * in standalone Next.js builds without tsx dependencies.
 *
 * Requires environment variables:
 * - GNEWS_API_KEY: API key from gnews.io
 * - OPENROUTER_API_KEY: API key from openrouter.ai
 * - OPENROUTER_MODEL: (optional) defaults to meta-llama/llama-3.1-8b-instruct:free
 * - BATCH_KEYWORDS: (optional) comma-separated keywords, defaults to environmental topics
 * - ADMIN_API_KEY: Admin API key for authentication
 */

// --- Config ---
const GNEWS_API_KEY = process.env.GNEWS_API_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";
const KEYWORDS = (
  process.env.BATCH_KEYWORDS ||
  "climate change,pollution,deforestation,wildfire,flood"
).split(",");

// SYNC: BLOCKED_DOMAINS must match scripts/batch.ts — keep in sync until pipeline consolidation
// Domains known to publish Q&A/educational junk content (not real news).
// Articles from these domains are rejected before the LLM classifier runs.
const BLOCKED_DOMAINS = [
  "lifesciencesworld.com",
  "alltoc.com",
];

// SYNC: Few-shot examples must match scripts/batch.ts AND src/app/api/batch/route.ts
const FEW_SHOT_EXAMPLES = `
EXAMPLE 1 — Topic: "Community Recycling Initiative Launch"
Articles describe a new recycling program in a small town.
- healthLevel: MINIMAL, healthScore: 8
  Reasoning: No direct health effects. Theoretical waste reduction benefits are long-term and minor. Community participation is voluntary.
- ecoLevel: MINIMAL, ecoScore: 12
  Reasoning: Small-scale program with negligible immediate ecosystem impact. Diverts minimal waste from landfills. No measurable biodiversity or habitat effects.
- econLevel: MINIMAL, econScore: 5
  Reasoning: Minimal cost savings for the town. No job creation or economic disruption. Budget impact is trivial.

EXAMPLE 2 — Topic: "Delhi Air Quality Alert"
Articles report PM2.5 levels at 180 µg/m³, schools advising indoor activities.
- healthLevel: MODERATE, healthScore: 45
  Reasoning: Elevated particulate matter causes respiratory irritation, especially in children and elderly. Short-term exposure, reversible with air quality improvement. No mass casualties.
- ecoLevel: MODERATE, ecoScore: 28
  Reasoning: Urban air pollution has localized ecosystem effects (vegetation stress, reduced visibility). No ecosystem collapse or biodiversity loss.
- econLevel: MODERATE, econScore: 32
  Reasoning: Schools close for a few days, affecting some businesses. Healthcare costs rise slightly. Tourism unaffected long-term.

EXAMPLE 3 — Topic: "Great Barrier Reef Coral Bleaching"
Articles describe widespread bleaching affecting 80% of the reef due to marine heatwaves.
- healthLevel: MODERATE, healthScore: 28
  Reasoning: No direct human health effects. Indirect impacts on coastal communities (food security, mental health) are moderate.
- ecoLevel: SEVERE, ecoScore: 88
  Reasoning: 80% of the world's largest coral reef system affected. Repeated bleaching events prevent recovery. Cascading effects on marine biodiversity are well-documented.
- econLevel: SIGNIFICANT, econScore: 58
  Reasoning: Reef tourism generates $6.4B annually. Fisheries decline affects thousands of livelihoods. Recovery costs are enormous.

EXAMPLE 4 — Topic: "Fukushima Wastewater Release"
Articles describe Japan beginning release of treated radioactive wastewater into the Pacific.
- healthLevel: SIGNIFICANT, healthScore: 55
  Reasoning: Tritium and other radionuclides released into ocean. While diluted, long-term bioaccumulation risks are uncertain. Seafood contamination fears are widespread.
- ecoLevel: SEVERE, ecoScore: 78
  Reasoning: Unprecedented release of radioactive material into the Pacific over decades. Marine ecosystem effects are unknown and potentially irreversible. Sets a precedent for nuclear waste disposal.
- econLevel: SIGNIFICANT, econScore: 62
  Reasoning: China and South Korea ban Japanese seafood imports. Japanese fishing industry devastated. Regional trade disrupted.
`;

// --- Types ---
interface NewsArticle {
  title: string;
  url: string;
  source: { name: string };
  description: string | null;
  urlToImage: string | null;
  publishedAt: string;
}

interface GNewsArticle {
  title: string;
  url: string;
  source: { name: string; url: string };
  description: string | null;
  image: string | null;
  publishedAt: string;
}

interface Classification {
  articleIndex: number;
  topicName: string;
  isNew: boolean;
}

interface LLMScoreResponse {
  healthReasoning: string;
  healthLevel: string;
  healthScore: number;
  ecoReasoning: string;
  ecoLevel: string;
  ecoScore: number;
  econReasoning: string;
  econLevel: string;
  econScore: number;
  overallSummary: string;
  category: string;
  region: string;
  keywords: string[];
}

interface TopicScore {
  // From LLM (validated):
  healthReasoning: string;
  healthLevel: string;
  healthScore: number;
  ecoReasoning: string;
  ecoLevel: string;
  ecoScore: number;
  econReasoning: string;
  econLevel: string;
  econScore: number;
  overallSummary: string;
  category: string;
  region: string;
  keywords: string[];
  // Computed server-side:
  overallScore: number;
  urgency: string;
  anomalyDetected: boolean;
  rawLlmResponse: unknown;
  // Validation metadata:
  clampedDimensions: string[];
}

// SYNC: isBlockedDomain must match scripts/batch.ts — keep in sync until pipeline consolidation
/**
 * Returns true if the article URL belongs to a blocked domain.
 * Blocked domains are known sources of Q&A/educational junk — not real news.
 */
function isBlockedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BLOCKED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// --- GNews ---
async function fetchNews(): Promise<NewsArticle[]> {
  const allArticles: NewsArticle[] = [];

  // Batch keywords into groups — GNews supports OR syntax same as NewsAPI
  const keywordGroups: string[] = [];
  for (let i = 0; i < KEYWORDS.length; i += 4) {
    keywordGroups.push(KEYWORDS.slice(i, i + 4).join(" OR "));
  }

  for (const query of keywordGroups) {
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=10&sortby=publishedAt&token=${GNEWS_API_KEY}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const data = (await res.json()) as { articles?: GNewsArticle[]; errors?: string[] };

      if (data.errors && data.errors.length > 0) {
        const errMsg = data.errors[0];
        if (res.status === 401) {
          console.error(`GNews auth failure for "${query}": ${errMsg}`);
        } else if (res.status === 429) {
          console.error(`GNews rate limit for "${query}": ${errMsg}`);
        } else {
          console.error(`GNews error for "${query}": ${errMsg}`);
        }
        continue;
      }

      if (data.articles) {
        // Map GNews shape → NewsArticle interface, apply source filter
        const filteredArticles = data.articles
          .filter((a: GNewsArticle) => {
            const source = a.source?.name?.toLowerCase() || "";
            return (
              !source.includes("bringatrailer") &&
              !source.includes("auction") &&
              !source.includes("ebay") &&
              a.title &&
              a.description
            );
          })
          .map((a: GNewsArticle): NewsArticle => ({
            title: a.title,
            url: a.url,
            source: { name: a.source.name },
            description: a.description,
            urlToImage: a.image,
            publishedAt: a.publishedAt,
          }));
        allArticles.push(...filteredArticles);
      }
    } catch (err) {
      console.error(`Failed to fetch news for "${query}":`, err);
    }
  }

  // Deduplicate by URL and remove articles from blocked domains
  const seen = new Set<string>();
  const blocked: string[] = [];
  const deduped = allArticles.filter((a) => {
    if (!a.url || seen.has(a.url)) return false;
    if (isBlockedDomain(a.url)) {
      blocked.push(a.url);
      return false;
    }
    seen.add(a.url);
    return true;
  });
  if (blocked.length > 0) {
    console.log(`🚫 Blocked ${blocked.length} articles from junk domains: ${[...new Set(blocked.map((u) => new URL(u).hostname))].join(", ")}`);
  }
  return deduped;
}

// SYNC: copied from scripts/rss.ts — keep in sync until pipeline consolidation
// (Cannot import from scripts/ — Next.js standalone build excludes that directory)
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

// SYNC: mirrors scripts/rss.ts `parser` — renamed to `rssParser` to avoid collision with route-local vars
const rssParser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "EcoTicker/1.0" },
});

// SYNC: FeedHealth type must match scripts/rss.ts
interface FeedHealth {
  name: string;
  url: string;
  status: "ok" | "error";
  articleCount: number;
  durationMs: number;
  error?: string;
}

function feedHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// SYNC: copied from scripts/rss.ts — keep in sync until pipeline consolidation
async function fetchRssFeeds(): Promise<{ articles: NewsArticle[]; feedHealth: FeedHealth[] }> {
  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (url) => {
      const start = Date.now();
      try {
        const feed = await rssParser.parseURL(url);
        return { feed, durationMs: Date.now() - start, url };
      } catch (err) {
        throw { error: err, durationMs: Date.now() - start, url };
      }
    })
  );

  const rssArticles: NewsArticle[] = [];
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
        rssArticles.push({
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

  return { articles: rssArticles, feedHealth };
}

// --- OpenRouter LLM ---
async function callLLM(prompt: string, options?: { jsonMode?: boolean }): Promise<string> {
  const body: Record<string, unknown> = {
    model: OPENROUTER_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0, // US-1.0: greedy decoding for consistency
  };
  // US-1.0: enforce JSON output only for scoring calls (AC #2)
  if (options?.jsonMode) {
    body.response_format = { type: "json_object" };
  }
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(30000), // US-1.0: 30s standard timeout
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Safely parse a string into a JSONB-compatible value.
 * If the string is valid JSON, returns the parsed object.
 * If not, wraps it in an object so PostgreSQL JSONB accepts it.
 */
function safeJsonb(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return { raw: value, parseError: true };
  }
}

function extractJSON(text: string): unknown {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

// --- Pass 2: Scoring (US-1.0 Rubric-Based) ---

/**
 * Process raw LLM score response:
 * 1. Validate each dimension score (clamp to level range)
 * 2. Compute overall score (weighted average, excluding INSUFFICIENT_DATA)
 * 3. Derive urgency (from overall score)
 * 4. Detect anomalies (if previous scores provided)
 */
function processScoreResult(
  raw: LLMScoreResponse,
  rawJson: string,
  previousScores: { health: number; eco: number; econ: number } | null,
  topicName: string
): TopicScore {
  // Validate each dimension
  const healthValidated = validateScore(raw.healthLevel, raw.healthScore);
  const ecoValidated = validateScore(raw.ecoLevel, raw.ecoScore);
  const econValidated = validateScore(raw.econLevel, raw.econScore);

  const clampedDimensions: string[] = [];
  if (healthValidated.clamped) {
    console.warn(
      `Clamped health score for "${topicName}": ${raw.healthScore} → ${healthValidated.score} (${healthValidated.level})`
    );
    clampedDimensions.push("health");
  }
  if (ecoValidated.clamped) {
    console.warn(
      `Clamped eco score for "${topicName}": ${raw.ecoScore} → ${ecoValidated.score} (${ecoValidated.level})`
    );
    clampedDimensions.push("eco");
  }
  if (econValidated.clamped) {
    console.warn(
      `Clamped econ score for "${topicName}": ${raw.econScore} → ${econValidated.score} (${econValidated.level})`
    );
    clampedDimensions.push("econ");
  }

  // Compute overall score server-side
  const overallScore = computeOverallScore(
    healthValidated.score,
    ecoValidated.score,
    econValidated.score
  );

  // Derive urgency server-side
  const urgency = deriveUrgency(overallScore);

  // Detect anomalies (if previous scores exist)
  let anomalyDetected = false;
  if (previousScores) {
    const healthAnomaly = detectAnomaly(
      previousScores.health,
      healthValidated.score,
      topicName,
      "health"
    );
    const ecoAnomaly = detectAnomaly(previousScores.eco, ecoValidated.score, topicName, "eco");
    const econAnomaly = detectAnomaly(previousScores.econ, econValidated.score, topicName, "econ");
    anomalyDetected = healthAnomaly || ecoAnomaly || econAnomaly;
  }

  return {
    healthReasoning: raw.healthReasoning || "",
    healthLevel: healthValidated.level,
    healthScore: healthValidated.score,
    ecoReasoning: raw.ecoReasoning || "",
    ecoLevel: ecoValidated.level,
    ecoScore: ecoValidated.score,
    econReasoning: raw.econReasoning || "",
    econLevel: econValidated.level,
    econScore: econValidated.score,
    overallSummary: raw.overallSummary || "",
    category: raw.category || "climate",
    region: raw.region || "Global",
    keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
    overallScore,
    urgency,
    anomalyDetected,
    rawLlmResponse: safeJsonb(rawJson),
    clampedDimensions,
  };
}

// --- Pass 1: Classification ---
async function classifyArticles(
  newsArticles: NewsArticle[],
  existingTopics: { name: string; keywords: string[] }[]
): Promise<Classification[]> {
  const topicsList =
    existingTopics.map((t) => `- "${t.name}" (keywords: ${t.keywords.join(", ")})`).join("\n") ||
    "(none yet)";

  const titlesList = newsArticles.map((a, i) => `${i}. ${a.title}`).join("\n");

  // SYNC: classification prompt must match scripts/batch.ts
  const prompt = `You are an environmental news filter and classifier.

TASK 1 - FILTER: Identify which articles are about ENVIRONMENTAL topics.

✅ INCLUDE articles about:
- Climate impacts: heatwaves, floods, droughts, storms, sea level rise
- Biodiversity: species extinction, habitat loss, wildlife decline
- Pollution: air quality, water contamination, plastic, chemicals (PFAS, etc.)
- Oceans: coral bleaching, acidification, overfishing, marine pollution
- Forests: deforestation, wildfires, forest degradation
- Energy & emissions: fossil fuels, renewables, carbon emissions
- Environmental policy: regulations, treaties, climate action

❌ REJECT articles about:
- Celebrity/entertainment news
- Sports and games
- General politics (unless environmental policy)
- Business news (unless environmental impact)
- Technology (unless climate/environmental tech)
- Pet care, animal trivia, lifestyle
- Product reviews, shopping deals, promotions
- Q&A articles, FAQs, and "What is..." / "How does..." / "Why do..." educational content
- Evergreen/educational explainers with no specific date, event, or incident
- Listicles and trivia ("3 effects of...", "10 facts about...")
- Articles where the title is a question (strong signal of Q&A, not news)
- Research papers or academic studies (unless reporting on NEW findings with real-world impact)

🔍 NEWSWORTHINESS TEST — An article must pass ALL of these to be included:
1. Reports on a SPECIFIC recent event, incident, or development (not general knowledge)
2. Contains a date reference, named location, or specific actors/organizations
3. Is written as journalism (news report, investigation, analysis) — NOT as Q&A, FAQ, tutorial, or educational explainer
4. Title is a statement, not a question (questions indicate Q&A content)

TASK 2 - CLASSIFY: Group relevant environmental articles into topics.

Use existing topics where they match. Create new topic names only when no existing topic fits.
Each topic should be a clear environmental issue (e.g. "Amazon Deforestation", "Delhi Air Quality Crisis").

Existing topics:
${topicsList}

Articles to classify:
${titlesList}

Respond with ONLY valid JSON, no other text:
{
  "classifications": [{"articleIndex": 0, "topicName": "Topic Name", "isNew": false}, ...],
  "rejected": [1, 3, 5],
  "rejectionReasons": ["Celebrity news", "Pet care Q&A"]
}`;

  const response = await callLLM(prompt);

  const parsed = extractJSON(response) as {
    classifications?: Classification[];
    rejected?: number[];
    rejectionReasons?: string[];
  } | null;

  if (parsed?.classifications) {
    // Log rejection statistics
    if (parsed.rejected && parsed.rejected.length > 0) {
      console.log(`📋 Filtered ${parsed.rejected.length} irrelevant articles:`);
      parsed.rejectionReasons?.forEach((reason, i) => {
        const articleIdx = parsed.rejected![i];
        const article = newsArticles[articleIdx];
        if (article) {
          console.log(`   ❌ [${articleIdx}] "${article.title.length > 60 ? article.title.substring(0, 60) + "..." : article.title}" (${reason})`);
        }
      });
      const relevanceRate = newsArticles.length > 0
        ? ((newsArticles.length - parsed.rejected.length) / newsArticles.length * 100).toFixed(1)
        : "0.0";
      console.log(`✅ Relevance rate: ${relevanceRate}% (${newsArticles.length - parsed.rejected.length}/${newsArticles.length} articles)`);
    }
    return parsed.classifications;
  }

  console.error("Classification LLM failed to return valid JSON");
  console.error("LLM Response was:", response.substring(0, 1000));
  console.warn("Skipping these articles due to classification failure");
  return [];
}

async function scoreTopic(
  topicName: string,
  topicArticles: NewsArticle[],
  previousScores: { health: number; eco: number; econ: number } | null
): Promise<TopicScore> {
  const articleSummaries = topicArticles
    .map((a) => `- ${a.title}: ${a.description || "No description"}`)
    .join("\n");

  // SYNC: Scoring rubric prompt must match scripts/batch.ts AND src/app/api/batch/route.ts
  const prompt = `You are an environmental impact analyst scoring the severity of news events.
Analyze the following articles about "${topicName}".

Articles:
${articleSummaries}

## Scoring Rubric

For EACH of the three dimensions below, you MUST:
1. First, write 2-3 sentences of reasoning citing specific articles
2. Then, classify the severity level (MINIMAL / MODERATE / SIGNIFICANT / SEVERE)
3. Then, assign a numeric score within the level's range

### Severity Levels:
- MINIMAL (0-25): No measurable impact. Theoretical or negligible risk. Routine monitoring only.
- MODERATE (26-50): Localized, limited impact. Affects small population or confined area. Reversible.
- SIGNIFICANT (51-75): Widespread or serious impact. Large population or critical ecosystem affected. Difficult to reverse.
- SEVERE (76-100): Catastrophic, potentially irreversible. Mass casualties, ecosystem collapse, or economy-wide disruption.

### Dimensions:
1. **Health Impact**: Risk to human health and wellbeing — air/water quality, disease, food safety, physical harm, mortality
2. **Ecological Impact**: Damage to ecosystems and biodiversity — species loss, habitat destruction, deforestation, ocean/water/soil damage
3. **Economic Impact**: Financial and livelihood consequences — industry disruption, job losses, infrastructure damage, agricultural losses, cleanup costs

${FEW_SHOT_EXAMPLES}

## Anti-Bias Instructions
- Do NOT default to MODERATE. Use the full range of levels based on evidence.
- Base severity ONLY on what the articles describe, not on general knowledge about the topic.
- If the articles do not contain enough information to assess a dimension, use "INSUFFICIENT_DATA" as the level and -1 as the score.
- A new recycling program and a nuclear disaster should NOT receive similar scores.

## Response Format

Respond with ONLY valid JSON:
{
  "healthReasoning": "2-3 sentences citing specific articles",
  "healthLevel": "MODERATE",
  "healthScore": 38,
  "ecoReasoning": "2-3 sentences citing specific articles",
  "ecoLevel": "SIGNIFICANT",
  "ecoScore": 65,
  "econReasoning": "2-3 sentences citing specific articles",
  "econLevel": "MINIMAL",
  "econScore": 18,
  "overallSummary": "1-2 sentence synthesis of the combined environmental impact",
  "category": "climate",
  "region": "Global",
  "keywords": ["keyword1", "keyword2"]
}

IMPORTANT:
- The numeric score MUST fall within the range for the level you chose.
- The overall score and urgency will be computed server-side. Do NOT include them.
- Use "INSUFFICIENT_DATA" and -1 if a dimension cannot be assessed from the articles.`;

  const response = await callLLM(prompt, { jsonMode: true });
  const parsed = extractJSON(response) as LLMScoreResponse | null;

  if (!parsed || typeof parsed.healthScore !== "number") {
    console.warn(`Scoring LLM failed for "${topicName}", using defaults`);
    return {
      healthReasoning: `Recent news coverage about ${topicName}.`,
      healthLevel: "MODERATE",
      healthScore: 50,
      ecoReasoning: `Recent news coverage about ${topicName}.`,
      ecoLevel: "MODERATE",
      ecoScore: 50,
      econReasoning: `Recent news coverage about ${topicName}.`,
      econLevel: "MODERATE",
      econScore: 50,
      overallSummary: `Recent news coverage about ${topicName}.`,
      category: "climate",
      region: "Global",
      keywords: topicName.toLowerCase().split(" "),
      overallScore: 50,
      urgency: deriveUrgency(50),
      anomalyDetected: false,
      rawLlmResponse: safeJsonb(response),
      clampedDimensions: [],
    };
  }

  return processScoreResult(parsed, response, previousScores, topicName);
}

// --- Main Batch Logic ---
export async function POST(request: NextRequest) {
  if (!requireAdminKey(request)) {
    return getUnauthorizedResponse();
  }

  try {
    if (!GNEWS_API_KEY || !OPENROUTER_API_KEY) {
      return NextResponse.json(
        {
          error: "Missing API keys",
          details:
            "GNEWS_API_KEY and OPENROUTER_API_KEY must be set in environment variables",
        },
        { status: 500 }
      );
    }

    console.log("=== EcoTicker Batch Pipeline ===");
    console.log(`Time: ${new Date().toISOString()}`);

    // Step 1: Fetch news from all sources in parallel
    console.log("\n[1/4] Fetching news...");
    const [gnewsResult, rssResult] = await Promise.allSettled([
      fetchNews(),
      fetchRssFeeds(),
    ]);

    const gnewsArticles = gnewsResult.status === "fulfilled" ? gnewsResult.value : [];
    let rssArticles: NewsArticle[] = [];
    let rssFeedHealth: FeedHealth[] = [];

    if (rssResult.status === "fulfilled") {
      rssArticles = rssResult.value.articles;
      rssFeedHealth = rssResult.value.feedHealth;
    }

    // Log catastrophic failures (per-source errors caught internally)
    if (gnewsResult.status === "rejected") {
      console.error("GNews fetch CRASHED:", gnewsResult.reason);
    }
    if (rssResult.status === "rejected") {
      console.error("RSS fetch CRASHED:", rssResult.reason);
      console.log("RSS feed health: unavailable (fetch crashed)");
    }

    // SYNC: per-feed health logging must match scripts/batch.ts
    if (rssFeedHealth.length > 0) {
      for (const fh of rssFeedHealth) {
        const hostname = feedHostname(fh.url);
        if (fh.status === "ok") {
          console.log(`  ✓ ${fh.name} (${hostname}): ${fh.articleCount} articles in ${fh.durationMs}ms`);
        } else {
          console.log(`  ✗ ${fh.name} (${hostname}): FAILED in ${fh.durationMs}ms — ${fh.error}`);
        }
      }
      const healthyCount = rssFeedHealth.filter((f) => f.status === "ok").length;
      const failedFeeds = rssFeedHealth.filter((f) => f.status === "error");
      const failedList = failedFeeds.map((f) => `${feedHostname(f.url)}: ${f.error}`).join(", ");
      if (failedFeeds.length > 0) {
        console.log(`Feed health: ${healthyCount}/${rssFeedHealth.length} healthy, ${failedFeeds.length} failed [${failedList}]`);
      } else {
        console.log(`Feed health: ${healthyCount}/${rssFeedHealth.length} healthy`);
      }
    }

    // Source health warnings (AC #10) — distinguish "no data" from "source down"
    if (gnewsArticles.length === 0 && rssArticles.length > 0) {
      console.warn("⚠️ GNews returned 0 articles while RSS is healthy — check API key / rate limits");
    }
    if (rssArticles.length === 0 && gnewsArticles.length > 0) {
      console.warn("⚠️ RSS returned 0 articles while GNews is healthy — check feed URLs / network");
    }

    // SYNC: sourceMap + merge pattern must match scripts/batch.ts
    // Build sourceMap — first-write-wins (matches Set dedup order below)
    // RSS first so RSS wins attribution on cross-source URL duplicates
    const sourceMap = new Map<string, "gnews" | "rss">();
    for (const a of rssArticles) {
      if (!sourceMap.has(a.url)) sourceMap.set(a.url, "rss");
    }
    for (const a of gnewsArticles) {
      if (!sourceMap.has(a.url)) sourceMap.set(a.url, "gnews");
    }

    // Merge RSS first, then apply combined dedup + blocked domain filter
    const mergedArticles = [...rssArticles, ...gnewsArticles];
    const seenUrls = new Set<string>();
    const newsArticles = mergedArticles.filter((a) => {
      if (!a.url || seenUrls.has(a.url)) return false;
      if (isBlockedDomain(a.url)) return false;
      seenUrls.add(a.url);
      return true;
    });

    console.log(
      `Sources: GNews=${gnewsArticles.length}, RSS=${rssArticles.length} (before dedup) → ${newsArticles.length} unique (after dedup)`
    );

    if (newsArticles.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No new articles found",
        stats: {
          topics: 0,
          articles: 0,
          scoreHistory: 0,
          gnewsArticles: gnewsArticles.length,
          rssArticles: rssArticles.length,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Load existing topics + keywords (includes dimension scores for anomaly detection)
    const existingTopicsRaw = await db
      .select({
        id: topics.id,
        name: topics.name,
        currentScore: topics.currentScore,
        healthScore: topics.healthScore,
        ecoScore: topics.ecoScore,
        econScore: topics.econScore,
        keywords: sql<string | null>`STRING_AGG(${topicKeywords.keyword}, ',')`,
      })
      .from(topics)
      .leftJoin(topicKeywords, sql`${topicKeywords.topicId} = ${topics.id}`)
      .groupBy(topics.id);

    const topicsWithKeywords = existingTopicsRaw.map((t) => ({
      ...t,
      keywords: t.keywords ? t.keywords.split(",") : [],
    }));

    // Step 2: Classify articles into topics (in batches)
    console.log("\n[2/4] Classifying articles into topics...");
    const allClassifications: Classification[] = [];

    const batchSize = 10;
    for (let i = 0; i < newsArticles.length; i += batchSize) {
      const batch = newsArticles.slice(i, i + batchSize);
      console.log(
        `  Classifying batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          newsArticles.length / batchSize
        )} (${batch.length} articles)...`
      );

      try {
        const batchClassifications = await classifyArticles(
          batch,
          topicsWithKeywords
        );
        const adjustedClassifications = batchClassifications.map((c) => ({
          ...c,
          articleIndex: c.articleIndex + i,
        }));
        allClassifications.push(...adjustedClassifications);
      } catch (err) {
        console.error(
          `  Failed to classify batch ${Math.floor(i / batchSize) + 1}:`,
          err
        );
      }
    }

    const classifications = allClassifications;
    console.log(
      `Classified into ${new Set(classifications.map((c) => c.topicName)).size} topics`
    );

    // Group articles by topic name
    const topicGroups = new Map<string, NewsArticle[]>();
    for (const c of classifications) {
      const article = newsArticles[c.articleIndex];
      if (!article) continue;
      const existing = topicGroups.get(c.topicName) || [];
      existing.push(article);
      topicGroups.set(c.topicName, existing);
    }

    // Step 3: Score each topic
    console.log("\n[3/4] Scoring topics...");
    let topicCount = 0;
    let articleCount = 0;
    let scoreCount = 0;
    let clampedCount = 0;
    let totalDimensionCount = 0;

    for (const [topicName, topicArticles] of topicGroups) {
      // Look up previous dimension scores for anomaly detection
      const matchingTopic = topicsWithKeywords.find((t) => t.name === topicName);
      const previousScores =
        matchingTopic &&
        matchingTopic.healthScore !== null &&
        matchingTopic.ecoScore !== null &&
        matchingTopic.econScore !== null
          ? {
              health: matchingTopic.healthScore!,
              eco: matchingTopic.ecoScore!,
              econ: matchingTopic.econScore!,
            }
          : null;

      const scoreResult = await scoreTopic(topicName, topicArticles, previousScores);
      const slug = slugify(topicName, { lower: true, strict: true });
      const imageUrl = topicArticles.find((a) => a.urlToImage)?.urlToImage || null;

      console.log(
        `  ${topicName}: overall=${scoreResult.overallScore}, urgency=${scoreResult.urgency}` +
          (scoreResult.anomalyDetected ? " ⚠️ ANOMALY" : "")
      );

      // Track batch-level clamping (model drift indicator)
      totalDimensionCount += 3;
      clampedCount += scoreResult.clampedDimensions.length;

      // Upsert topic
      const inserted = await db
        .insert(topics)
        .values({
          name: topicName,
          slug,
          category: scoreResult.category,
          region: scoreResult.region,
          currentScore: scoreResult.overallScore,
          previousScore: 0,
          urgency: scoreResult.urgency,
          impactSummary: scoreResult.overallSummary,
          imageUrl,
          articleCount: topicArticles.length,
          healthScore: scoreResult.healthScore,
          ecoScore: scoreResult.ecoScore,
          econScore: scoreResult.econScore,
          scoreReasoning: scoreResult.overallSummary,
        })
        .onConflictDoUpdate({
          target: topics.slug,
          set: {
            previousScore: sql`${topics.currentScore}`,
            currentScore: scoreResult.overallScore,
            healthScore: scoreResult.healthScore,
            ecoScore: scoreResult.ecoScore,
            econScore: scoreResult.econScore,
            scoreReasoning: scoreResult.overallSummary,
            urgency: scoreResult.urgency,
            impactSummary: scoreResult.overallSummary,
            imageUrl: sql`COALESCE(${imageUrl}, ${topics.imageUrl})`,
            category: scoreResult.category,
            region: scoreResult.region,
            articleCount: sql`${topics.articleCount} + ${topicArticles.length}`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        })
        .returning({ id: topics.id });

      topicCount++;
      const topicId = inserted[0].id;

      // Insert articles
      for (const a of topicArticles) {
        await db
          .insert(articles)
          .values({
            topicId,
            title: a.title,
            url: a.url,
            source: a.source?.name || null,
            summary: a.description,
            imageUrl: a.urlToImage,
            sourceType: sourceMap.get(a.url) ?? "gnews", // AC #8: never rely on schema default
            publishedAt: a.publishedAt ? new Date(a.publishedAt) : null,
          })
          .onConflictDoNothing({ target: articles.url });
        articleCount++;
      }

      // Insert score history (with full rubric audit trail)
      await db.insert(scoreHistory).values({
        topicId,
        score: scoreResult.overallScore,
        healthScore: scoreResult.healthScore,
        ecoScore: scoreResult.ecoScore,
        econScore: scoreResult.econScore,
        healthLevel: scoreResult.healthLevel,
        ecoLevel: scoreResult.ecoLevel,
        econLevel: scoreResult.econLevel,
        healthReasoning: scoreResult.healthReasoning,
        ecoReasoning: scoreResult.ecoReasoning,
        econReasoning: scoreResult.econReasoning,
        overallSummary: scoreResult.overallSummary,
        impactSummary: scoreResult.overallSummary,
        rawLlmResponse: scoreResult.rawLlmResponse,
        anomalyDetected: scoreResult.anomalyDetected,
      });
      scoreCount++;

      // Insert keywords
      for (const kw of scoreResult.keywords) {
        await db
          .insert(topicKeywords)
          .values({
            topicId,
            keyword: kw.toLowerCase(),
          })
          .onConflictDoNothing();
      }
    }

    // Batch-level clamping warning (model drift indicator)
    if (totalDimensionCount > 0 && clampedCount / totalDimensionCount > 0.3) {
      console.warn(
        `\n⚠️  WARNING: ${((clampedCount / totalDimensionCount) * 100).toFixed(1)}% of dimension scores were clamped. ` +
          `Possible model drift. Review LLM responses.`
      );
    }

    // Step 4: Summary
    const totalTopicsResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(topics);
    const totalArticlesResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(articles);

    const totalTopics = totalTopicsResult[0]?.count || 0;
    const totalArticles = totalArticlesResult[0]?.count || 0;

    console.log(
      `\n[4/4] Done! ${totalTopics} total topics, ${totalArticles} total articles in database.`
    );

    // Log successful batch processing
    await logSuccess(request, "batch_process", {
      topicsProcessed: topicCount,
      articlesAdded: articleCount,
      scoresRecorded: scoreCount,
      totalTopics,
      totalArticles,
    });

    return NextResponse.json({
      success: true,
      message: "Batch processing completed successfully",
      stats: {
        topicsProcessed: topicCount,
        articlesAdded: articleCount,
        scoresRecorded: scoreCount,
        totalTopics,
        totalArticles,
        gnewsArticles: gnewsArticles.length,
        rssArticles: rssArticles.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logFailure(
      request,
      "batch_process",
      error instanceof Error ? error.message : "Unknown error"
    );
    return createErrorResponse(error, "Batch processing failed");
  }
}
