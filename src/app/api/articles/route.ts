import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { articles, topics } from "@/db/schema";
import { requireAdminKey, getUnauthorizedResponse } from "@/lib/auth";
import {
  articleCreateSchema,
  articleDeleteSchema,
  validateRequest,
} from "@/lib/validation";
import { createErrorResponse } from "@/lib/errors";
import { logSuccess, logFailure } from "@/lib/audit-log";
import { eq, and, like, inArray, count, desc, sql } from "drizzle-orm";

/**
 * Articles CRUD API
 *
 * GET /api/articles - List all articles with optional filtering
 * POST /api/articles - Create new article (admin only)
 * DELETE /api/articles - Batch delete articles by IDs or filter (admin only)
 */

/**
 * GET /api/articles
 *
 * Query params:
 * - topicId: Filter by topic ID
 * - source: Filter by source name
 * - url: Filter by URL pattern (supports LIKE with %)
 * - limit: Max results (default 50, max 500)
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get("topicId");
    const source = searchParams.get("source");
    const urlPattern = searchParams.get("url");
    const limitParam = Math.min(parseInt(searchParams.get("limit") || "50"), 500);
    const offsetParam = parseInt(searchParams.get("offset") || "0");

    // Build dynamic WHERE conditions
    const conditions = [];
    if (topicId) conditions.push(eq(articles.topicId, parseInt(topicId)));
    if (source) conditions.push(eq(articles.source, source));
    if (urlPattern) conditions.push(eq(articles.url, urlPattern)); // Exact match

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch articles
    const articlesList = await db
      .select()
      .from(articles)
      .where(whereClause)
      .orderBy(desc(articles.publishedAt), desc(articles.fetchedAt))
      .limit(limitParam)
      .offset(offsetParam);

    // Get total count
    const totalResult = await db
      .select({ count: count() })
      .from(articles)
      .where(whereClause);
    const total = totalResult[0]?.count || 0;

    return NextResponse.json({
      articles: articlesList,
      pagination: {
        total,
        limit: limitParam,
        offset: offsetParam,
        hasMore: offsetParam + limitParam < total,
      },
    });
  } catch (error) {
    return createErrorResponse(error, "Failed to fetch articles");
  }
}

/**
 * POST /api/articles
 *
 * Create a new article
 * Body: { topicId, title, url, source?, summary?, imageUrl?, publishedAt? }
 * Requires: X-API-Key header with valid admin API key
 */
export async function POST(request: NextRequest) {
  if (!requireAdminKey(request)) {
    return getUnauthorizedResponse();
  }

  try {
    const body = await request.json();

    // Validate request body with Zod
    const validation = validateRequest(articleCreateSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error },
        { status: 400 }
      );
    }

    const { topicId, title, url, source, summary, imageUrl, publishedAt } =
      validation.data;

    // Check if topic exists
    const topic = await db
      .select({ id: topics.id })
      .from(topics)
      .where(eq(topics.id, topicId))
      .limit(1);

    if (topic.length === 0) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    // Insert article (onConflictDoNothing to handle duplicate URLs)
    const inserted = await db
      .insert(articles)
      .values({
        topicId,
        title,
        url,
        source: source || null,
        summary: summary || null,
        imageUrl: imageUrl || null,
        sourceType: "api", // Explicitly set for API-created articles
        publishedAt: publishedAt ? new Date(publishedAt) : null,
      })
      .onConflictDoNothing({ target: articles.url })
      .returning();

    if (inserted.length === 0) {
      return NextResponse.json(
        { error: "Article with this URL already exists" },
        { status: 409 }
      );
    }

    const article = inserted[0];

    // Update topic article count
    await db
      .update(topics)
      .set({ articleCount: sql`${topics.articleCount} + 1` })
      .where(eq(topics.id, topicId));

    // Log successful article creation
    await logSuccess(request, "create_article", {
      articleId: article.id,
      topicId,
      title: article.title,
    });

    return NextResponse.json(
      {
        success: true,
        article,
      },
      { status: 201 }
    );
  } catch (error) {
    await logFailure(
      request,
      "create_article",
      error instanceof Error ? error.message : "Unknown error"
    );
    return createErrorResponse(error, "Failed to create article");
  }
}

