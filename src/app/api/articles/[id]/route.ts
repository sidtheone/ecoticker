import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * Single Article CRUD
 *
 * GET /api/articles/[id] - Get article by ID
 * PUT /api/articles/[id] - Update article
 * DELETE /api/articles/[id] - Delete article
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
    console.error('Failed to fetch article:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch article',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/articles/[id]
 *
 * Update article fields
 * Body: { title?, url?, source?, summary?, imageUrl?, publishedAt? }
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await context.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid article ID' }, { status: 400 });
    }

    const body = await request.json();
    const { title, url, source, summary, imageUrl, publishedAt } = body;

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

    return NextResponse.json({
      success: true,
      article,
    });
  } catch (error) {
    console.error('Failed to update article:', error);
    return NextResponse.json(
      {
        error: 'Failed to update article',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/articles/[id]
 */
export async function DELETE(
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

    return NextResponse.json({
      success: true,
      message: 'Article deleted',
    });
  } catch (error) {
    console.error('Failed to delete article:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete article',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
