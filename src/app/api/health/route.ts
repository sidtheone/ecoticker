import { NextResponse } from "next/server";
import { db } from "@/db";
import { scoreHistory } from "@/db/schema";
import { max } from "drizzle-orm";

// GET /api/health
// Public endpoint — no auth required (read-only health check)
// Success response shape: { lastBatchAt: string | null, isStale: boolean }
// Error response shape:   { error: string } with HTTP 500
//
// Staleness note: recordedAt is DATE type (day-level granularity).
// Stale = last batch date is more than 1 day behind today (UTC).
// With twice-daily batches (6 AM / 6 PM UTC), same-day data is always fresh.
export async function GET(): Promise<NextResponse> {
  try {
    const result = await db
      .select({ lastBatchAt: max(scoreHistory.recordedAt) })
      .from(scoreHistory);

    // MAX on empty table returns [{ lastBatchAt: null }]; result can also be []
    const lastBatchAt = result[0]?.lastBatchAt ?? null;

    // Stale if no data or last batch is more than 1 day old
    let isStale = lastBatchAt === null;
    if (lastBatchAt !== null) {
      const now = new Date();
      const last = new Date(lastBatchAt + "T00:00:00Z");
      const diffMs = now.getTime() - last.getTime();
      isStale = diffMs > 24 * 60 * 60 * 1000;
    }

    return NextResponse.json({ lastBatchAt, isStale });
  } catch (err) {
    console.error("[/api/health] DB query failed:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
