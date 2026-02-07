import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { MoverRow } from "@/lib/types";

export async function GET() {
  try {
    const db = getDb();

    const rows = db.prepare(`
      SELECT name, slug, current_score, previous_score,
        (current_score - previous_score) as change,
        urgency
      FROM topics
      WHERE current_score != previous_score
      ORDER BY ABS(current_score - previous_score) DESC
      LIMIT 5
    `).all() as MoverRow[];

    const movers = rows.map((r) => ({
      name: r.name,
      slug: r.slug,
      currentScore: r.current_score,
      previousScore: r.previous_score,
      change: r.change,
      urgency: r.urgency,
    }));

    return NextResponse.json({ movers }, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
      }
    });
  } catch (error) {
    console.error('Error fetching movers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch movers' },
      { status: 500 }
    );
  }
}
