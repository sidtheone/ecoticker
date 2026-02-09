import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb, buildInClause } from '@/lib/db';
import { requireAdminKey, getUnauthorizedResponse } from '@/lib/auth';
import { articleCreateSchema, articleDeleteSchema, validateRequest } from '@/lib/validation';
import { createErrorResponse } from '@/lib/errors';
import { logSuccess, logFailure } from '@/lib/audit-log';

/**
 * Articles CRUD API
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get('topicId');
    const source = searchParams.get('source');
    const urlPattern = searchParams.get('url');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    await initDb();
    const pool = getDb();

    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (topicId) {
      conditions.push(`topic_id = $${paramIndex++}`);
      params.push(topicId);
    }

    if (source) {
      conditions.push(`source = $${paramIndex++}`);
      params.push(source);
    }

    if (urlPattern) {
      conditions.push(`url = $${paramIndex++}`);
      params.push(urlPattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT * FROM articles
      ${whereClause}
      ORDER BY published_at DESC, fetched_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const { rows: articles } = await pool.query(query, params);

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM articles ${whereClause}`;
    const countParams = params.slice(0, -2);
    const { rows: [countRow] } = await pool.query(countQuery, countParams);
    const total = parseInt(countRow.total);

    return NextResponse.json({
      articles,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    return createErrorResponse(error, 'Failed to fetch articles');
  }
}

export async function POST(request: NextRequest) {
  if (!requireAdminKey(request)) {
    return getUnauthorizedResponse();
  }

  try {
    const body = await request.json();

    const validation = validateRequest(articleCreateSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error },
        { status: 400 }
      );
    }

    const { topicId, title, url, source, summary, imageUrl, publishedAt } = validation.data;

    await initDb();
    const pool = getDb();

    // Check if topic exists
    const { rows: topicRows } = await pool.query('SELECT id FROM topics WHERE id = $1', [topicId]);
    if (topicRows.length === 0) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      );
    }

    // Insert article (ON CONFLICT DO NOTHING to handle duplicate URLs)
    const result = await pool.query(`
      INSERT INTO articles (topic_id, title, url, source, summary, image_url, published_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (url) DO NOTHING
      RETURNING *
    `, [topicId, title, url, source || null, summary || null, imageUrl || null, publishedAt || null]);

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Article with this URL already exists' },
        { status: 409 }
      );
    }

    const article = result.rows[0] as Article;

    // Update topic article count
    await pool.query('UPDATE topics SET article_count = article_count + 1 WHERE id = $1', [topicId]);

    logSuccess(request, 'create_article', {
      articleId: article.id,
      topicId,
      title: article.title,
    });

    return NextResponse.json({
      success: true,
      article,
    }, { status: 201 });
  } catch (error) {
    logFailure(request, 'create_article', error instanceof Error ? error.message : 'Unknown error');
    return createErrorResponse(error, 'Failed to create article');
  }
}

export async function DELETE(request: NextRequest) {
  if (!requireAdminKey(request)) {
    return getUnauthorizedResponse();
  }

  try {
    const body = await request.json();

    const validation = validateRequest(articleDeleteSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error },
        { status: 400 }
      );
    }

    const { ids, url, topicId, source } = validation.data;

    await initDb();
    const pool = getDb();
    let deletedCount = 0;
    const affectedTopics = new Set<number>();

    if (ids && Array.isArray(ids) && ids.length > 0) {
      const { placeholders } = buildInClause(ids);

      const { rows: articles } = await pool.query(`SELECT topic_id FROM articles WHERE id IN (${placeholders})`, ids);
      articles.forEach((a: { topic_id: number }) => affectedTopics.add(a.topic_id));

      const result = await pool.query(`DELETE FROM articles WHERE id IN (${placeholders})`, ids);
      deletedCount = result.rowCount ?? 0;
    } else if (url) {
      const { rows: articles } = await pool.query('SELECT topic_id FROM articles WHERE url LIKE $1', [url]);
      articles.forEach((a: { topic_id: number }) => affectedTopics.add(a.topic_id));

      const result = await pool.query('DELETE FROM articles WHERE url LIKE $1', [url]);
      deletedCount = result.rowCount ?? 0;
    } else if (topicId) {
      affectedTopics.add(topicId);
      const result = await pool.query('DELETE FROM articles WHERE topic_id = $1', [topicId]);
      deletedCount = result.rowCount ?? 0;
    } else if (source) {
      const { rows: articles } = await pool.query('SELECT topic_id FROM articles WHERE source = $1', [source]);
      articles.forEach((a: { topic_id: number }) => affectedTopics.add(a.topic_id));

      const result = await pool.query('DELETE FROM articles WHERE source = $1', [source]);
      deletedCount = result.rowCount ?? 0;
    }

    // Update article counts for affected topics
    for (const tid of affectedTopics) {
      const { rows: [countRow] } = await pool.query('SELECT COUNT(*) as count FROM articles WHERE topic_id = $1', [tid]);
      await pool.query('UPDATE topics SET article_count = $1 WHERE id = $2', [parseInt(countRow.count), tid]);
    }

    logSuccess(request, 'delete_articles', {
      deletedCount,
      affectedTopics: Array.from(affectedTopics).length,
      filters: { ids: !!ids, url: !!url, topicId: !!topicId, source: !!source },
    });

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      affectedTopics: Array.from(affectedTopics).length,
      message: `Deleted ${deletedCount} article(s)`,
    });
  } catch (error) {
    logFailure(request, 'delete_articles', error instanceof Error ? error.message : 'Unknown error');
    return createErrorResponse(error, 'Failed to delete articles');
  }
}
