/**
 * Shared batch pipeline module (Story 8-1)
 *
 * Single source of truth for all duplicated batch pipeline logic
 * previously split between src/app/api/batch/route.ts and scripts/batch.ts.
 *
 * Rules:
 * - NO imports from @/db — this module must remain free of DB dependencies.
 * - NO module-level env var captures — all env reads use getter functions
 *   so tests can override process.env after import.
 * - Parser singleton at module scope (AC-5).
 */

import Parser from "rss-parser";
import {
  validateScore,
  computeOverallScore,
  deriveUrgency,
  detectAnomaly,
} from "./scoring";

// ─────────────────────────────────────────────────────────────────
// TYPES / INTERFACES
// ─────────────────────────────────────────────────────────────────

export interface NewsArticle {
  title: string;
  url: string;
  source: { name: string };
  description: string | null;
  urlToImage: string | null;
  publishedAt: string;
}

export interface GNewsArticle {
  title: string;
  url: string;
  source: { name: string; url: string };
  description: string | null;
  image: string | null;
  publishedAt: string;
}

export interface Classification {
  articleIndex: number;
  topicName: string;
  isNew: boolean;
}

export interface LLMScoreResponse {
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

export interface TopicScore {
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
  rawLlmResponse: unknown; // Divergence #2: always `unknown` (safer for JSONB)
  // Validation metadata:
  clampedDimensions: string[];
}

export interface FeedHealth {
  name: string; // feed.title for success, hostname for failures
  url: string; // original feed URL
  status: "ok" | "error";
  articleCount: number; // 0 for failures
  durationMs: number; // milliseconds elapsed for this feed
  error?: string; // only present when status === "error"
}

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

/**
 * Domains known to publish Q&A/educational junk content (not real news).
 * Articles from these domains are rejected before the LLM classifier runs.
 */
export const BLOCKED_DOMAINS = [
  "lifesciencesworld.com",
  "alltoc.com",
];

/**
 * Few-shot calibration examples for the scoring prompt.
 * One example per severity level to anchor the model.
 */
export const FEW_SHOT_EXAMPLES = `
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

export const DEFAULT_FEEDS = [
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

// ─────────────────────────────────────────────────────────────────
// CONFIG GETTERS (evaluate at call time, not import time)
// ─────────────────────────────────────────────────────────────────

export function getGnewsApiKey(): string {
  return process.env.GNEWS_API_KEY || "";
}

export function getOpenRouterConfig(): { apiKey: string; model: string } {
  return {
    apiKey: process.env.OPENROUTER_API_KEY || "",
    model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
  };
}

export function getKeywords(): string[] {
  return (
    process.env.BATCH_KEYWORDS || "climate change,pollution,deforestation,wildfire,flood"
  ).split(",");
}

export function getRssFeeds(): string[] {
  return (process.env.RSS_FEEDS || DEFAULT_FEEDS.join(","))
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────
// RSS PARSER SINGLETON (AC-5)
// ─────────────────────────────────────────────────────────────────

const rssParser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "EcoTicker/1.0" },
});

// ─────────────────────────────────────────────────────────────────
// PURE HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Returns true if the article URL belongs to a blocked domain.
 * Blocked domains are known sources of Q&A/educational junk — not real news.
 */
export function isBlockedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BLOCKED_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * Strips the www. prefix from a URL's hostname.
 * Returns the original string if the URL is invalid.
 */
export function feedHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Extract JSON from LLM response text.
 * Fallback for models that don't respect response_format.
 * Returns null on parse failure — never throws.
 */
export function extractJSON(text: string): unknown {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

/**
 * Safely serialize a value into a JSONB-compatible string.
 * - If the value is a string, returns it as-is (already serialized form).
 * - If the value is an object, JSON-stringifies it.
 * - If the value is null or undefined, returns a safe fallback JSON string.
 * Always returns a string. Never throws.
 */
export function safeJsonb(value: unknown): string {
  if (value === null || value === undefined) {
    return JSON.stringify({ raw: null });
  }
  if (typeof value === "string") {
    // Return the string as-is — it may or may not be valid JSON,
    // but the caller (rawLlmResponse storage) wants the raw string.
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ raw: String(value), parseError: true });
  }
}

/**
 * Process raw LLM score response:
 * 1. Validate each dimension score (clamp to level range)
 * 2. Compute overall score (weighted average, excluding INSUFFICIENT_DATA)
 * 3. Derive urgency (from overall score)
 * 4. Detect anomalies (if previous scores provided)
 *
 * Divergence resolution #5: all string fields use || "" fallback,
 * all arrays use Array.isArray guard.
 */
export function processScoreResult(
  raw: LLMScoreResponse,
  rawJson: string,
  previousScores: { health: number; eco: number; econ: number } | null,
  topicName: string
): TopicScore {
  // Validate each dimension (clamp to level range)
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
    // Divergence #5: || "" fallbacks on all string fields, Array.isArray guard for keywords
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
    rawLlmResponse: safeJsonb(rawJson), // Divergence #2: unknown type via safeJsonb
    clampedDimensions,
  };
}

// ─────────────────────────────────────────────────────────────────
// PROMPT BUILDERS
// ─────────────────────────────────────────────────────────────────

/**
 * Builds the classification prompt for Pass 1 (filter + classify articles).
 */
export function buildClassificationPrompt(
  newsArticles: NewsArticle[],
  existingTopics: { name: string; keywords: string[] }[]
): string {
  const topicsList =
    existingTopics.map((t) => `- "${t.name}" (keywords: ${t.keywords.join(", ")})`).join("\n") ||
    "(none yet)";

  const titlesList = newsArticles.map((a, i) => `${i}. ${a.title}`).join("\n");

  return `You are an environmental news filter and classifier.

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
}

