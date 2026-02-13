import "dotenv/config"; // Load .env for standalone script
import { drizzle } from "drizzle-orm/node-postgres";
import { sql, lt } from "drizzle-orm";
import { Pool } from "pg";
import slugify from "slugify";
import * as schema from "../src/db/schema";
import {
  validateScore,
  computeOverallScore,
  deriveUrgency,
  detectAnomaly,
} from "../src/lib/scoring";

const { topics, articles, scoreHistory, topicKeywords, auditLogs } = schema;

// ─────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────

const NEWSAPI_KEY = process.env.NEWSAPI_KEY || "";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free";
const KEYWORDS = (
  process.env.BATCH_KEYWORDS || "climate change,pollution,deforestation,wildfire,flood"
).split(",");

// Future: RSS feed support (placeholder)
// const RSS_FEEDS = (process.env.RSS_FEEDS || "").split(",").filter(Boolean);

// ─────────────────────────────────────────────────────────────────
// DB SETUP
// ─────────────────────────────────────────────────────────────────

/**
 * Create standalone Drizzle connection for script.
 * Scripts run outside Next.js, so they can't use src/db/index.ts
 * (which relies on Next.js env loading).
 */
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

// ─────────────────────────────────────────────────────────────────
// NEWSAPI FETCHER
// ─────────────────────────────────────────────────────────────────

interface NewsArticle {
  title: string;
  url: string;
  source: { name: string };
  description: string | null;
  urlToImage: string | null;
  publishedAt: string;
}

/**
 * Fetches environmental news from NewsAPI.
 * Batches keywords into groups to stay under 100 requests/day limit.
 */
async function fetchNews(): Promise<NewsArticle[]> {
  const allArticles: NewsArticle[] = [];

  // Batch keywords into 2-3 requests to stay well under 100/day limit
  const keywordGroups: string[] = [];
  for (let i = 0; i < KEYWORDS.length; i += 4) {
    keywordGroups.push(KEYWORDS.slice(i, i + 4).join(" OR "));
  }

  for (const query of keywordGroups) {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${NEWSAPI_KEY}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const data = (await res.json()) as { articles?: NewsArticle[] };
      if (data.articles) {
        allArticles.push(...data.articles);
      }
    } catch (err) {
      console.error(`Failed to fetch news for "${query}":`, err);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return allArticles.filter((a) => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────
// LLM CALLER
// ─────────────────────────────────────────────────────────────────

/**
 * Call OpenRouter LLM with JSON response format.
 *
 * US-1.0 changes:
 * - temperature: 0 (greedy decoding for consistency)
 * - response_format: json_object (enforces valid JSON)
 */
async function callLLM(prompt: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0, // US-1.0: greedy decoding
      response_format: { type: "json_object" }, // US-1.0: enforce JSON
    }),
  });

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Extract JSON from LLM response.
 * Fallback for models that don't respect response_format.
 */
function extractJSON(text: string): unknown {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// PASS 1: CLASSIFICATION
// ─────────────────────────────────────────────────────────────────

interface Classification {
  articleIndex: number;
  topicName: string;
  isNew: boolean;
}

/**
 * Classify articles into environmental topics using LLM.
 * Uses existing topics where they match, creates new topics when needed.
 *
 * Unchanged from v1 — classification works well as-is.
 */
async function classifyArticles(
  articles: NewsArticle[],
  existingTopics: Array<{ name: string; keywords: string[] }>
): Promise<Classification[]> {
  const topicsList =
    existingTopics.map((t) => `- "${t.name}" (keywords: ${t.keywords.join(", ")})`).join("\n") ||
    "(none yet)";

  const titlesList = articles.map((a, i) => `${i}. ${a.title}`).join("\n");

  const prompt = `You are an environmental news classifier. Group these articles into environmental topics.
Use existing topics where they match. Create new topic names only when no existing topic fits.
Each topic should be a clear environmental issue (e.g. "Amazon Deforestation", "Delhi Air Quality Crisis").

Existing topics:
${topicsList}

Articles:
${titlesList}

Respond with ONLY valid JSON, no other text:
{"classifications": [{"articleIndex": 0, "topicName": "Topic Name", "isNew": false}, ...]}`;

  const response = await callLLM(prompt);
  const parsed = extractJSON(response) as { classifications?: Classification[] } | null;

  if (parsed?.classifications) return parsed.classifications;

  // Fallback: assign all to a generic topic
  console.warn("Classification LLM failed, using fallback grouping");
  return articles.map((_, i) => ({
    articleIndex: i,
    topicName: "Environmental News",
    isNew: true,
  }));
}

// ─────────────────────────────────────────────────────────────────
// PASS 2: SCORING (US-1.0 RUBRIC-BASED)
// ─────────────────────────────────────────────────────────────────

/**
 * Few-shot calibration examples from US-1.0 Part 4.2.
 * One example per severity level to anchor the model.
 */
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

/**
 * Raw LLM response structure (before server-side processing).
 */
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

/**
 * Fully processed topic score (after validation + aggregation).
 */
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
  rawLlmResponse: string;
  // Validation metadata:
  clampedDimensions: string[];
}

