import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { topics, articles, scoreHistory, topicKeywords } from "@/db/schema";
import { requireAdminKey, getUnauthorizedResponse } from "@/lib/auth";
import { createErrorResponse } from "@/lib/errors";
import { logSuccess, logFailure } from "@/lib/audit-log";
import { eq, inArray, like, count } from "drizzle-orm";

/**
 * Cleanup endpoint - removes demo/seed data, keeps only real news
 *
 * Identifies demo data by:
 * - Topics with exactly 4 articles (seed script pattern)
 * - Articles from example.com (seed script URLs)
 *
 * Usage: POST /api/cleanup
 * Optional: Add ?dryRun=true to preview what will be deleted
 * Requires: X-API-Key header with valid admin API key
 */
export async function POST(request: NextRequest) {
  if (!requireAdminKey(request)) {
    return getUnauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") === "true";

    // Find demo topics (those with exactly 4 articles, characteristic of seed data)
    const demoTopics = await db
      .select({ id: topics.id, name: topics.name, articleCount: topics.articleCount })
      .from(topics)
      .where(eq(topics.articleCount, 4));

    // Also find articles from example.com (seed data)
    const demoArticles = await db
      .select({ id: articles.id, title: articles.title, topicId: articles.topicId })
      .from(articles)
      .where(like(articles.url, "%example.com%"));

    // Get topic IDs from demo articles
    const demoTopicIds = new Set(demoArticles.map((a) => a.topicId));
    demoTopics.forEach((t) => demoTopicIds.add(t.id));

    const topicIdsToDelete = Array.from(demoTopicIds);

    if (dryRun) {
      // Preview what will be deleted
      if (topicIdsToDelete.length === 0) {
        return NextResponse.json({
          dryRun: true,
          preview: {
            topicsToDelete: [],
            articleCount: 0,
            message: "No demo data found",
          },
        });
      }

      const topicsToDelete = await db
        .select({ id: topics.id, name: topics.name, articleCount: topics.articleCount })
        .from(topics)
        .where(inArray(topics.id, topicIdsToDelete));

      const articleCountResult = await db
        .select({ count: count() })
        .from(articles)
        .where(inArray(articles.topicId, topicIdsToDelete));

      return NextResponse.json({
        dryRun: true,
        preview: {
          topicsToDelete,
          articleCount: articleCountResult[0]?.count || 0,
          message: "Add ?dryRun=false or call without dryRun to actually delete",
        },
      });
    }

    // Actually delete the demo data
    if (topicIdsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No demo data found to delete",
        deleted: {
          topics: 0,
          articles: 0,
          scores: 0,
          keywords: 0,
        },
      });
    }

    // Delete in reverse FK order
    await db
      .delete(topicKeywords)
      .where(inArray(topicKeywords.topicId, topicIdsToDelete));
    await db
      .delete(scoreHistory)
      .where(inArray(scoreHistory.topicId, topicIdsToDelete));
    await db
      .delete(articles)
      .where(inArray(articles.topicId, topicIdsToDelete));
    await db.delete(topics).where(inArray(topics.id, topicIdsToDelete));

    // Get remaining counts
    const remainingTopicsResult = await db.select({ count: count() }).from(topics);
    const remainingArticlesResult = await db.select({ count: count() }).from(articles);

    const remainingTopics = remainingTopicsResult[0]?.count || 0;
    const remainingArticles = remainingArticlesResult[0]?.count || 0;

    // Log successful cleanup
    await logSuccess(request, "cleanup_data", {
      topicsDeleted: topicIdsToDelete.length,
      topicIds: topicIdsToDelete,
    });

    return NextResponse.json({
      success: true,
      message: "Demo data cleaned up successfully",
      deleted: {
        topics: topicIdsToDelete.length,
        articles: demoArticles.length,
        // Note: Drizzle doesn't return affected row counts directly
        // We track what we know for sure
        message: "Cascade deleted related scores and keywords",
      },
      remaining: {
        topics: remainingTopics,
        articles: remainingArticles,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logFailure(
      request,
      "cleanup_data",
      error instanceof Error ? error.message : "Unknown error"
    );
    return createErrorResponse(error, "Cleanup operation failed");
  }
}