/**
 * Builds the scoring rubric prompt for Pass 2.
 */
export function buildScoringPrompt(topicName: string, topicArticles: NewsArticle[]): string {
  const articleSummaries = topicArticles
    .map((a) => `- ${a.title}: ${a.description || "No description"}`)
    .join("\n");

  return `You are an environmental impact analyst scoring the severity of news events.
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
}

// ─────────────────────────────────────────────────────────────────
// ASYNC FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Call OpenRouter LLM.
 *
 * Divergence #1: supports optional jsonMode parameter (defaults to true).
 * Both consumers use jsonMode=true for scoring; classification uses default.
 */
export async function callLLM(prompt: string, options?: { jsonMode?: boolean }): Promise<string> {
  const { apiKey, model } = getOpenRouterConfig();
  const jsonMode = options?.jsonMode !== false; // default true

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0, // greedy decoding for consistency
  };
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Fetches environmental news from GNews API v4.
 * Batches keywords into groups to stay under the daily request limit.
 * Filters blocked domains and deduplicates by URL.
 */
export async function fetchNews(): Promise<NewsArticle[]> {
  const keywords = getKeywords();
  const apiKey = getGnewsApiKey();
  const allArticles: NewsArticle[] = [];

  const keywordGroups: string[] = [];
  for (let i = 0; i < keywords.length; i += 4) {
    keywordGroups.push(keywords.slice(i, i + 4).join(" OR "));
  }

  for (const query of keywordGroups) {
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=10&sortby=publishedAt&token=${apiKey}`;
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
        const filteredArticles = data.articles
          .filter((a: GNewsArticle) => {
            const source = a.source?.name?.toLowerCase() || "";
            const urlHost = (() => { try { return new URL(a.url || "").hostname.toLowerCase(); } catch { return ""; } })();
            return (
              !source.includes("bringatrailer") &&
              !urlHost.includes("bringatrailer") &&
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
    console.log(
      `🚫 Blocked ${blocked.length} articles from junk domains: ${[...new Set(blocked.map((u) => new URL(u).hostname))].join(", ")}`
    );
  }
  return deduped;
}

/**
 * Fetches articles from all configured RSS feeds in parallel.
 * Returns parsed articles and per-feed health status.
 */
export async function fetchRssFeeds(): Promise<{ articles: NewsArticle[]; feedHealth: FeedHealth[] }> {
  const feeds = getRssFeeds();

  const results = await Promise.allSettled(
    feeds.map(async (url) => {
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
      const url = reason.url || feeds[i];
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
      console.error(`Failed to fetch RSS feed "${url}":`, reason.error);
    }
  }

  return { articles: rssArticles, feedHealth };
}

/**
 * Classify articles into environmental topics using LLM (Pass 1).
 *
 * Divergence #3: returns [] on LLM failure. The caller decides fallback behavior.
 * (scripts/batch.ts can wrap with its "Environmental News" fallback at the call site.)
 */
export async function classifyArticles(
  newsArticles: NewsArticle[],
  existingTopics: { name: string; keywords: string[] }[]
): Promise<Classification[]> {
  const prompt = buildClassificationPrompt(newsArticles, existingTopics);
  // Classification uses plain text response (not JSON mode) — AC #2 from US-1.0 scoring pipeline
  const response = await callLLM(prompt, { jsonMode: false });

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
          console.log(
            `   ❌ [${articleIdx}] "${article.title.length > 60 ? article.title.substring(0, 60) + "..." : article.title}" (${reason})`
          );
        }
      });
      const relevanceRate =
        newsArticles.length > 0
          ? (((newsArticles.length - parsed.rejected.length) / newsArticles.length) * 100).toFixed(1)
          : "0.0";
      console.log(
        `✅ Relevance rate: ${relevanceRate}% (${newsArticles.length - parsed.rejected.length}/${newsArticles.length} articles)`
      );
    }
    return parsed.classifications;
  }

  console.error("Classification LLM failed to return valid JSON");
  console.error("LLM Response was:", response.substring(0, 1000));
  console.warn("Skipping these articles due to classification failure");
  return []; // Divergence #3: empty array, not "Environmental News" fallback
}

