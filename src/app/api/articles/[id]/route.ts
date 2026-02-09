import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
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

    await initDb();
    const pool = getDb();
    const { rows: [article] } = await pool.query('SELECT * FROM articles WHERE id = $1', [id]);

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const { rows: [topic] } = await pool.query('SELECT id, name, slug FROM topics WHERE id = $1', [article.topic_id]);

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

    const validation = validateRequest(articleUpdateSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error },
        { status: 400 }
      );
    }

    const { title, url, source, summary, imageUrl, publishedAt } = validation.data;

    await initDb();
    const pool = getDb();

    const { rows: [existing] } = await pool.query('SELECT id FROM articles WHERE id = $1', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(title);
    }
    if (url !== undefined) {
      updates.push(`url = $${paramIndex++}`);
      params.push(url);
    }
    if (source !== undefined) {
      updates.push(`source = $${paramIndex++}`);
      params.push(source);
    }
    if (summary !== undefined) {
      updates.push(`summary = $${paramIndex++}`);
      params.push(summary);
    }
    if (imageUrl !== undefined) {
      updates.push(`image_url = $${paramIndex++}`);
      params.push(imageUrl);
    }
    if (publishedAt !== undefined) {
      updates.push(`published_at = $${paramIndex++}`);
      params.push(publishedAt);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    params.push(id);
    await pool.query(`UPDATE articles SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params);

    const { rows: [article] } = await pool.query('SELECT * FROM articles WHERE id = $1', [id]);

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

    await initDb();
    const pool = getDb();

    const { rows: [article] } = await pool.query('SELECT topic_id FROM articles WHERE id = $1', [id]);
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    await pool.query('DELETE FROM articles WHERE id = $1', [id]);

    const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) as count FROM articles WHERE topic_id = $1', [article.topic_id]);
    await pool.query('UPDATE topics SET article_count = $1 WHERE id = $2', [parseInt(count), article.topic_id]);

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
