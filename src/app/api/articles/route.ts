import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * Articles CRUD API
 *
 * GET /api/articles - List all articles with optional filtering
 * POST /api/articles - Create new article (admin only)
 * DELETE /api/articles - Batch delete articles by IDs or filter
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
    const topicId = searchParams.get('topicId');
    const source = searchParams.get('source');
    const urlPattern = searchParams.get('url');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    const db = getDb();

    // Build dynamic query
    const conditions: string[] = [];
    const params: any[] = [];

    if (topicId) {
      conditions.push('topic_id = ?');
      params.push(topicId);
    }

    if (source) {
      conditions.push('source = ?');
      params.push(source);
    }

    if (urlPattern) {
      conditions.push('url LIKE ?');
      params.push(urlPattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT * FROM articles
      ${whereClause}
      ORDER BY published_at DESC, fetched_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const articles = db.prepare(query).all(...params) as Article[];

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM articles ${whereClause}`;
    const countParams = params.slice(0, -2); // Remove limit and offset
    const { total } = db.prepare(countQuery).get(...countParams) as { total: number };

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
    console.error('Failed to fetch articles:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch articles',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/articles
 *
 * Create a new article
 * Body: { topicId, title, url, source?, summary?, imageUrl?, publishedAt? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { topicId, title, url, source, summary, imageUrl, publishedAt } = body;

    // Validation
    if (!topicId || !title || !url) {
      return NextResponse.json(
        { error: 'Missing required fields: topicId, title, url' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if topic exists
    const topic = db.prepare('SELECT id FROM topics WHERE id = ?').get(topicId);
    if (!topic) {
      return NextResponse.json(
        { error: 'Topic not found' },
        { status: 404 }
      );
    }

    // Insert article (OR IGNORE to handle duplicate URLs)
    const result = db.prepare(`
      INSERT OR IGNORE INTO articles (topic_id, title, url, source, summary, image_url, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(topicId, title, url, source || null, summary || null, imageUrl || null, publishedAt || null);

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Article with this URL already exists' },
        { status: 409 }
      );
    }

    // Get the created article
    const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(result.lastInsertRowid) as Article;

    // Update topic article count
    db.prepare('UPDATE topics SET article_count = article_count + 1 WHERE id = ?').run(topicId);

    return NextResponse.json({
      success: true,
      article,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create article:', error);
    return NextResponse.json(
      {
        error: 'Failed to create article',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
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
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, url, topicId, source } = body;

    if (!ids && !url && !topicId && !source) {
      return NextResponse.json(
        { error: 'Must provide one of: ids, url, topicId, or source' },
        { status: 400 }
      );
    }

    const db = getDb();
    let deletedCount = 0;
    const affectedTopics = new Set<number>();

    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Delete by IDs
      const placeholders = ids.map(() => '?').join(',');

      // Get topic IDs before deleting
      const articles = db.prepare(`SELECT topic_id FROM articles WHERE id IN (${placeholders})`).all(...ids) as { topic_id: number }[];
      articles.forEach(a => affectedTopics.add(a.topic_id));

      const result = db.prepare(`DELETE FROM articles WHERE id IN (${placeholders})`).run(...ids);
      deletedCount = result.changes;
    } else if (url) {
      // Delete by URL pattern
      const articles = db.prepare('SELECT topic_id FROM articles WHERE url LIKE ?').all(url) as { topic_id: number }[];
      articles.forEach(a => affectedTopics.add(a.topic_id));

      const result = db.prepare('DELETE FROM articles WHERE url LIKE ?').run(url);
      deletedCount = result.changes;
    } else if (topicId) {
      // Delete by topic ID
      affectedTopics.add(topicId);
      const result = db.prepare('DELETE FROM articles WHERE topic_id = ?').run(topicId);
      deletedCount = result.changes;
    } else if (source) {
      // Delete by source
      const articles = db.prepare('SELECT topic_id FROM articles WHERE source = ?').all(source) as { topic_id: number }[];
      articles.forEach(a => affectedTopics.add(a.topic_id));

      const result = db.prepare('DELETE FROM articles WHERE source = ?').run(source);
      deletedCount = result.changes;
    }

    // Update article counts for affected topics
    for (const topicId of affectedTopics) {
      const count = db.prepare('SELECT COUNT(*) as count FROM articles WHERE topic_id = ?').get(topicId) as { count: number };
      db.prepare('UPDATE topics SET article_count = ? WHERE id = ?').run(count.count, topicId);
    }

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      affectedTopics: Array.from(affectedTopics).length,
      message: `Deleted ${deletedCount} article(s)`,
    });
  } catch (error) {
    console.error('Failed to delete articles:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete articles',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
