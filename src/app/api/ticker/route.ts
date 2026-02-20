import { NextResponse } from "next/server";
import { db } from "@/db";
import { topics } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        name: topics.name,
        slug: topics.slug,
        score: topics.currentScore,
        change: sql<number>`${topics.currentScore} - ${topics.previousScore}`,
      })
      .from(topics)
      .orderBy(desc(topics.currentScore))
      .limit(15);

    return NextResponse.json(
      { items: rows },
      {
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching ticker data:", error);
    return NextResponse.json(
      { error: "Failed to fetch ticker data" },
      { status: 500 }
    );
  }
}
