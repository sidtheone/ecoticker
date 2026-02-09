import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
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
    await initDb();
    const pool = getDb();

    console.log('Seeding database with demo data...');

    // Clear existing seed data
    const { rows: [existingTopicsCount] } = await pool.query('SELECT COUNT(*) as count FROM topics');
    if (parseInt(existingTopicsCount.count) > 0) {
      console.log(`Clearing ${existingTopicsCount.count} existing topics...`);
      await pool.query('DELETE FROM topic_keywords');
      await pool.query('DELETE FROM score_history');
      await pool.query('DELETE FROM articles');
      await pool.query('DELETE FROM topics');
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

    let topicCount = 0;
    let articleCount = 0;
    let scoreCount = 0;

    for (const topic of topics) {
      const slug = slugify(topic.name, { lower: true, strict: true });

      await pool.query(`
        INSERT INTO topics (
          name, slug, category, region, current_score, previous_score,
          urgency, impact_summary, article_count, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT(slug) DO UPDATE SET
          current_score = EXCLUDED.current_score,
          previous_score = EXCLUDED.previous_score,
          urgency = EXCLUDED.urgency,
          impact_summary = EXCLUDED.impact_summary,
          article_count = EXCLUDED.article_count,
          updated_at = NOW()
      `, [
        topic.name, slug, topic.category, 'Global',
        topic.currentScore, topic.previousScore,
        topic.urgency, topic.impactSummary, 4
      ]);
      topicCount++;

      const { rows: topicRows } = await pool.query('SELECT id FROM topics WHERE slug = $1', [slug]);
      if (topicRows.length === 0) continue;
      const topicId = topicRows[0].id;

      // Add sample articles
      for (let i = 0; i < 4; i++) {
        await pool.query(`
          INSERT INTO articles (
            topic_id, title, url, source, summary, published_at
          ) VALUES ($1, $2, $3, $4, $5, NOW() - ($6 || ' hours')::INTERVAL)
          ON CONFLICT (url) DO NOTHING
        `, [
          topicId,
          `${topic.name} - Update ${i + 1}`,
          `https://example.com/article-${slug}-${i}`,
          i % 2 === 0 ? 'Reuters' : 'Associated Press',
          `Latest developments regarding ${topic.name.toLowerCase()}`,
          (i * 6).toString()
        ]);
        articleCount++;
      }

      // Add score history (last 7 days)
      for (let day = 6; day >= 0; day--) {
        const variance = Math.floor(Math.random() * 10) - 5;
        const score = Math.max(0, Math.min(100, topic.currentScore + variance));

        await pool.query(`
          INSERT INTO score_history (
            topic_id, score, health_score, eco_score, econ_score,
            impact_summary, recorded_at
          ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE - $7)
        `, [
          topicId,
          score,
          Math.max(0, 100 - score),
          score,
          Math.max(0, score - 10),
          topic.impactSummary,
          day
        ]);
        scoreCount++;
      }
    }

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
