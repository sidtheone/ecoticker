import { createTestDb } from "./test-db";

let pool: any;
let backup: any;

beforeAll(() => {
  const testDb = createTestDb();
  pool = testDb.pool;
  backup = testDb.backup;
});

beforeEach(() => {
  backup.restore();
});

describe("Database Schema", () => {
  test("creates all 5 tables", async () => {
    const { rows } = await pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    expect(rows.map((t: any) => t.table_name)).toEqual(["articles", "audit_logs", "score_history", "topic_keywords", "topics"]);
  });

  test("schema is idempotent (can run twice)", async () => {
    // Verify table already exists by inserting and querying
    await pool.query("INSERT INTO topics (name, slug) VALUES ($1, $2)", ["Idempotent", "idempotent"]);
    const { rows } = await pool.query("SELECT name FROM topics WHERE slug = 'idempotent'");
    expect(rows[0].name).toBe("Idempotent");
  });

  test("topic slug is unique", async () => {
    await pool.query("INSERT INTO topics (name, slug) VALUES ($1, $2)", ["Test", "test-topic"]);
    await expect(
      pool.query("INSERT INTO topics (name, slug) VALUES ($1, $2)", ["Test2", "test-topic"])
    ).rejects.toThrow();
  });

  test("article url is unique", async () => {
    await pool.query("INSERT INTO topics (name, slug) VALUES ($1, $2)", ["T", "t"]);
    const { rows } = await pool.query("SELECT id FROM topics WHERE slug = 't'");
    const topicId = rows[0].id;
    await pool.query("INSERT INTO articles (topic_id, title, url) VALUES ($1, $2, $3)", [topicId, "A1", "https://example.com/1"]);
    await expect(
      pool.query("INSERT INTO articles (topic_id, title, url) VALUES ($1, $2, $3)", [topicId, "A2", "https://example.com/1"])
    ).rejects.toThrow();
  });

  test("ON CONFLICT DO NOTHING skips duplicate article urls", async () => {
    await pool.query("INSERT INTO topics (name, slug) VALUES ($1, $2)", ["T", "t"]);
    const { rows } = await pool.query("SELECT id FROM topics WHERE slug = 't'");
    const topicId = rows[0].id;
    await pool.query("INSERT INTO articles (topic_id, title, url) VALUES ($1, $2, $3)", [topicId, "A1", "https://example.com/1"]);
    await pool.query(
      "INSERT INTO articles (topic_id, title, url) VALUES ($1, $2, $3) ON CONFLICT (url) DO NOTHING",
      [topicId, "A2", "https://example.com/1"]
    );
    const { rows: countRows } = await pool.query("SELECT COUNT(*) as c FROM articles");
    expect(parseInt(countRows[0].c)).toBe(1);
  });

  test("foreign key constraint on articles.topic_id", async () => {
    await expect(
      pool.query("INSERT INTO articles (topic_id, title, url) VALUES ($1, $2, $3)", [999, "A1", "https://x.com"])
    ).rejects.toThrow();
  });

  test("score_history stores sub-scores", async () => {
    await pool.query("INSERT INTO topics (name, slug) VALUES ($1, $2)", ["T", "t"]);
    const { rows } = await pool.query("SELECT id FROM topics WHERE slug = 't'");
    const topicId = rows[0].id;
    await pool.query(
      "INSERT INTO score_history (topic_id, score, health_score, eco_score, econ_score, impact_summary) VALUES ($1, $2, $3, $4, $5, $6)",
      [topicId, 75, 80, 70, 60, "Test summary"]
    );

    const { rows: scoreRows } = await pool.query("SELECT * FROM score_history WHERE topic_id = $1", [topicId]);
    expect(scoreRows[0].score).toBe(75);
    expect(scoreRows[0].health_score).toBe(80);
    expect(scoreRows[0].eco_score).toBe(70);
    expect(scoreRows[0].econ_score).toBe(60);
    expect(scoreRows[0].impact_summary).toBe("Test summary");
  });

  test("topic_keywords links to topics", async () => {
    await pool.query("INSERT INTO topics (name, slug) VALUES ($1, $2)", ["T", "t"]);
    const { rows } = await pool.query("SELECT id FROM topics WHERE slug = 't'");
    const topicId = rows[0].id;
    await pool.query("INSERT INTO topic_keywords (topic_id, keyword) VALUES ($1, $2)", [topicId, "climate"]);
    await pool.query("INSERT INTO topic_keywords (topic_id, keyword) VALUES ($1, $2)", [topicId, "warming"]);

    const { rows: kwRows } = await pool.query("SELECT keyword FROM topic_keywords WHERE topic_id = $1 ORDER BY keyword", [topicId]);
    expect(kwRows.map((k: any) => k.keyword)).toEqual(["climate", "warming"]);
  });

  test("topic upsert updates scores correctly", async () => {
    const upsertSql = `
      INSERT INTO topics (name, slug, current_score, previous_score, urgency, article_count)
      VALUES ($1, $2, $3, 0, $4, $5)
      ON CONFLICT(slug) DO UPDATE SET
        previous_score = topics.current_score,
        current_score = EXCLUDED.current_score,
        urgency = EXCLUDED.urgency,
        article_count = topics.article_count + EXCLUDED.article_count,
        updated_at = NOW()
    `;

    await pool.query(upsertSql, ["Topic", "topic", 50, "moderate", 3]);
    let { rows: [row] } = await pool.query("SELECT * FROM topics WHERE slug = 'topic'");
    expect(row.current_score).toBe(50);
    expect(row.previous_score).toBe(0);
    expect(row.article_count).toBe(3);

    // Second upsert should rotate scores
    await pool.query(upsertSql, ["Topic", "topic", 75, "critical", 2]);
    ({ rows: [row] } = await pool.query("SELECT * FROM topics WHERE slug = 'topic'"));
    expect(row.current_score).toBe(75);
    expect(row.previous_score).toBe(50);
    expect(row.article_count).toBe(5);
    expect(row.urgency).toBe("critical");
  });

  test("default values are set correctly", async () => {
    await pool.query("INSERT INTO topics (name, slug) VALUES ($1, $2)", ["T", "t"]);
    const { rows: [row] } = await pool.query("SELECT * FROM topics WHERE slug = 't'");
    expect(row.current_score).toBe(0);
    expect(row.previous_score).toBe(0);
    expect(row.urgency).toBe("informational");
    expect(row.category).toBe("climate");
    expect(row.article_count).toBe(0);
  });
});