/**
 * DELETE /api/articles
 *
 * Batch delete articles
 * Body options:
 * 1. { ids: [1, 2, 3] } - Delete specific article IDs
 * 2. { url: "%example.com%" } - Delete by URL pattern (LIKE query)
 * 3. { topicId: 5 } - Delete all articles for a topic
 * 4. { source: "Example Source" } - Delete all articles from a source
 * Requires: X-API-Key header with valid admin API key
 */
export async function DELETE(request: NextRequest) {
  if (!requireAdminKey(request)) {
    return getUnauthorizedResponse();
  }

  try {
    const body = await request.json();

    // Validate request body with Zod
    const validation = validateRequest(articleDeleteSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error },
        { status: 400 }
      );
    }

    const { ids, url, topicId: topicIdFilter, source: sourceFilter } = validation.data;

    let deletedCount = 0;
    const affectedTopics = new Set<number>();

    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Get topic IDs before deleting
      const articlesToDelete = await db
        .select({ topicId: articles.topicId })
        .from(articles)
        .where(inArray(articles.id, ids));
      articlesToDelete.forEach((a) => affectedTopics.add(a.topicId));

      // Delete by IDs
      await db.delete(articles).where(inArray(articles.id, ids));
      deletedCount = ids.length;
    } else if (url) {
      // Get topic IDs before deleting
      const articlesToDelete = await db
        .select({ topicId: articles.topicId })
        .from(articles)
        .where(like(articles.url, url));
      articlesToDelete.forEach((a) => affectedTopics.add(a.topicId));

      // Delete by URL pattern
      await db.delete(articles).where(like(articles.url, url));
      deletedCount = articlesToDelete.length;
    } else if (topicIdFilter) {
      affectedTopics.add(topicIdFilter);

      // Get count before deleting
      const countResult = await db
        .select({ count: count() })
        .from(articles)
        .where(eq(articles.topicId, topicIdFilter));
      deletedCount = countResult[0]?.count || 0;

      // Delete by topic ID
      await db.delete(articles).where(eq(articles.topicId, topicIdFilter));
    } else if (sourceFilter) {
      // Get topic IDs before deleting
      const articlesToDelete = await db
        .select({ topicId: articles.topicId })
        .from(articles)
        .where(eq(articles.source, sourceFilter));
      articlesToDelete.forEach((a) => affectedTopics.add(a.topicId));

      // Delete by source
      await db.delete(articles).where(eq(articles.source, sourceFilter));
      deletedCount = articlesToDelete.length;
    }

    // Update article counts for affected topics
    for (const topicIdValue of affectedTopics) {
      const countResult = await db
        .select({ count: count() })
        .from(articles)
        .where(eq(articles.topicId, topicIdValue));
      const articleCount = countResult[0]?.count || 0;

      await db
        .update(topics)
        .set({ articleCount })
        .where(eq(topics.id, topicIdValue));
    }

    // Log successful article deletion
    await logSuccess(request, "delete_articles", {
      deletedCount,
      affectedTopics: Array.from(affectedTopics).length,
      filters: {
        ids: !!ids,
        url: !!url,
        topicId: !!topicIdFilter,
        source: !!sourceFilter,
      },
    });

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      affectedTopics: Array.from(affectedTopics).length,
      message: `Deleted ${deletedCount} article(s)`,
    });
  } catch (error) {
    await logFailure(
      request,
      "delete_articles",
      error instanceof Error ? error.message : "Unknown error"
    );
    return createErrorResponse(error, "Failed to delete articles");
  }
}
