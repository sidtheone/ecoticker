import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();

  const rows = db.prepare(`
    SELECT name, slug, current_score, previous_score,
      (current_score - previous_score) as change,
      urgency
    FROM topics
    WHERE current_score != previous_score
    ORDER BY ABS(current_score - previous_score) DESC
    LIMIT 5
  `).all() as Record<string, unknown>[];

  const movers = rows.map((r) => ({
    name: r.name,
    slug: r.slug,
    currentScore: r.current_score,
    previousScore: r.previous_score,
    change: r.change,
    urgency: r.urgency,
  }));

  return NextResponse.json({ movers });
}
