import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { topics, scoreHistory, articles, topicKeywords } from "@/db/schema";
import { requireAdminKey, getUnauthorizedResponse } from "@/lib/auth";
import { topicDeleteSchema, validateRequest } from "@/lib/validation";
import { createErrorResponse } from "@/lib/errors";
import { logSuccess, logFailure } from "@/lib/audit-log";
import { eq, inArray, desc, sql, and } from "drizzle-orm";

/**
 * Topics API
 * GET - List topics with optional filtering
 * DELETE - Batch delete topics by IDs (admin only)
 */

export async function GET(request: NextRequest) {
  const urgency = request.nextUrl.searchParams.get("urgency");
  const category = request.nextUrl.searchParams.get("category");

  const validUrgencies = ["breaking", "critical", "moderate", "informational"];
  if (urgency && !validUrgencies.includes(urgency)) {
    return NextResponse.json({ error: "Invalid urgency value" }, { status: 400 });
  }

  const validCategories = [
    "air_quality",
    "deforestation",
    "ocean",
    "climate",
    "pollution",
    "biodiversity",
    "wildlife",
    "energy",
    "waste",
    "water",
  ];
  if (category && !validCategories.includes(category)) {
    return NextResponse.json({ error: "Invalid category value" }, { status: 400 });
  }

  // Build WHERE conditions
  const conditions = [];
  if (urgency) conditions.push(eq(topics.urgency, urgency));
  if (category) conditions.push(eq(topics.category, category));

  // Fetch topics with sparkline using lateral join
  // PostgreSQL: STRING_AGG(score::text, ',') replaces SQLite GROUP_CONCAT
  const rows = await db
    .select({
      id: topics.id,
      name: topics.name,
      slug: topics.slug,
      category: topics.category,
      region: topics.region,
      currentScore: topics.currentScore,
      previousScore: topics.previousScore,
      change: sql<number>`${topics.currentScore} - ${topics.previousScore}`,
      urgency: topics.urgency,
      impactSummary: topics.impactSummary,
      imageUrl: topics.imageUrl,
      articleCount: topics.articleCount,
      healthScore: topics.healthScore,
      ecoScore: topics.ecoScore,
      econScore: topics.econScore,
      scoreReasoning: topics.scoreReasoning,
      hidden: topics.hidden,
      updatedAt: topics.updatedAt,
      // Subquery for sparkline: last 7 scores
      sparklineScores: sql<string | null>`(
        SELECT STRING_AGG(score::text, ',' ORDER BY recorded_at DESC)
        FROM (
          SELECT score, recorded_at
          FROM ${scoreHistory}
          WHERE ${scoreHistory.topicId} = ${topics.id}
          ORDER BY recorded_at DESC
          LIMIT 7
        ) sub
      )`,
    })
    .from(topics)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(topics.currentScore));

  const topicsResponse = rows.map((r) => {
    const sparklineStr = r.sparklineScores as string | null;
    const sparkline = sparklineStr
      ? sparklineStr.split(",").map((s) => Number(s)).reverse()
      : [];

    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      category: r.category,
      region: r.region,
      currentScore: r.currentScore,
      previousScore: r.previousScore,
      change: r.change,
      urgency: r.urgency,
      impactSummary: r.impactSummary,
      imageUrl: r.imageUrl,
      articleCount: r.articleCount,
      healthScore: r.healthScore,
      ecoScore: r.ecoScore,
      econScore: r.econScore,
      scoreReasoning: r.scoreReasoning,
      hidden: r.hidden,
      updatedAt: r.updatedAt?.toISOString() || null,
      sparkline,
    };
  });

  return NextResponse.json(
    { topics: topicsResponse },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    }
  );
}

/**
 * DELETE /api/topics
 *
 * Batch delete topics
 * Body: { ids: [1, 2, 3] } - Delete specific topic IDs
 * Body: { articleCount: 0 } - Delete topics with 0 articles
 * Requires: X-API-Key header with valid admin API key
 */
export async function DELETE(request: NextRequest) {
  if (!requireAdminKey(request)) {
    return getUnauthorizedResponse();
  }

  try {
    const body = await request.json();

    // Validate request body with Zod
    const validation = validateRequest(topicDeleteSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error },
        { status: 400 }
      );
    }

    const { ids, articleCount: articleCountFilter } = validation.data;

    let deletedCount = 0;
    let topicIds: number[] = [];

    if (ids && Array.isArray(ids) && ids.length > 0) {
      topicIds = ids;
    } else if (articleCountFilter !== undefined) {
      // Find topics with specific article count
      const topicsToDelete = await db
        .select({ id: topics.id })
        .from(topics)
        .where(eq(topics.articleCount, articleCountFilter));
      topicIds = topicsToDelete.map((t) => t.id);
    }

    if (topicIds.length > 0) {
      // Delete in FK order: keywords → score_history → articles → topics
      await db.delete(topicKeywords).where(inArray(topicKeywords.topicId, topicIds));
      await db.delete(scoreHistory).where(inArray(scoreHistory.topicId, topicIds));
      await db.delete(articles).where(inArray(articles.topicId, topicIds));
      const result = await db.delete(topics).where(inArray(topics.id, topicIds));
      deletedCount = topicIds.length; // Drizzle doesn't return rowCount directly, use array length
    }

    // Log successful topic deletion
    await logSuccess(request, "delete_topics", {
      deletedCount,
      filters: { ids: !!ids, articleCount: articleCountFilter !== undefined },
    });

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      message: `Deleted ${deletedCount} topic(s)`,
    });
  } catch (error) {
    await logFailure(
      request,
      "delete_topics",
      error instanceof Error ? error.message : "Unknown error"
    );
    return createErrorResponse(error, "Failed to delete topics");
  }
}
