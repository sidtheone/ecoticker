import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import slugify from 'slugify';

/**
 * Simple seed endpoint - creates demo data without external dependencies
 * No API keys needed, works immediately
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();

    console.log('Seeding database with demo data...');

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
      INSERT OR REPLACE INTO topics (
        name, slug, category, region, current_score, previous_score,
        urgency, impact_summary, article_count, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
    console.error('Seed failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to seed database',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
