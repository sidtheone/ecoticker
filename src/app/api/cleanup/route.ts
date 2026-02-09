import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdminKey, getUnauthorizedResponse } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { logSuccess, logFailure } from '@/lib/audit-log';

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
    const dryRun = searchParams.get('dryRun') === 'true';

    const db = getDb();

    // Find demo topics (those with exactly 4 articles, characteristic of seed data)
    const demoTopics = db
      .prepare('SELECT id, name, article_count FROM topics WHERE article_count = 4')
      .all() as { id: number; name: string; article_count: number }[];

    // Also find articles from example.com (seed data)
    const demoArticles = db
      .prepare("SELECT id, title, topic_id FROM articles WHERE url LIKE '%example.com%'")
      .all() as { id: number; title: string; topic_id: number }[];

    // Get topic IDs from demo articles
    const demoTopicIds = new Set(demoArticles.map((a) => a.topic_id));
    demoTopics.forEach((t) => demoTopicIds.add(t.id));

    const topicIdsToDelete = Array.from(demoTopicIds);

    if (dryRun) {
      // Preview what will be deleted
      const placeholders = topicIdsToDelete.map(() => '?').join(',');
      const topicsToDelete = db
        .prepare(`SELECT id, name, article_count FROM topics WHERE id IN (${placeholders})`)
        .all(...topicIdsToDelete);

      const articlesCount = db
        .prepare(`SELECT COUNT(*) as count FROM articles WHERE topic_id IN (${placeholders})`)
        .get(...topicIdsToDelete) as { count: number };

      return NextResponse.json({
        dryRun: true,
        preview: {
          topicsToDelete: topicsToDelete,
          articleCount: articlesCount.count,
          message: 'Add ?dryRun=false or call without dryRun to actually delete',
        },
      });
    }

    // Actually delete the demo data
    if (topicIdsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No demo data found to delete',
        deleted: {
          topics: 0,
          articles: 0,
          scores: 0,
          keywords: 0,
        },
      });
    }

    // Delete in reverse FK order using parameterized queries
    const placeholders = topicIdsToDelete.map(() => '?').join(',');
    const keywordsDeleted = db.prepare(`DELETE FROM topic_keywords WHERE topic_id IN (${placeholders})`).run(...topicIdsToDelete);
    const scoresDeleted = db.prepare(`DELETE FROM score_history WHERE topic_id IN (${placeholders})`).run(...topicIdsToDelete);
    const articlesDeleted = db.prepare(`DELETE FROM articles WHERE topic_id IN (${placeholders})`).run(...topicIdsToDelete);
    const topicsDeleted = db.prepare(`DELETE FROM topics WHERE id IN (${placeholders})`).run(...topicIdsToDelete);

    // Get remaining counts
    const remainingTopics = (db.prepare('SELECT COUNT(*) as count FROM topics').get() as { count: number }).count;
    const remainingArticles = (db.prepare('SELECT COUNT(*) as count FROM articles').get() as { count: number }).count;

    // Log successful cleanup
    logSuccess(request, 'cleanup_data', {
      topicsDeleted: topicsDeleted.changes,
      articlesDeleted: articlesDeleted.changes,
      scoresDeleted: scoresDeleted.changes,
      keywordsDeleted: keywordsDeleted.changes,
    });

    return NextResponse.json({
      success: true,
      message: 'Demo data cleaned up successfully',
      deleted: {
        topics: topicsDeleted.changes,
        articles: articlesDeleted.changes,
        scores: scoresDeleted.changes,
        keywords: keywordsDeleted.changes,
      },
      remaining: {
        topics: remainingTopics,
        articles: remainingArticles,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logFailure(request, 'cleanup_data', error instanceof Error ? error.message : 'Unknown error');
    return createErrorResponse(error, 'Cleanup operation failed');
  }
}
