import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { requireAdminKey, getUnauthorizedResponse } from "@/lib/auth";
import { createErrorResponse } from "@/lib/errors";
import { logSuccess, logFailure } from "@/lib/audit-log";
import { runBatchPipeline } from "@/lib/batch-pipeline";

/**
 * Batch processing endpoint — delegates to runBatchPipeline().
 *
 * Requires GNEWS_API_KEY, OPENROUTER_API_KEY, and ADMIN_API_KEY env vars.
 */
export async function POST(request: NextRequest) {
  if (!requireAdminKey(request)) {
    return getUnauthorizedResponse();
  }

  try {
    const gnewsApiKey = process.env.GNEWS_API_KEY || "";
    const openRouterApiKey = process.env.OPENROUTER_API_KEY || "";

    if (!gnewsApiKey || !openRouterApiKey) {
      return NextResponse.json(
        {
          error: "Missing API keys",
          details:
            "GNEWS_API_KEY and OPENROUTER_API_KEY must be set in environment variables",
        },
        { status: 500 }
      );
    }

    const result = await runBatchPipeline({ mode: "daily", db });

    await logSuccess(request, "batch_process", {
      topicsProcessed: result.topicsProcessed,
      articlesAdded: result.articlesAdded,
      scoresRecorded: result.scoresRecorded,
      totalTopics: result.totalTopics,
      totalArticles: result.totalArticles,
    });

    return NextResponse.json({
      success: true,
      message:
        result.topicsProcessed === 0
          ? "No new articles found"
          : "Batch processing completed successfully",
      stats: {
        topicsProcessed: result.topicsProcessed,
        articlesAdded: result.articlesAdded,
        scoresRecorded: result.scoresRecorded,
        totalTopics: result.totalTopics,
        totalArticles: result.totalArticles,
        gnewsArticles: result.gnewsArticles,
        rssArticles: result.rssArticles,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logFailure(
      request,
      "batch_process",
      error instanceof Error ? error.message : "Unknown error"
    );
    return createErrorResponse(error, "Batch processing failed");
  }
}
