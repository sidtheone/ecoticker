import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb, cascadeDeleteTopics } from "@/lib/db";
import type { TopicRow } from "@/lib/types";
import { requireAdminKey, getUnauthorizedResponse } from "@/lib/auth";
import { topicDeleteSchema, validateRequest } from "@/lib/validation";
import { createErrorResponse } from "@/lib/errors";
import { logSuccess, logFailure } from "@/lib/audit-log";
import { VALID_URGENCIES, VALID_CATEGORIES } from "@/lib/constants";

/**
 * Topics API
 * GET - List topics with optional filtering
 * DELETE - Batch delete topics by IDs (admin only)
 */

export async function GET(request: NextRequest) {
  await initDb();
  const pool = getDb();
  const urgency = request.nextUrl.searchParams.get("urgency");
  const category = request.nextUrl.searchParams.get("category");

  if (urgency && !(VALID_URGENCIES as readonly string[]).includes(urgency)) {
    return NextResponse.json({ error: "Invalid urgency value" }, { status: 400 });
  }

  if (category && !(VALID_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: "Invalid category value" }, { status: 400 });
  }

  let query = `
    SELECT id, name, slug, category, region,
      current_score, previous_score,
      (current_score - previous_score) as change,
      urgency, impact_summary, image_url, article_count, updated_at
    FROM topics
  `;
  const conditions: string[] = [];
  const params: string[] = [];
  let paramIndex = 1;

  if (urgency) {
    conditions.push(`urgency = $${paramIndex++}`);
    params.push(urgency);
  }
  if (category) {
    conditions.push(`category = $${paramIndex++}`);
    params.push(category);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY current_score DESC";

  // Single query with LEFT JOIN to fetch topics and sparklines together
  const sparklineQuery = `
    SELECT
      t.id, t.name, t.slug, t.category, t.region,
      t.current_score, t.previous_score,
      (t.current_score - t.previous_score) as change,
      t.urgency, t.impact_summary, t.image_url, t.article_count, t.updated_at,
      STRING_AGG(sh.score::TEXT, ',') as sparkline_scores
    FROM (${query}) as t
    LEFT JOIN (
      SELECT topic_id, score, recorded_at,
        ROW_NUMBER() OVER (PARTITION BY topic_id ORDER BY recorded_at DESC) as rn
      FROM score_history
    ) sh ON sh.topic_id = t.id AND sh.rn <= 7
    GROUP BY t.id, t.name, t.slug, t.category, t.region,
      t.current_score, t.previous_score, t.urgency,
      t.impact_summary, t.image_url, t.article_count, t.updated_at
    ORDER BY t.current_score DESC
  `;

  const { rows } = await pool.query(sparklineQuery, params);

  const topics = (rows as TopicRow[]).map((r) => {
    const sparklineStr = r.sparkline_scores as string | null;
    const sparkline = sparklineStr
      ? sparklineStr.split(',').map(s => Number(s)).reverse()
      : [];

    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      category: r.category,
      region: r.region,
      currentScore: r.current_score,
      previousScore: r.previous_score,
      change: r.change,
      urgency: r.urgency,
      impactSummary: r.impact_summary,
      imageUrl: r.image_url,
      articleCount: r.article_count,
      updatedAt: r.updated_at,
      sparkline,
    };
  });

  return NextResponse.json({ topics }, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
    }
  });
}

/**
 * DELETE /api/topics
 */
export async function DELETE(request: NextRequest) {
  if (!requireAdminKey(request)) {
    return getUnauthorizedResponse();
  }

  try {
    const body = await request.json();

    const validation = validateRequest(topicDeleteSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error },
        { status: 400 }
      );
    }

    const { ids, articleCount } = validation.data;

    await initDb();
    const pool = getDb();
    let deletedCount = 0;

    if (ids && Array.isArray(ids) && ids.length > 0) {
      deletedCount = await cascadeDeleteTopics(ids);
    } else if (articleCount !== undefined) {
      const { rows: topicsToDelete } = await pool.query('SELECT id FROM topics WHERE article_count = $1', [articleCount]);
      const topicIds = topicsToDelete.map((t: { id: number }) => t.id);
      deletedCount = await cascadeDeleteTopics(topicIds);
    }

    logSuccess(request, 'delete_topics', {
      deletedCount,
      filters: { ids: !!ids, articleCount: articleCount !== undefined },
    });

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      message: `Deleted ${deletedCount} topic(s)`,
    });
  } catch (error) {
    logFailure(request, 'delete_topics', error instanceof Error ? error.message : 'Unknown error');
    return createErrorResponse(error, 'Failed to delete topics');
  }
}
