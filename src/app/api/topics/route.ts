import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const db = getDb();
  const urgency = request.nextUrl.searchParams.get("urgency");
  const category = request.nextUrl.searchParams.get("category");

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

  const rows = db.prepare(query).all(...params) as Record<string, unknown>[];

  const sparklineStmt = db.prepare(
    `SELECT score FROM score_history WHERE topic_id = ? ORDER BY recorded_at DESC LIMIT 7`
  );

  const topics = rows.map((r) => {
    const history = sparklineStmt.all(r.id as number) as { score: number }[];
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
      sparkline: history.map((h) => h.score).reverse(),
    };
  });

  return NextResponse.json({ topics });
}
