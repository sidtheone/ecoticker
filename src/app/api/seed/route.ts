import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import slugify from 'slugify';
import { requireAdminKey, getUnauthorizedResponse } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { logSuccess, logFailure } from '@/lib/audit-log';

/**
 * Simple seed endpoint - creates demo data without external dependencies
 * Requires: X-API-Key header with valid admin API key
 */
export async function POST(request: NextRequest) {
  if (!requireAdminKey(request)) {
    return getUnauthorizedResponse();
  }

  try {
    const db = getDb();

    console.log('Seeding database with demo data...');

    // Clear existing seed data to make this operation idempotent
    // This removes all topics (and cascades to articles/scores via FK constraints)
    // Note: This only works if ON DELETE CASCADE is set, otherwise we delete selectively
    const existingTopicsCount = db.prepare('SELECT COUNT(*) as count FROM topics').get() as { count: number };
    if (existingTopicsCount.count > 0) {
      console.log(`Clearing ${existingTopicsCount.count} existing topics...`);
      // Delete in reverse FK order to avoid constraint errors
      db.prepare('DELETE FROM topic_keywords').run();
      db.prepare('DELETE FROM score_history').run();
      db.prepare('DELETE FROM articles').run();
      db.prepare('DELETE FROM topics').run();
    }

    // Sample topics
    const topics = [
      {
        name: 'Delhi Air Quality Crisis',
        category: 'air_quality',
        currentScore: 85,
        previousScore: 78,
        urgency: 'breaking',
        impactSummary: 'Severe air pollution affecting millions in Delhi NCR region',
      },
      {
        name: 'Amazon Deforestation Accelerates',
        category: 'deforestation',
        currentScore: 78,
        previousScore: 72,
        urgency: 'critical',
        impactSummary: 'Deforestation rates reach highest levels in over a decade',
      },
      {
        name: 'Pacific Ocean Plastic Crisis',
        category: 'ocean',
        currentScore: 72,
        previousScore: 70,
        urgency: 'critical',
        impactSummary: 'Great Pacific Garbage Patch continues to expand',
      },
      {
        name: 'European Heat Wave 2026',
        category: 'climate',
        currentScore: 68,
        previousScore: 55,
        urgency: 'critical',
        impactSummary: 'Record-breaking temperatures across Southern Europe',
      },
      {
        name: 'Industrial Pollution in China',
        category: 'pollution',
        currentScore: 65,
        previousScore: 67,
        urgency: 'moderate',
        impactSummary: 'Heavy industrial emissions continue in major manufacturing regions',
      },
      {
        name: 'Coral Bleaching Great Barrier Reef',
        category: 'ocean',
        currentScore: 62,
        previousScore: 58,
        urgency: 'moderate',
        impactSummary: 'Fourth mass bleaching event threatens reef ecosystem',
      },
      {
        name: 'California Wildfire Season',
        category: 'climate',
        currentScore: 58,
        previousScore: 45,
        urgency: 'moderate',
        impactSummary: 'Early onset wildfire season threatens communities',
      },
      {
        name: 'Southeast Asian Flooding',
        category: 'climate',
        currentScore: 54,
        previousScore: 52,
        urgency: 'moderate',
        impactSummary: 'Monsoon rains cause widespread flooding and displacement',
      },
      {
        name: 'Arctic Sea Ice Decline',
        category: 'climate',
        currentScore: 48,
        previousScore: 50,
        urgency: 'moderate',
        impactSummary: 'Summer ice extent reaches near-record lows',
      },
      {
        name: 'Renewable Energy Growth',
        category: 'energy',
        currentScore: 25,
        previousScore: 30,
        urgency: 'informational',
        impactSummary: 'Solar and wind capacity additions set new records',
      },
    ];

    const insertTopic = db.prepare(`
      INSERT INTO topics (
        name, slug, category, region, current_score, previous_score,
        urgency, impact_summary, article_count, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(slug) DO UPDATE SET
        current_score = excluded.current_score,
        previous_score = excluded.previous_score,
        urgency = excluded.urgency,
        impact_summary = excluded.impact_summary,
        article_count = excluded.article_count,
        updated_at = datetime('now')
    `);

    const insertArticle = db.prepare(`
      INSERT OR IGNORE INTO articles (
        topic_id, title, url, source, summary, published_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now', '-' || ? || ' hours'))
    `);

    const insertScore = db.prepare(`
      INSERT INTO score_history (
        topic_id, score, health_score, eco_score, econ_score,
        impact_summary, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, date('now', '-' || ? || ' days'))
    `);

    let topicCount = 0;
    let articleCount = 0;
    let scoreCount = 0;

    for (const topic of topics) {
      const slug = slugify(topic.name, { lower: true, strict: true });

      insertTopic.run(
        topic.name,
        slug,
        topic.category,
        'Global',
        topic.currentScore,
        topic.previousScore,
        topic.urgency,
        topic.impactSummary,
        4, // article_count
      );
      topicCount++;

      const topicRow = db.prepare('SELECT id FROM topics WHERE slug = ?').get(slug) as { id: number } | undefined;
      if (!topicRow) continue;

      // Add sample articles
      for (let i = 0; i < 4; i++) {
        insertArticle.run(
          topicRow.id,
          `${topic.name} - Update ${i + 1}`,
          `https://example.com/article-${slug}-${i}`,
          i % 2 === 0 ? 'Reuters' : 'Associated Press',
          `Latest developments regarding ${topic.name.toLowerCase()}`,
          i * 6, // hours ago
        );
        articleCount++;
      }

      // Add score history (last 7 days)
      for (let day = 6; day >= 0; day--) {
        const variance = Math.floor(Math.random() * 10) - 5;
        const score = Math.max(0, Math.min(100, topic.currentScore + variance));

        insertScore.run(
          topicRow.id,
          score,
          Math.max(0, 100 - score), // health_score (inverse of overall score)
          score, // eco_score
          Math.max(0, score - 10), // econ_score
          topic.impactSummary,
          day,
        );
        scoreCount++;
      }
    }

    // Log successful seed operation
    logSuccess(request, 'seed_database', {
      topicsCreated: topicCount,
      articlesCreated: articleCount,
      scoresCreated: scoreCount,
    });

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      stats: {
        topics: topicCount,
        articles: articleCount,
        scoreHistory: scoreCount,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logFailure(request, 'seed_database', error instanceof Error ? error.message : 'Unknown error');
    return createErrorResponse(error, 'Failed to seed database');
  }
}
