import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  topics,
  articles,
  scoreHistory,
  topicKeywords,
} from "@/db/schema";
import slugify from "slugify";
import { requireAdminKey, getUnauthorizedResponse } from "@/lib/auth";
import { createErrorResponse } from "@/lib/errors";
import { logSuccess, logFailure } from "@/lib/audit-log";
import { count, sql } from "drizzle-orm";

/**
 * Simple seed endpoint - creates demo data without external dependencies
 * Requires: X-API-Key header with valid admin API key
 */
export async function POST(request: NextRequest) {
  if (!requireAdminKey(request)) {
    return getUnauthorizedResponse();
  }

  try {
    console.log("Seeding database with demo data...");

    // Clear existing seed data to make this operation idempotent
    const existingTopicsCount = await db.select({ count: count() }).from(topics);
    if (existingTopicsCount[0].count > 0) {
      console.log(`Clearing ${existingTopicsCount[0].count} existing topics...`);
      // Delete in reverse FK order to avoid constraint errors
      await db.delete(topicKeywords);
      await db.delete(scoreHistory);
      await db.delete(articles);
      await db.delete(topics);
    }

    // Sample topics
    const topicsData = [
      {
        name: "Delhi Air Quality Crisis",
        category: "air_quality",
        currentScore: 85,
        previousScore: 78,
        urgency: "breaking",
        impactSummary: "Severe air pollution affecting millions in Delhi NCR region",
      },
      {
        name: "Amazon Deforestation Accelerates",
        category: "deforestation",
        currentScore: 78,
        previousScore: 72,
        urgency: "critical",
        impactSummary: "Deforestation rates reach highest levels in over a decade",
      },
      {
        name: "Pacific Ocean Plastic Crisis",
        category: "ocean",
        currentScore: 72,
        previousScore: 70,
        urgency: "critical",
        impactSummary: "Great Pacific Garbage Patch continues to expand",
      },
      {
        name: "European Heat Wave 2026",
        category: "climate",
        currentScore: 68,
        previousScore: 55,
        urgency: "critical",
        impactSummary: "Record-breaking temperatures across Southern Europe",
      },
      {
        name: "Industrial Pollution in China",
        category: "pollution",
        currentScore: 65,
        previousScore: 67,
        urgency: "moderate",
        impactSummary:
          "Heavy industrial emissions continue in major manufacturing regions",
      },
      {
        name: "Coral Bleaching Great Barrier Reef",
        category: "ocean",
        currentScore: 62,
        previousScore: 58,
        urgency: "moderate",
        impactSummary: "Fourth mass bleaching event threatens reef ecosystem",
      },
      {
        name: "California Wildfire Season",
        category: "climate",
        currentScore: 58,
        previousScore: 45,
        urgency: "moderate",
        impactSummary: "Early onset wildfire season threatens communities",
      },
      {
        name: "Southeast Asian Flooding",
        category: "climate",
        currentScore: 54,
        previousScore: 52,
        urgency: "moderate",
        impactSummary: "Monsoon rains cause widespread flooding and displacement",
      },
      {
        name: "Arctic Sea Ice Decline",
        category: "climate",
        currentScore: 48,
        previousScore: 50,
        urgency: "moderate",
        impactSummary: "Summer ice extent reaches near-record lows",
      },
      {
        name: "Renewable Energy Growth",
        category: "energy",
        currentScore: 25,
        previousScore: 30,
        urgency: "informational",
        impactSummary: "Solar and wind capacity additions set new records",
      },
    ];

    let topicCount = 0;
    let articleCount = 0;
    let scoreCount = 0;

    for (const topicData of topicsData) {
      const slug = slugify(topicData.name, { lower: true, strict: true });

      // Upsert topic
      const inserted = await db
        .insert(topics)
        .values({
          name: topicData.name,
          slug,
          category: topicData.category,
          region: "Global",
          currentScore: topicData.currentScore,
          previousScore: topicData.previousScore,
          urgency: topicData.urgency,
          impactSummary: topicData.impactSummary,
          articleCount: 4,
          healthScore: Math.max(0, 100 - topicData.currentScore),
          ecoScore: topicData.currentScore,
          econScore: Math.max(0, topicData.currentScore - 10),
        })
        .onConflictDoUpdate({
          target: topics.slug,
          set: {
            currentScore: topicData.currentScore,
            previousScore: topicData.previousScore,
            urgency: topicData.urgency,
            impactSummary: topicData.impactSummary,
            articleCount: 4,
            updatedAt: new Date(),
          },
        })
        .returning({ id: topics.id });

      topicCount++;
      const topicId = inserted[0].id;

      // Add sample articles
      for (let i = 0; i < 4; i++) {
        const hoursAgo = i * 6;
        const publishedAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

        await db
          .insert(articles)
          .values({
            topicId,
            title: `${topicData.name} - Update ${i + 1}`,
            url: `https://example.com/article-${slug}-${i}`,
            source: i % 2 === 0 ? "Reuters" : "Associated Press",
            summary: `Latest developments regarding ${topicData.name.toLowerCase()}`,
            sourceType: "seed",
            publishedAt,
          })
          .onConflictDoNothing({ target: articles.url });

        articleCount++;
      }

      // Add score history (last 7 days)
      for (let day = 6; day >= 0; day--) {
        const variance = Math.floor(Math.random() * 10) - 5;
        const score = Math.max(0, Math.min(100, topicData.currentScore + variance));
        const recordedAt = new Date(Date.now() - day * 24 * 60 * 60 * 1000);

        await db.insert(scoreHistory).values({
          topicId,
          score,
          healthScore: Math.max(0, 100 - score),
          ecoScore: score,
          econScore: Math.max(0, score - 10),
          impactSummary: topicData.impactSummary,
          recordedAt: recordedAt.toISOString().split("T")[0], // DATE only
        });

        scoreCount++;
      }
    }

    // Log successful seed operation
    await logSuccess(request, "seed_database", {
      topicsCreated: topicCount,
      articlesCreated: articleCount,
      scoresCreated: scoreCount,
    });

    return NextResponse.json({
      success: true,
      message: "Database seeded successfully",
      stats: {
        topics: topicCount,
        articles: articleCount,
        scoreHistory: scoreCount,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await logFailure(
      request,
      "seed_database",
      error instanceof Error ? error.message : "Unknown error"
    );
    return createErrorResponse(error, "Failed to seed database");
  }
}