/**
 * Score a topic using the US-1.0 rubric-based prompt.
 *
 * US-1.0 changes:
 * - 4-level severity rubric (MINIMAL/MODERATE/SIGNIFICANT/SEVERE)
 * - Reasoning-first output order
 * - Few-shot calibration examples
 * - LLM no longer sets overall score/urgency (computed server-side)
 * - INSUFFICIENT_DATA option for dimensions without evidence
 */
async function scoreTopic(topicName: string, articles: NewsArticle[]): Promise<TopicScore> {
  const articleSummaries = articles
    .map((a) => `- ${a.title}: ${a.description || "No description"}`)
    .join("\n");

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

  const response = await callLLM(prompt);
  const parsed = extractJSON(response) as LLMScoreResponse | null;

  if (!parsed || typeof parsed.healthScore !== "number") {
    // Fallback
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
      urgency: "moderate",
      anomalyDetected: false,
      rawLlmResponse: response,
      clampedDimensions: [],
    };
  }

  // Process the raw LLM response (validate + compute + detect anomalies)
  // Note: we don't have previous scores here — anomaly detection happens in main()
  return processScoreResult(parsed, response, null, topicName);
}

/**
 * Process raw LLM score response:
 * 1. Validate each dimension score (clamp to level range)
 * 2. Compute overall score (weighted average, excluding INSUFFICIENT_DATA)
 * 3. Derive urgency (from overall score)
 * 4. Detect anomalies (if previous scores provided)
 *
 * @param raw - Raw LLM response
 * @param rawJson - Raw JSON string for audit trail
 * @param previousScores - Previous scores for anomaly detection (null if new topic)
 * @param topicName - Topic name for logging
 * @returns Fully processed TopicScore
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

  // Compute overall score
  const overallScore = computeOverallScore(
    healthValidated.score,
    ecoValidated.score,
    econValidated.score
  );

  // Derive urgency
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
    healthReasoning: raw.healthReasoning,
    healthLevel: healthValidated.level,
    healthScore: healthValidated.score,
    ecoReasoning: raw.ecoReasoning,
    ecoLevel: ecoValidated.level,
    ecoScore: ecoValidated.score,
    econReasoning: raw.econReasoning,
    econLevel: econValidated.level,
    econScore: econValidated.score,
    overallSummary: raw.overallSummary,
    category: raw.category,
    region: raw.region,
    keywords: raw.keywords,
    overallScore,
    urgency,
    anomalyDetected,
    rawLlmResponse: rawJson,
    clampedDimensions,
  };
}

// ─────────────────────────────────────────────────────────────────
// MAIN PIPELINE
// ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== EcoTicker Batch Pipeline v2 (US-1.1) ===");
  console.log(`Time: ${new Date().toISOString()}`);

  // Step 1: Fetch news
  console.log("\n[1/4] Fetching news...");
  const newsArticles = await fetchNews();
  console.log(`Fetched ${newsArticles.length} articles`);

  if (newsArticles.length === 0) {
    console.log("No articles found, exiting.");
    await pool.end();
    return;
  }

  // Load existing topics + keywords
  const existingTopicsRows = await db
    .select({
      id: topics.id,
      name: topics.name,
      healthScore: topics.healthScore,
      ecoScore: topics.ecoScore,
      econScore: topics.econScore,
      keywords: sql<string>`STRING_AGG(${topicKeywords.keyword}, ',' ORDER BY ${topicKeywords.keyword})`,
    })
    .from(topics)
    .leftJoin(topicKeywords, sql`${topicKeywords.topicId} = ${topics.id}`)
    .groupBy(topics.id, topics.name, topics.healthScore, topics.ecoScore, topics.econScore);

  const existingTopics = existingTopicsRows.map((t) => ({
    id: t.id,
    name: t.name,
    healthScore: t.healthScore,
    ecoScore: t.ecoScore,
    econScore: t.econScore,
    keywords: t.keywords ? t.keywords.split(",") : [],
  }));

  // Step 2: Classify articles into topics
  console.log("\n[2/4] Classifying articles into topics...");
  const classifications = await classifyArticles(newsArticles, existingTopics);
  console.log(`Classified into ${new Set(classifications.map((c) => c.topicName)).size} topics`);

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
  let clampedCount = 0;
  let totalDimensionCount = 0;

  for (const [topicName, topicArticles] of Array.from(topicGroups.entries())) {
    // Get previous scores for anomaly detection
    const existingTopic = existingTopics.find((t) => t.name === topicName);
    const previousScores =
      existingTopic &&
      existingTopic.healthScore !== null &&
      existingTopic.ecoScore !== null &&
      existingTopic.econScore !== null
        ? {
            health: existingTopic.healthScore,
            eco: existingTopic.ecoScore,
            econ: existingTopic.econScore,
          }
        : null;

    // Score the topic (with anomaly detection if previous scores exist)
    const scoreResult = await scoreTopic(topicName, topicArticles);

    // Re-process with previous scores for anomaly detection
    if (previousScores) {
      const llmResponse: LLMScoreResponse = {
        healthReasoning: scoreResult.healthReasoning,
        healthLevel: scoreResult.healthLevel,
        healthScore: scoreResult.healthScore,
        ecoReasoning: scoreResult.ecoReasoning,
        ecoLevel: scoreResult.ecoLevel,
        ecoScore: scoreResult.ecoScore,
        econReasoning: scoreResult.econReasoning,
        econLevel: scoreResult.econLevel,
        econScore: scoreResult.econScore,
        overallSummary: scoreResult.overallSummary,
        category: scoreResult.category,
        region: scoreResult.region,
        keywords: scoreResult.keywords,
      };
      Object.assign(
        scoreResult,
        processScoreResult(llmResponse, scoreResult.rawLlmResponse, previousScores, topicName)
      );
    }

    const slug = slugify(topicName, { lower: true, strict: true });
    const imageUrl = topicArticles.find((a) => a.urlToImage)?.urlToImage || null;

    console.log(
      `  ${topicName}: overall=${scoreResult.overallScore}, urgency=${scoreResult.urgency}` +
        (scoreResult.anomalyDetected ? " ⚠️ ANOMALY" : "")
    );

    // Track clamping stats
    totalDimensionCount += 3;
    clampedCount += scoreResult.clampedDimensions.length;

    // Upsert topic (Drizzle)
    await db
      .insert(topics)
      .values({
        name: topicName,
        slug,
        category: scoreResult.category,
        region: scoreResult.region,
        currentScore: scoreResult.overallScore,
        healthScore: scoreResult.healthScore,
        ecoScore: scoreResult.ecoScore,
        econScore: scoreResult.econScore,
        scoreReasoning: scoreResult.overallSummary,
        urgency: scoreResult.urgency,
        impactSummary: scoreResult.overallSummary,
        imageUrl,
        articleCount: topicArticles.length,
        previousScore: 0, // Will be updated on conflict
      })
      .onConflictDoUpdate({
        target: topics.slug,
        set: {
          previousScore: sql`${topics.currentScore}`, // Rotate current → previous
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
      });

    // Get topic ID
    const topicRow = await db.select({ id: topics.id }).from(topics).where(sql`${topics.slug} = ${slug}`).limit(1);
    if (!topicRow[0]) continue;
    const topicId = topicRow[0].id;

    // Insert articles (Drizzle with dedup)
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
          publishedAt: a.publishedAt ? new Date(a.publishedAt) : null,
        })
        .onConflictDoNothing({ target: articles.url });
    }

    // Insert score history (Drizzle)
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

    // Insert keywords (Drizzle with dedup)
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

  // Step 4: Batch-level validation
  if (totalDimensionCount > 0 && clampedCount / totalDimensionCount > 0.3) {
    console.warn(
      `\n⚠️  WARNING: ${((clampedCount / totalDimensionCount) * 100).toFixed(1)}% of dimension scores were clamped. ` +
        `Possible model drift. Review LLM responses.`
    );
  }

  // GDPR: Purge audit logs older than 90 days
  console.log("\n[GDPR] Purging old audit logs...");
  const purgeResult = await db
    .delete(auditLogs)
    .where(lt(auditLogs.timestamp, sql`NOW() - INTERVAL '90 days'`));
  console.log(`Purged ${purgeResult.rowCount || 0} audit logs older than 90 days`);

  // Summary
  const topicCount = await db.select({ count: sql<number>`COUNT(*)` }).from(topics);
  const articleCount = await db.select({ count: sql<number>`COUNT(*)` }).from(articles);
  console.log(
    `\n[4/4] Done! ${topicCount[0].count} topics, ${articleCount[0].count} articles in database.`
  );

  await pool.end();
}

// ─────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("Batch pipeline failed:", err);
  process.exit(1);
});
