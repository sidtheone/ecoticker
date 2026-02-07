import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { TopicRow } from "@/lib/types";

/**
 * Topics API
 * GET - List topics with optional filtering
 * DELETE - Batch delete topics by IDs
 */

export async function GET(request: NextRequest) {
  const db = getDb();
  const urgency = request.nextUrl.searchParams.get("urgency");
  const category = request.nextUrl.searchParams.get("category");

  const validUrgencies = ["breaking", "critical", "moderate", "informational"];
  if (urgency && !validUrgencies.includes(urgency)) {
    return NextResponse.json({ error: "Invalid urgency value" }, { status: 400 });
  }

  const validCategories = [
    "air_quality", "deforestation", "ocean", "climate", "pollution",
    "biodiversity", "wildlife", "energy", "waste", "water",
  ];
  if (category && !validCategories.includes(category)) {
    return NextResponse.json({ error: "Invalid category value" }, { status: 400 });
  }

  let query = `
    SELECT id, name, slug, category, region,
      current_score, previous_score,
      (current_score - previous_score) as change,
      urgency, impact_summary, image_url, article_count, updated_at
    FROM topics
  `;
  const conditions: string[] = [];
  const params: string[] = [];

  if (urgency) {
    conditions.push("urgency = ?");
    params.push(urgency);
  }
  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY current_score DESC";

  // Single query with LEFT JOIN to fetch topics and sparklines together
  const sparklineQuery = `
    SELECT
      t.id, t.name, t.slug, t.category, t.region,
      t.current_score, t.previous_score,
      (t.current_score - t.previous_score) as change,
      t.urgency, t.impact_summary, t.image_url, t.article_count, t.updated_at,
      GROUP_CONCAT(sh.score) as sparkline_scores
    FROM (${query}) as t
    LEFT JOIN (
      SELECT topic_id, score, recorded_at,
        ROW_NUMBER() OVER (PARTITION BY topic_id ORDER BY recorded_at DESC) as rn
      FROM score_history
    ) sh ON sh.topic_id = t.id AND sh.rn <= 7
    GROUP BY t.id, t.name, t.slug, t.category, t.region,
      t.current_score, t.previous_score, t.urgency,
      t.impact_summary, t.image_url, t.article_count, t.updated_at
    ORDER BY t.current_score DESC
  `;

  const rows = db.prepare(sparklineQuery).all(...params) as TopicRow[];

  const topics = rows.map((r) => {
    const sparklineStr = r.sparkline_scores as string | null;
    const sparkline = sparklineStr
      ? sparklineStr.split(',').map(s => Number(s)).reverse()
      : [];

    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      category: r.category,
      region: r.region,
      currentScore: r.current_score,
      previousScore: r.previous_score,
      change: r.change,
      urgency: r.urgency,
      impactSummary: r.impact_summary,
      imageUrl: r.image_url,
      articleCount: r.article_count,
      updatedAt: r.updated_at,
      sparkline,
    };
  });

  return NextResponse.json({ topics }, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
    }
  });
}

/**
 * DELETE /api/topics
 *
 * Batch delete topics
 * Body: { ids: [1, 2, 3] } - Delete specific topic IDs
 * Body: { articleCount: 0 } - Delete topics with 0 articles
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, articleCount } = body;

    if (!ids && articleCount === undefined) {
      return NextResponse.json(
        { error: 'Must provide either ids array or articleCount filter' },
        { status: 400 }
      );
    }

    const db = getDb();
    let deletedCount = 0;

    if (ids && Array.isArray(ids) && ids.length > 0) {
      // Delete specific topic IDs
      const placeholders = ids.map(() => '?').join(',');

      // Delete in FK order: keywords → scores → articles → topics
      db.prepare(`DELETE FROM topic_keywords WHERE topic_id IN (${placeholders})`).run(...ids);
      db.prepare(`DELETE FROM score_history WHERE topic_id IN (${placeholders})`).run(...ids);
      db.prepare(`DELETE FROM articles WHERE topic_id IN (${placeholders})`).run(...ids);
      const result = db.prepare(`DELETE FROM topics WHERE id IN (${placeholders})`).run(...ids);
      deletedCount = result.changes;
    } else if (articleCount !== undefined) {
      // Delete topics with specific article count
      const topicsToDelete = db.prepare('SELECT id FROM topics WHERE article_count = ?').all(articleCount) as { id: number }[];
      const topicIds = topicsToDelete.map(t => t.id);

      if (topicIds.length > 0) {
        const placeholders = topicIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM topic_keywords WHERE topic_id IN (${placeholders})`).run(...topicIds);
        db.prepare(`DELETE FROM score_history WHERE topic_id IN (${placeholders})`).run(...topicIds);
        db.prepare(`DELETE FROM articles WHERE topic_id IN (${placeholders})`).run(...topicIds);
        const result = db.prepare(`DELETE FROM topics WHERE id IN (${placeholders})`).run(...topicIds);
        deletedCount = result.changes;
      }
    }

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      message: `Deleted ${deletedCount} topic(s)`,
    });
  } catch (error) {
    console.error('Failed to delete topics:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete topics',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
