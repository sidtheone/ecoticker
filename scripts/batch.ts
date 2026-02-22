import "dotenv/config"; // Load .env for standalone script
import { drizzle } from "drizzle-orm/node-postgres";
import { sql, lt } from "drizzle-orm";
import { Pool } from "pg";
import slugify from "slugify";
import * as schema from "../src/db/schema";
import {
  fetchNews,
  fetchRssFeeds,
  classifyArticles,
  scoreTopic,
  mergeAndDedup,
  logFeedHealth,
  type NewsArticle,
  type FeedHealth,
  type Classification,
} from "../src/lib/batch-pipeline";

const { topics, articles, scoreHistory, topicKeywords, auditLogs } = schema;

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
// MAIN PIPELINE
// ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== EcoTicker Batch Pipeline v2 (US-1.1) ===");
  console.log(`Time: ${new Date().toISOString()}`);

  // Step 1: Fetch news from all sources in parallel
  console.log("\n[1/4] Fetching news...");
  const [gnewsResult, rssResult] = await Promise.allSettled([
    fetchNews(),
    fetchRssFeeds(),
  ]);

  const gnewsArticles = gnewsResult.status === "fulfilled" ? gnewsResult.value : [];
  let rssArticles: NewsArticle[] = [];
  let feedHealth: FeedHealth[] = [];

  if (rssResult.status === "fulfilled") {
    rssArticles = rssResult.value.articles;
    feedHealth = rssResult.value.feedHealth;
  }

  // Log catastrophic failures (per-source errors are caught internally by each fetcher)
  if (gnewsResult.status === "rejected") {
    console.error("GNews fetch CRASHED:", gnewsResult.reason);
  }
  if (rssResult.status === "rejected") {
    console.error("RSS fetch CRASHED:", rssResult.reason);
    console.log("RSS feed health: unavailable (fetch crashed)");
  }

  // Log per-feed health status
  logFeedHealth(feedHealth);

  // Source health warnings — distinguish "no data" from "source down"
  if (gnewsArticles.length === 0 && rssArticles.length > 0) {
    console.warn("⚠️ GNews returned 0 articles while RSS is healthy — check API key / rate limits");
  }
  if (rssArticles.length === 0 && gnewsArticles.length > 0) {
    console.warn("⚠️ RSS returned 0 articles while GNews is healthy — check feed URLs / network");
  }

  // Merge, dedup, filter blocked domains — RSS wins on cross-source duplicates
  const { articles: newsArticles, sourceMap } = mergeAndDedup(rssArticles, gnewsArticles);

  console.log(
    `Sources: GNews=${gnewsArticles.length}, RSS=${rssArticles.length} (before dedup) → ${newsArticles.length} unique (after dedup)`
  );

  if (newsArticles.length === 0) {
    console.log("No articles from any source, exiting.");
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
  // NOTE: batch.ts sends all articles at once (no batching). route.ts batches in groups of 10
  // to fit within web request timeout constraints. The cron script has more lenient timeouts
  // so a single LLM call for all articles is acceptable here. See Fix #3 comment in route.ts.
  console.log("\n[2/4] Classifying articles into topics...");
  let classifications: Classification[] = await classifyArticles(newsArticles, existingTopics);

  // Fallback: if classifyArticles returns [] and we have articles, group everything under
  // "Environmental News" so no data is lost. The shared module intentionally returns []
  // on LLM failure (Divergence #3) — the fallback decision belongs to each caller.
  if (classifications.length === 0 && newsArticles.length > 0) {
    console.warn("Classification returned empty result — falling back to 'Environmental News' grouping");
    classifications = newsArticles.map((_, i) => ({
      articleIndex: i,
      topicName: "Environmental News",
      isNew: true,
    }));
  }

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
    // Get previous scores for anomaly detection (Divergence #4: pass directly to scoreTopic)
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

    // Divergence #4: pass previousScores to scoreTopic directly (no Object.assign re-processing)
    const scoreResult = await scoreTopic(topicName, topicArticles, previousScores);

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
    const topicRow = await db
      .select({ id: topics.id })
      .from(topics)
      .where(sql`${topics.slug} = ${slug}`)
      .limit(1);
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
          sourceType: sourceMap.get(a.url) ?? "gnews", // never rely on schema default
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
    `\n[4/4] Done! ${topicCount[0]?.count ?? 0} topics, ${articleCount[0]?.count ?? 0} articles in database.`
  );

  await pool.end();
}

// ─────────────────────────────────────────────────────────────────
// ENTRY POINT
// ─────────────────────────────────────────────────────────────────

export { main };

// Only execute when run directly as a script (not when imported in tests)
// ts-jest compiles to CJS: require.main === module correctly identifies direct execution
if (require.main === module) {
  main().catch((err) => {
    console.error("Batch pipeline failed:", err);
    process.exit(1);
  });
}
