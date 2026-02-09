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

async function seedTopics() {
  const insert = "INSERT INTO topics (name, slug, current_score, previous_score, urgency, category, region) VALUES ($1, $2, $3, $4, $5, $6, $7)";
  await pool.query(insert, ["Arctic Ice", "arctic-ice", 85, 79, "breaking", "climate", "Arctic"]);
  await pool.query(insert, ["Amazon Fires", "amazon-fires", 72, 65, "critical", "deforestation", "South America"]);
  await pool.query(insert, ["Ocean Warming", "ocean-warming", 45, 50, "moderate", "climate", "Global"]);
  await pool.query(insert, ["Coral Bleaching", "coral-bleaching", 20, 22, "informational", "biodiversity", "Pacific"]);
}

async function queryTopics(urgency?: string, category?: string) {
  let sql = `
    SELECT t.id, t.name, t.slug, t.current_score, t.previous_score,
      (t.current_score - t.previous_score) as change,
      t.urgency, t.category, t.region, t.impact_summary, t.image_url,
      t.article_count, t.updated_at
    FROM topics t
  `;
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (urgency) {
    conditions.push(`t.urgency = $${paramIndex++}`);
    params.push(urgency);
  }
  if (category) {
    conditions.push(`t.category = $${paramIndex++}`);
    params.push(category);
  }
  if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY t.current_score DESC";

  const { rows } = await pool.query(sql, params);
  return rows;
}

describe("GET /api/topics — query logic", () => {
  test("returns topics sorted by score descending", async () => {
    await seedTopics();
    const rows = await queryTopics();
    expect(rows).toHaveLength(4);
    expect(rows[0].name).toBe("Arctic Ice");
    expect(rows[3].name).toBe("Coral Bleaching");
  });

  test("filters by urgency", async () => {
    await seedTopics();
    const rows = await queryTopics("breaking");
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe("arctic-ice");
  });

  test("filters by category", async () => {
    await seedTopics();
    const rows = await queryTopics(undefined, "climate");
    expect(rows).toHaveLength(2);
    expect(rows.map((r: any) => r.slug)).toContain("arctic-ice");
    expect(rows.map((r: any) => r.slug)).toContain("ocean-warming");
  });

  test("computes change field", async () => {
    await seedTopics();
    const rows = await queryTopics();
    const arctic = rows.find((r: any) => r.slug === "arctic-ice");
    expect(arctic.change).toBe(6);
    const ocean = rows.find((r: any) => r.slug === "ocean-warming");
    expect(ocean.change).toBe(-5);
  });

  test("returns empty array when no topics", async () => {
    const rows = await queryTopics();
    expect(rows).toEqual([]);
  });

  test("filters by urgency and category combined", async () => {
    await seedTopics();
    const rows = await queryTopics("breaking", "climate");
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe("arctic-ice");
  });

  test("sparkline query returns score history for topics", async () => {
    await seedTopics();
    const { rows: [{ id: topicId }] } = await pool.query("SELECT id FROM topics WHERE slug = 'arctic-ice'");
    await pool.query("INSERT INTO score_history (topic_id, score) VALUES ($1, $2)", [topicId, 70]);
    await pool.query("INSERT INTO score_history (topic_id, score) VALUES ($1, $2)", [topicId, 79]);
    await pool.query("INSERT INTO score_history (topic_id, score) VALUES ($1, $2)", [topicId, 85]);

    const { rows } = await pool.query(
      "SELECT score FROM score_history WHERE topic_id = $1 ORDER BY id ASC",
      [topicId]
    );
    expect(rows.map((r: any) => r.score)).toEqual([70, 79, 85]);
  });
});
