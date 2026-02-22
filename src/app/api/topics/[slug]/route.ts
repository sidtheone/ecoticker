import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { topics } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Drizzle relational query: fetch topic with articles and score history in one go
  const result = await db.query.topics.findFirst({
    where: eq(topics.slug, slug),
    with: {
      articles: {
        orderBy: (articles, { desc }) => [desc(articles.publishedAt)],
      },
      scoreHistory: {
        orderBy: (scoreHistory, { asc }) => [asc(scoreHistory.recordedAt)],
      },
    },
  });

  if (!result) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  }

  // Transform to API response format (camelCase)
  const change = (result.currentScore || 0) - (result.previousScore || 0);

  return NextResponse.json(
    {
      topic: {
        id: result.id,
        name: result.name,
        slug: result.slug,
        category: result.category,
        region: result.region,
        currentScore: result.currentScore,
        previousScore: result.previousScore,
        change,
        urgency: result.urgency,
        impactSummary: result.impactSummary,
        imageUrl: result.imageUrl,
        articleCount: result.articleCount,
        healthScore: result.healthScore,
        ecoScore: result.ecoScore,
        econScore: result.econScore,
        scoreReasoning: result.scoreReasoning,
        hidden: result.hidden,
        updatedAt: result.updatedAt ? new Date(result.updatedAt).toISOString() : null,
      },
      articles: result.articles.map((a) => ({
        id: a.id,
        topicId: a.topicId,
        title: a.title,
        url: a.url,
        source: a.source,
        summary: a.summary,
        imageUrl: a.imageUrl,
        sourceType: a.sourceType ?? "unknown",
        publishedAt: a.publishedAt?.toISOString() || null,
      })),
      scoreHistory: result.scoreHistory.map((s) => ({
        score: s.score,
        healthScore: s.healthScore,
        ecoScore: s.ecoScore,
        econScore: s.econScore,
        impactSummary: s.impactSummary,
        healthLevel: s.healthLevel,
        ecoLevel: s.ecoLevel,
        econLevel: s.econLevel,
        healthReasoning: s.healthReasoning,
        ecoReasoning: s.ecoReasoning,
        econReasoning: s.econReasoning,
        overallSummary: s.overallSummary,
        anomalyDetected: s.anomalyDetected,
        date: s.recordedAt ? new Date(s.recordedAt).toISOString() : null,
      })),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    }
  );
}
