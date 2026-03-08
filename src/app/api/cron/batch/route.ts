import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { POST as seedPOST } from "@/app/api/seed/route";
import { runBatchPipeline } from "@/lib/batch-pipeline";

/**
 * Cron endpoint for triggering the batch job.
 *
 * Usage:
 *   GET https://your-app.railway.app/api/cron/batch
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Behavior:
 * - If GNEWS_API_KEY and OPENROUTER_API_KEY are set: runs real batch pipeline
 * - Otherwise: seeds database with demo data (fallback)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET not set in environment variables");
    return NextResponse.json({ error: "Service misconfigured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn("Unauthorized cron job attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("Starting batch job via cron endpoint...");
    const startTime = Date.now();

    const hasApiKeys = process.env.GNEWS_API_KEY && process.env.OPENROUTER_API_KEY;

    if (hasApiKeys) {
      console.log("API keys detected - using real batch processing");
      const result = await runBatchPipeline({ mode: "daily", db });
      const duration = Date.now() - startTime;
      console.log(`Batch job completed in ${duration}ms`);

      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        durationMs: duration,
        mode: "real-data",
        stats: {
          topicsProcessed: result.topicsProcessed,
          articlesAdded: result.articlesAdded,
          scoresRecorded: result.scoresRecorded,
          totalTopics: result.totalTopics,
          totalArticles: result.totalArticles,
          gnewsArticles: result.gnewsArticles,
          rssArticles: result.rssArticles,
        },
        message: "Batch processing completed successfully",
      });
    }

    // No API keys — seed fallback
    console.log("No API keys - using demo seed data");
    const seedRequest = new NextRequest(new URL("/api/seed", request.url), {
      method: "POST",
      headers: { "x-api-key": process.env.ADMIN_API_KEY || "" },
    });
    const response = await seedPOST(seedRequest);
    const data = await response.json();
    const duration = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(data.error || "Seed endpoint failed");
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs: duration,
      mode: "demo-data",
      stats: data.stats,
      message: data.message,
    });
  } catch (error) {
    console.error("Batch job failed:", error);
    return NextResponse.json(
      {
        error: "Batch job failed",
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for manual trigger with optional parameters.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const force = body.force === true;
    console.log(`Manual batch job trigger (force: ${force})`);

    const hasApiKeys = process.env.GNEWS_API_KEY && process.env.OPENROUTER_API_KEY;

    if (hasApiKeys) {
      const result = await runBatchPipeline({ mode: "daily", db });
      return NextResponse.json({
        success: true,
        timestamp: new Date().toISOString(),
        manual: true,
        mode: "real-data",
        stats: {
          topicsProcessed: result.topicsProcessed,
          articlesAdded: result.articlesAdded,
          scoresRecorded: result.scoresRecorded,
          totalTopics: result.totalTopics,
          totalArticles: result.totalArticles,
        },
        message: "Batch processing completed successfully",
      });
    }

    const seedRequest = new NextRequest(new URL("/api/seed", request.url), {
      method: "POST",
      headers: { "x-api-key": process.env.ADMIN_API_KEY || "" },
    });
    const response = await seedPOST(seedRequest);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Seed endpoint failed");
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      manual: true,
      mode: "demo-data",
      stats: data.stats,
      message: data.message,
    });
  } catch (error) {
    console.error("Manual batch job failed:", error);
    return NextResponse.json(
      {
        error: "Batch job failed",
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
