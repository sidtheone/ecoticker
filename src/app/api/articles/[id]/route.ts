import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdminKey, getUnauthorizedResponse } from '@/lib/auth';
import { articleUpdateSchema, validateRequest } from '@/lib/validation';
import { createErrorResponse } from '@/lib/errors';
import { logSuccess, logFailure } from '@/lib/audit-log';

/**
 * Single Article CRUD
 *
 * GET /api/articles/[id] - Get article by ID
 * PUT /api/articles/[id] - Update article (admin only)
 * DELETE /api/articles/[id] - Delete article (admin only)
 */

interface Article {
  id: number;
  topic_id: number;
  title: string;
  url: string;
  source: string | null;
  summary: string | null;
  image_url: string | null;
  published_at: string | null;
  fetched_at: string;
}

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
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
    }

    const db = getDb();
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id) as Article | undefined;

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Get topic info
    const topic = db.prepare('SELECT id, name, slug FROM topics WHERE id = ?').get(article.topic_id) as {
      id: number;
      name: string;
      slug: string;
    } | undefined;

    return NextResponse.json({
      ...article,
      topic,
    });
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch article');
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
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
    }

    const body = await request.json();

    // Validate request body with Zod
    const validation = validateRequest(articleUpdateSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error },
        { status: 400 }
      );
    }

    const { title, url, source, summary, imageUrl, publishedAt } = validation.data;

    const db = getDb();

    // Check if article exists
    const existing = db.prepare('SELECT id FROM articles WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Build update query dynamically
    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title);
    }
    if (url !== undefined) {
      updates.push('url = ?');
      params.push(url);
    }
    if (source !== undefined) {
      updates.push('source = ?');
      params.push(source);
    }
    if (summary !== undefined) {
      updates.push('summary = ?');
      params.push(summary);
    }
    if (imageUrl !== undefined) {
      updates.push('image_url = ?');
      params.push(imageUrl);
    }
    if (publishedAt !== undefined) {
      updates.push('published_at = ?');
      params.push(publishedAt);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    params.push(id);
    db.prepare(`UPDATE articles SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // Get updated article
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(id) as Article;

    // Log successful article update
    logSuccess(request, 'update_article', {
      articleId: id,
      fieldsUpdated: updates.map(u => u.split(' = ')[0]),
    });

    return NextResponse.json({
      success: true,
      article,
    });
  } catch (error) {
    logFailure(request, 'update_article', error instanceof Error ? error.message : 'Unknown error');
    return createErrorResponse(error, 'Failed to update article');
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
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
    }

    const db = getDb();

    // Get article to find topic_id
    const article = db.prepare('SELECT topic_id FROM articles WHERE id = ?').get(id) as { topic_id: number } | undefined;
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Delete the article
    db.prepare('DELETE FROM articles WHERE id = ?').run(id);

    // Update topic article count
    const count = db.prepare('SELECT COUNT(*) as count FROM articles WHERE topic_id = ?').get(article.topic_id) as { count: number };
    db.prepare('UPDATE topics SET article_count = ? WHERE id = ?').run(count.count, article.topic_id);

    // Log successful article deletion
    logSuccess(request, 'delete_article', {
      articleId: id,
      topicId: article.topic_id,
    });

    return NextResponse.json({
      success: true,
      message: 'Article deleted',
    });
  } catch (error) {
    logFailure(request, 'delete_article', error instanceof Error ? error.message : 'Unknown error');
    return createErrorResponse(error, 'Failed to delete article');
  }
}
