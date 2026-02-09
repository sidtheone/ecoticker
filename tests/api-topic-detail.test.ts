import { createTestDb } from "./test-db";

let pool: any;
let backup: any;

beforeAll(() => {
  const testDb = createTestDb();
  pool = testDb.pool;
  backup = testDb.backup;
});

beforeEach(async () => {
  backup.restore();
  await seedTopicWithDetails();
});

async function seedTopicWithDetails() {
  await pool.query(`
    INSERT INTO topics (name, slug, category, region, current_score, previous_score, urgency, impact_summary, article_count)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, ["Arctic Ice Decline", "arctic-ice-decline", "climate", "Arctic", 85, 79, "breaking", "Sea ice at record lows", 3]);

  const { rows: [{ id: topicId }] } = await pool.query("SELECT id FROM topics WHERE slug = 'arctic-ice-decline'");

  await pool.query("INSERT INTO articles (topic_id, title, url, source, summary, published_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [topicId, "Ice melting fast", "https://example.com/1", "Reuters", "Summary 1", "2026-02-07T10:00:00Z"]);
  await pool.query("INSERT INTO articles (topic_id, title, url, source, summary, published_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [topicId, "Arctic report released", "https://example.com/2", "BBC", "Summary 2", "2026-02-06T08:00:00Z"]);
  await pool.query("INSERT INTO articles (topic_id, title, url, source, summary, published_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [topicId, "Scientists warn", "https://example.com/3", "CNN", "Summary 3", "2026-02-05T12:00:00Z"]);

  await pool.query("INSERT INTO score_history (topic_id, score, health_score, eco_score, econ_score, impact_summary, recorded_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [topicId, 70, 50, 80, 60, "Day 1 summary", "2026-02-05"]);
  await pool.query("INSERT INTO score_history (topic_id, score, health_score, eco_score, econ_score, impact_summary, recorded_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [topicId, 79, 55, 85, 65, "Day 2 summary", "2026-02-06"]);
  await pool.query("INSERT INTO score_history (topic_id, score, health_score, eco_score, econ_score, impact_summary, recorded_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [topicId, 85, 60, 90, 70, "Day 3 summary", "2026-02-07"]);
}

async function getTopicDetail(slug: string) {
  const { rows: topicRows } = await pool.query(`
    SELECT id, name, slug, category, region,
      current_score, previous_score,
      (current_score - previous_score) as change,
      urgency, impact_summary, image_url, article_count, updated_at
    FROM topics WHERE slug = $1
  `, [slug]);

  if (topicRows.length === 0) return null;
  const topicRow = topicRows[0];

  const { rows: articles } = await pool.query(`
    SELECT id, topic_id, title, url, source, summary, image_url, published_at
    FROM articles WHERE topic_id = $1 ORDER BY published_at DESC
  `, [topicRow.id]);

  const { rows: scoreHistory } = await pool.query(`
    SELECT score, health_score, eco_score, econ_score, impact_summary, recorded_at
    FROM score_history WHERE topic_id = $1 ORDER BY recorded_at ASC
  `, [topicRow.id]);

  return { topic: topicRow, articles, scoreHistory };
}

describe("GET /api/topics/[slug] — query logic", () => {
  test("returns topic with correct fields", async () => {
    const result = (await getTopicDetail("arctic-ice-decline"))!;
    expect(result.topic.name).toBe("Arctic Ice Decline");
    expect(result.topic.current_score).toBe(85);
    expect(result.topic.previous_score).toBe(79);
    expect(result.topic.change).toBe(6);
    expect(result.topic.urgency).toBe("breaking");
    expect(result.topic.category).toBe("climate");
    expect(result.topic.region).toBe("Arctic");
  });

  test("returns articles ordered by published_at DESC (newest first)", async () => {
    const result = (await getTopicDetail("arctic-ice-decline"))!;
    expect(result.articles).toHaveLength(3);
    expect(result.articles[0].title).toBe("Ice melting fast");
    expect(result.articles[2].title).toBe("Scientists warn");
  });

  test("returns score history ordered by recorded_at ASC (oldest first)", async () => {
    const result = (await getTopicDetail("arctic-ice-decline"))!;
    expect(result.scoreHistory).toHaveLength(3);
    expect(result.scoreHistory[0].score).toBe(70);
    expect(result.scoreHistory[2].score).toBe(85);
  });

  test("score history includes sub-scores", async () => {
    const result = (await getTopicDetail("arctic-ice-decline"))!;
    const latest = result.scoreHistory[2];
    expect(latest.health_score).toBe(60);
    expect(latest.eco_score).toBe(90);
    expect(latest.econ_score).toBe(70);
    expect(latest.impact_summary).toBe("Day 3 summary");
  });

  test("returns null for non-existent slug", async () => {
    const result = await getTopicDetail("does-not-exist");
    expect(result).toBeNull();
  });

  test("articles include all expected fields", async () => {
    const result = (await getTopicDetail("arctic-ice-decline"))!;
    const article = result.articles[0];
    expect(article.title).toBeDefined();
    expect(article.url).toBeDefined();
    expect(article.source).toBeDefined();
    expect(article.summary).toBeDefined();
    expect(article.published_at).toBeDefined();
  });
});
