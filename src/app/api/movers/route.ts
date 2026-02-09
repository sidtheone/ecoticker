import { NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import type { MoverRow } from "@/lib/types";

export async function GET() {
  try {
    await initDb();
    const pool = getDb();

    const { rows } = await pool.query(`
      SELECT name, slug, current_score, previous_score,
        (current_score - previous_score) as change,
        urgency
      FROM topics
      WHERE current_score != previous_score
      ORDER BY ABS(current_score - previous_score) DESC
      LIMIT 5
    `);

    const movers = (rows as MoverRow[]).map((r) => ({
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
