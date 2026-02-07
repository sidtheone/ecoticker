import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * Cleanup endpoint - removes demo/seed data, keeps only real news
 *
 * Identifies demo data by:
 * - Topics with exactly 4 articles (seed script pattern)
 * - Articles from example.com (seed script URLs)
 *
 * Usage: POST /api/cleanup
 * Optional: Add ?dryRun=true to preview what will be deleted
 */
export async function POST(request: NextRequest) {
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
      const topicsToDelete = db
        .prepare(`SELECT id, name, article_count FROM topics WHERE id IN (${topicIdsToDelete.join(',')})`)
        .all();

      const articlesCount = db
        .prepare(`SELECT COUNT(*) as count FROM articles WHERE topic_id IN (${topicIdsToDelete.join(',')})`)
        .get() as { count: number };

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

    const topicIdsList = topicIdsToDelete.join(',');

    // Delete in reverse FK order
    const keywordsDeleted = db.prepare(`DELETE FROM topic_keywords WHERE topic_id IN (${topicIdsList})`).run();
    const scoresDeleted = db.prepare(`DELETE FROM score_history WHERE topic_id IN (${topicIdsList})`).run();
    const articlesDeleted = db.prepare(`DELETE FROM articles WHERE topic_id IN (${topicIdsList})`).run();
    const topicsDeleted = db.prepare(`DELETE FROM topics WHERE id IN (${topicIdsList})`).run();

    // Get remaining counts
    const remainingTopics = (db.prepare('SELECT COUNT(*) as count FROM topics').get() as { count: number }).count;
    const remainingArticles = (db.prepare('SELECT COUNT(*) as count FROM articles').get() as { count: number }).count;

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
    console.error('Cleanup failed:', error);
    return NextResponse.json(
      {
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
