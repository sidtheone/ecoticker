import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb, buildInClause } from '@/lib/db';
import { requireAdminKey, getUnauthorizedResponse } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { logSuccess, logFailure } from '@/lib/audit-log';

/**
 * Cleanup endpoint - removes demo/seed data, keeps only real news
 */
export async function POST(request: NextRequest) {
  if (!requireAdminKey(request)) {
    return getUnauthorizedResponse();
  }
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    await initDb();
    const pool = getDb();

    // Find demo topics
    const { rows: demoTopics } = await pool.query(
      'SELECT id, name, article_count FROM topics WHERE article_count = 4'
    );

    // Also find articles from example.com
    const { rows: demoArticles } = await pool.query(
      "SELECT id, title, topic_id FROM articles WHERE url LIKE '%example.com%'"
    );

    // Get topic IDs from demo articles
    const demoTopicIds = new Set<number>(demoArticles.map((a: { topic_id: number }) => a.topic_id));
    demoTopics.forEach((t: { id: number }) => demoTopicIds.add(t.id));

    const topicIdsToDelete = Array.from(demoTopicIds);

    if (dryRun) {
      if (topicIdsToDelete.length === 0) {
        return NextResponse.json({
          dryRun: true,
          preview: { topicsToDelete: [], articleCount: 0, message: 'No demo data found' },
        });
      }

      const { placeholders } = buildInClause(topicIdsToDelete);
      const { rows: topicsToDelete } = await pool.query(
        `SELECT id, name, article_count FROM topics WHERE id IN (${placeholders})`,
        topicIdsToDelete
      );

      const { rows: [articlesCount] } = await pool.query(
        `SELECT COUNT(*) as count FROM articles WHERE topic_id IN (${placeholders})`,
        topicIdsToDelete
      );

      return NextResponse.json({
        dryRun: true,
        preview: {
          topicsToDelete,
          articleCount: parseInt(articlesCount.count),
          message: 'Add ?dryRun=false or call without dryRun to actually delete',
        },
      });
    }

    if (topicIdsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No demo data found to delete',
        deleted: { topics: 0, articles: 0, scores: 0, keywords: 0 },
      });
    }

    const { placeholders } = buildInClause(topicIdsToDelete);
    const keywordsDeleted = await pool.query(`DELETE FROM topic_keywords WHERE topic_id IN (${placeholders})`, topicIdsToDelete);
    const scoresDeleted = await pool.query(`DELETE FROM score_history WHERE topic_id IN (${placeholders})`, topicIdsToDelete);
    const articlesDeleted = await pool.query(`DELETE FROM articles WHERE topic_id IN (${placeholders})`, topicIdsToDelete);
    const topicsDeleted = await pool.query(`DELETE FROM topics WHERE id IN (${placeholders})`, topicIdsToDelete);

    const { rows: [remainingTopicsRow] } = await pool.query('SELECT COUNT(*) as count FROM topics');
    const { rows: [remainingArticlesRow] } = await pool.query('SELECT COUNT(*) as count FROM articles');

    logSuccess(request, 'cleanup_data', {
      topicsDeleted: topicsDeleted.rowCount,
      articlesDeleted: articlesDeleted.rowCount,
      scoresDeleted: scoresDeleted.rowCount,
      keywordsDeleted: keywordsDeleted.rowCount,
    });

    return NextResponse.json({
      success: true,
      message: 'Demo data cleaned up successfully',
      deleted: {
        topics: topicsDeleted.rowCount,
        articles: articlesDeleted.rowCount,
        scores: scoresDeleted.rowCount,
        keywords: keywordsDeleted.rowCount,
      },
      remaining: {
        topics: parseInt(remainingTopicsRow.count),
        articles: parseInt(remainingArticlesRow.count),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logFailure(request, 'cleanup_data', error instanceof Error ? error.message : 'Unknown error');
    return createErrorResponse(error, 'Cleanup operation failed');
  }
}