/**
 * Score a topic using the rubric-based LLM prompt (Pass 2).
 *
 * Divergence #4: accepts optional previousScores parameter for anomaly detection.
 * This is cleaner than the batch.ts pattern of scoring twice with Object.assign.
 */
export async function scoreTopic(
  topicName: string,
  topicArticles: NewsArticle[],
  previousScores?: { health: number; eco: number; econ: number } | null
): Promise<TopicScore> {
  const prompt = buildScoringPrompt(topicName, topicArticles);
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

  return processScoreResult(parsed, response, previousScores ?? null, topicName);
}

// ─────────────────────────────────────────────────────────────────
// ORCHESTRATION HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Merges RSS and GNews articles into a single deduplicated list.
 * RSS articles take priority — RSS wins on cross-source URL duplicates.
 * Filters blocked domains during merge.
 *
 * Returns the merged article list, a sourceMap for attribution, and raw counts.
 */
export function mergeAndDedup(
  rssArticles: NewsArticle[],
  gnewsArticles: NewsArticle[]
): {
  articles: NewsArticle[];
  sourceMap: Map<string, "gnews" | "rss">;
  rssCount: number;
  gnewsCount: number;
} {
  // Build sourceMap — first-write-wins (RSS goes first, so RSS wins on duplicates)
  const sourceMap = new Map<string, "gnews" | "rss">();
  for (const a of rssArticles) {
    if (!sourceMap.has(a.url)) sourceMap.set(a.url, "rss");
  }
  for (const a of gnewsArticles) {
    if (!sourceMap.has(a.url)) sourceMap.set(a.url, "gnews");
  }

  // Merge RSS first, then apply combined dedup + blocked domain filter
  const merged = [...rssArticles, ...gnewsArticles];
  const seenUrls = new Set<string>();
  const articles = merged.filter((a) => {
    if (!a.url || seenUrls.has(a.url)) return false;
    if (isBlockedDomain(a.url)) return false;
    seenUrls.add(a.url);
    return true;
  });

  // Count unique non-blocked articles per source
  let rssCount = 0;
  let gnewsCount = 0;
  for (const a of articles) {
    const src = sourceMap.get(a.url);
    if (src === "rss") rssCount++;
    else gnewsCount++;
  }

  return { articles, sourceMap, rssCount, gnewsCount };
}

/**
 * Logs per-feed health status and a summary line.
 * No-op when feedHealth is empty.
 */
export function logFeedHealth(feedHealth: FeedHealth[]): void {
  if (feedHealth.length === 0) return;

  for (const fh of feedHealth) {
    const hostname = feedHostname(fh.url);
    if (fh.status === "ok") {
      console.log(`  ✓ ${fh.name} (${hostname}): ${fh.articleCount} articles in ${fh.durationMs}ms`);
    } else {
      console.log(`  ✗ ${fh.name} (${hostname}): FAILED in ${fh.durationMs}ms — ${fh.error}`);
    }
  }

  const healthyCount = feedHealth.filter((f) => f.status === "ok").length;
  const failedFeeds = feedHealth.filter((f) => f.status === "error");
  const failedList = failedFeeds.map((f) => `${feedHostname(f.url)}: ${f.error}`).join(", ");
  if (failedFeeds.length > 0) {
    console.log(
      `Feed health: ${healthyCount}/${feedHealth.length} healthy, ${failedFeeds.length} failed [${failedList}]`
    );
  } else {
    console.log(`Feed health: ${healthyCount}/${feedHealth.length} healthy`);
  }
}
