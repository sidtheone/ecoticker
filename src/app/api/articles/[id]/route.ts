import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { articles, topics } from "@/db/schema";
import { requireAdminKey, getUnauthorizedResponse } from "@/lib/auth";
import { articleUpdateSchema, validateRequest } from "@/lib/validation";
import { createErrorResponse } from "@/lib/errors";
import { logSuccess, logFailure } from "@/lib/audit-log";
import { eq, count } from "drizzle-orm";

/**
 * Single Article CRUD
 *
 * GET /api/articles/[id] - Get article by ID
 * PUT /api/articles/[id] - Update article (admin only)
 * DELETE /api/articles/[id] - Delete article (admin only)
 */

/**
 * GET /api/articles/[id]
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid article ID" }, { status: 400 });
    }

    const article = await db
      .select()
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);

    if (article.length === 0) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Get topic info
    const topic = await db
      .select({ id: topics.id, name: topics.name, slug: topics.slug })
      .from(topics)
      .where(eq(topics.id, article[0].topicId))
      .limit(1);

    return NextResponse.json({
      ...article[0],
      topic: topic[0] || null,
    });
  } catch (error) {
    return createErrorResponse(error, "Failed to fetch article");
  }
}

/**
 * PUT /api/articles/[id]
 *
 * Update article fields
 * Body: { title?, url?, source?, summary?, imageUrl?, publishedAt? }
 * Requires: X-API-Key header with valid admin API key
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!requireAdminKey(request)) {
    return getUnauthorizedResponse();
  }

  try {
    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid article ID" }, { status: 400 });
    }

    const body = await request.json();

    // Validate request body with Zod
    const validation = validateRequest(articleUpdateSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error },
        { status: 400 }
      );
    }

    const { title, url, source, summary, imageUrl, publishedAt } =
      validation.data;

    // Check if article exists
    const existing = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Build update object dynamically
    const updates: Partial<typeof articles.$inferInsert> = {};
    const fieldsUpdated: string[] = [];

    if (title !== undefined) {
      updates.title = title;
      fieldsUpdated.push("title");
    }
    if (url !== undefined) {
      updates.url = url;
      fieldsUpdated.push("url");
    }
    if (source !== undefined) {
      updates.source = source;
      fieldsUpdated.push("source");
    }
    if (summary !== undefined) {
      updates.summary = summary;
      fieldsUpdated.push("summary");
    }
    if (imageUrl !== undefined) {
      updates.imageUrl = imageUrl;
      fieldsUpdated.push("imageUrl");
    }
    if (publishedAt !== undefined) {
      updates.publishedAt = publishedAt ? new Date(publishedAt) : null;
      fieldsUpdated.push("publishedAt");
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // Perform update
    await db.update(articles).set(updates).where(eq(articles.id, id));

    // Get updated article
    const updatedArticle = await db
      .select()
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);

    // Log successful article update
    await logSuccess(request, "update_article", {
      articleId: id,
      fieldsUpdated,
    });

    return NextResponse.json({
      success: true,
      article: updatedArticle[0],
    });
  } catch (error) {
    await logFailure(
      request,
      "update_article",
      error instanceof Error ? error.message : "Unknown error"
    );
    return createErrorResponse(error, "Failed to update article");
  }
}

/**
 * DELETE /api/articles/[id]
 * Requires: X-API-Key header with valid admin API key
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!requireAdminKey(request)) {
    return getUnauthorizedResponse();
  }

  try {
    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid article ID" }, { status: 400 });
    }

    // Get article to find topic_id
    const article = await db
      .select({ topicId: articles.topicId })
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);

    if (article.length === 0) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const topicId = article[0].topicId;

    // Delete the article
    await db.delete(articles).where(eq(articles.id, id));

    // Update topic article count
    const countResult = await db
      .select({ count: count() })
      .from(articles)
      .where(eq(articles.topicId, topicId));
    const articleCount = countResult[0]?.count || 0;

    await db
      .update(topics)
      .set({ articleCount })
      .where(eq(topics.id, topicId));

    // Log successful article deletion
    await logSuccess(request, "delete_article", {
      articleId: id,
      topicId,
    });

    return NextResponse.json({
      success: true,
      message: "Article deleted",
    });
  } catch (error) {
    await logFailure(
      request,
      "delete_article",
      error instanceof Error ? error.message : "Unknown error"
    );
    return createErrorResponse(error, "Failed to delete article");
  }
}
