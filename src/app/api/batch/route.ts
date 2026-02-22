import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { topics, articles, scoreHistory, topicKeywords } from "@/db/schema";
import slugify from "slugify";
import { requireAdminKey, getUnauthorizedResponse } from "@/lib/auth";
import { createErrorResponse } from "@/lib/errors";
import { logSuccess, logFailure } from "@/lib/audit-log";
import { sql } from "drizzle-orm";
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
} from "@/lib/batch-pipeline";

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

// --- Main Batch Logic ---
export async function POST(request: NextRequest) {
  if (!requireAdminKey(request)) {
    return getUnauthorizedResponse();
  }

  try {
    const gnewsApiKey = process.env.GNEWS_API_KEY || "";
    const openRouterApiKey = process.env.OPENROUTER_API_KEY || "";

    if (!gnewsApiKey || !openRouterApiKey) {
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

    // Log per-feed health status
    logFeedHealth(rssFeedHealth);

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
    // NOTE: route.ts batches articles in groups of 10 to stay within web request timeout
    // constraints (60s hard limit). scripts/batch.ts sends all articles in a single LLM call
    // because the cron script has more lenient timeouts and simpler retry semantics.
    // This divergence is intentional — do not "fix" either side to match the other.
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
        const batchClassifications = await classifyArticles(batch, topicsWithKeywords);
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
            sourceType: sourceMap.get(a.url) ?? "gnews", // never rely on schema default
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
