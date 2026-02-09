import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import type { TopicRow, ArticleRow, ScoreHistoryRow } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  await initDb();
  const pool = getDb();

  const { rows: topicRows } = await pool.query(`
    SELECT id, name, slug, category, region,
      current_score, previous_score,
      (current_score - previous_score) as change,
      urgency, impact_summary, image_url, article_count, updated_at
    FROM topics WHERE slug = $1
  `, [slug]);

  const topicRow = topicRows[0] as TopicRow | undefined;

  if (!topicRow) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  const { rows: articles } = await pool.query(`
    SELECT id, topic_id, title, url, source, summary, image_url, published_at
    FROM articles WHERE topic_id = $1 ORDER BY published_at DESC
  `, [topicRow.id]);

  const { rows: scoreHistory } = await pool.query(`
    SELECT score, health_score, eco_score, econ_score, impact_summary, recorded_at
    FROM score_history WHERE topic_id = $1 ORDER BY recorded_at ASC
  `, [topicRow.id]);

  return NextResponse.json({
    topic: {
      id: topicRow.id,
      name: topicRow.name,
      slug: topicRow.slug,
      category: topicRow.category,
      region: topicRow.region,
      currentScore: topicRow.current_score,
      previousScore: topicRow.previous_score,
      change: topicRow.change,
      urgency: topicRow.urgency,
      impactSummary: topicRow.impact_summary,
      imageUrl: topicRow.image_url,
      articleCount: topicRow.article_count,
      updatedAt: topicRow.updated_at,
    },
    articles: (articles as ArticleRow[]).map((a) => ({
      id: a.id,
      topicId: a.topic_id,
      title: a.title,
      url: a.url,
      source: a.source,
      summary: a.summary,
      imageUrl: a.image_url,
      publishedAt: a.published_at,
    })),
    scoreHistory: (scoreHistory as ScoreHistoryRow[]).map((s) => ({
      score: s.score,
      healthScore: s.health_score,
      ecoScore: s.eco_score,
      econScore: s.econ_score,
      impactSummary: s.impact_summary,
      date: s.recorded_at,
    })),
  }, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
    }
  });
}
