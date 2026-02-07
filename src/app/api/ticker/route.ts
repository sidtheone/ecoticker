import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const rows = db.prepare(`
      SELECT name, slug, current_score as score,
        (current_score - previous_score) as change
      FROM topics
      ORDER BY current_score DESC
      LIMIT 15
    `).all() as { name: string; slug: string; score: number; change: number }[];

    return NextResponse.json({ items: rows }, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
      }
    });
  } catch (error) {
    console.error('Error fetching ticker data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ticker data' },
      { status: 500 }
    );
  }
}
