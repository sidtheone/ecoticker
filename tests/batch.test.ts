import { Pool } from "pg";
import fs from "fs";
import path from "path";

const DATABASE_URL = process.env.TEST_DATABASE_URL || "postgresql://ecoticker:ecoticker@localhost:5432/ecoticker_test";

let pool: Pool;

beforeAll(async () => {
  pool = new Pool({ connectionString: DATABASE_URL });
  const schema = fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf-8");
  await pool.query(schema);
});

beforeEach(async () => {
  await pool.query("DELETE FROM topic_keywords");
  await pool.query("DELETE FROM score_history");
  await pool.query("DELETE FROM articles");
  await pool.query("DELETE FROM topics");
});

afterAll(async () => {
  await pool.end();
});

describe("Batch Pipeline DB Operations", () => {
  test("full batch cycle: insert topics, articles, scores, keywords", async () => {
    const upsertTopicSql = `
      INSERT INTO topics (name, slug, category, region, current_score, previous_score, urgency, impact_summary, image_url, article_count)
      VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, $9)
      ON CONFLICT(slug) DO UPDATE SET
        previous_score = topics.current_score,
        current_score = EXCLUDED.current_score,
        urgency = EXCLUDED.urgency,
        impact_summary = EXCLUDED.impact_summary,
        image_url = COALESCE(EXCLUDED.image_url, topics.image_url),
        category = EXCLUDED.category,
        region = EXCLUDED.region,
        article_count = topics.article_count + EXCLUDED.article_count,
        updated_at = NOW()
    `;

    // Day 1: Insert a topic
    await pool.query(upsertTopicSql, ["Amazon Deforestation", "amazon-deforestation", "deforestation", "South America", 65, "critical", "Forest loss accelerating", null, 2]);
    const { rows: [topic] } = await pool.query("SELECT id FROM topics WHERE slug = 'amazon-deforestation'");
    expect(topic).toBeDefined();

    await pool.query("INSERT INTO articles (topic_id, title, url, source, summary, published_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [topic.id, "Article 1", "https://example.com/1", "Reuters", "Summary 1", "2026-02-06"]);
    await pool.query("INSERT INTO articles (topic_id, title, url, source, summary, published_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [topic.id, "Article 2", "https://example.com/2", "BBC", "Summary 2", "2026-02-06"]);
    await pool.query("INSERT INTO score_history (topic_id, score, health_score, eco_score, econ_score, impact_summary) VALUES ($1, $2, $3, $4, $5, $6)",
      [topic.id, 65, 50, 80, 55, "Forest loss accelerating"]);
    await pool.query(`INSERT INTO topic_keywords (topic_id, keyword) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM topic_keywords WHERE topic_id = $1 AND keyword = $2)`,
      [topic.id, "amazon"]);
    await pool.query(`INSERT INTO topic_keywords (topic_id, keyword) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM topic_keywords WHERE topic_id = $1 AND keyword = $2)`,
      [topic.id, "deforestation"]);

    // Verify day 1
    let { rows: [topicRow] } = await pool.query("SELECT * FROM topics WHERE slug = 'amazon-deforestation'");
    expect(topicRow.current_score).toBe(65);
    expect(topicRow.previous_score).toBe(0);
    expect(topicRow.article_count).toBe(2);

    // Day 2: Upsert same topic with new score
    await pool.query(upsertTopicSql, ["Amazon Deforestation", "amazon-deforestation", "deforestation", "South America", 78, "breaking", "Fires now spreading", "https://img.com/fire.jpg", 3]);

    // Duplicate article URL should be skipped
    await pool.query("INSERT INTO articles (topic_id, title, url, source, summary, published_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (url) DO NOTHING",
      [topic.id, "Article 1 duplicate", "https://example.com/1", "Reuters", "Same URL", "2026-02-07"]);
    await pool.query("INSERT INTO articles (topic_id, title, url, source, summary, published_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (url) DO NOTHING",
      [topic.id, "Article 3", "https://example.com/3", "CNN", "New article", "2026-02-07"]);

    await pool.query("INSERT INTO score_history (topic_id, score, health_score, eco_score, econ_score, impact_summary) VALUES ($1, $2, $3, $4, $5, $6)",
      [topic.id, 78, 60, 85, 70, "Fires now spreading"]);

    // Duplicate keyword should be skipped
    await pool.query(`INSERT INTO topic_keywords (topic_id, keyword) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM topic_keywords WHERE topic_id = $1 AND keyword = $2)`,
      [topic.id, "amazon"]);
    await pool.query(`INSERT INTO topic_keywords (topic_id, keyword) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM topic_keywords WHERE topic_id = $1 AND keyword = $2)`,
      [topic.id, "fire"]);

    // Verify day 2
    ({ rows: [topicRow] } = await pool.query("SELECT * FROM topics WHERE slug = 'amazon-deforestation'"));
    expect(topicRow.current_score).toBe(78);
    expect(topicRow.previous_score).toBe(65);
    expect(topicRow.urgency).toBe("breaking");
    expect(topicRow.article_count).toBe(5);
    expect(topicRow.image_url).toBe("https://img.com/fire.jpg");

    // Articles: 3 unique
    const { rows: [{ c: articleCount }] } = await pool.query("SELECT COUNT(*) as c FROM articles WHERE topic_id = $1", [topic.id]);
    expect(parseInt(articleCount)).toBe(3);

    // Score history: 2 entries
    const { rows: scores } = await pool.query("SELECT score FROM score_history WHERE topic_id = $1 ORDER BY id", [topic.id]);
    expect(scores.map((s: any) => s.score)).toEqual([65, 78]);

    // Keywords: 3 unique
    const { rows: keywords } = await pool.query("SELECT keyword FROM topic_keywords WHERE topic_id = $1 ORDER BY keyword", [topic.id]);
    expect(keywords.map((k: any) => k.keyword)).toEqual(["amazon", "deforestation", "fire"]);
  });

  test("existing topics with keywords can be loaded for classification", async () => {
    await pool.query("INSERT INTO topics (name, slug, category) VALUES ($1, $2, $3)", ["Arctic Ice", "arctic-ice", "climate"]);
    const { rows: [{ id: topicId }] } = await pool.query("SELECT id FROM topics WHERE slug = 'arctic-ice'");
    await pool.query("INSERT INTO topic_keywords (topic_id, keyword) VALUES ($1, $2)", [topicId, "arctic"]);
    await pool.query("INSERT INTO topic_keywords (topic_id, keyword) VALUES ($1, $2)", [topicId, "sea ice"]);

    const { rows } = await pool.query(`
      SELECT t.id, t.name, t.current_score, STRING_AGG(tk.keyword, ',') as keywords
      FROM topics t LEFT JOIN topic_keywords tk ON tk.topic_id = t.id
      GROUP BY t.id
    `);

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Arctic Ice");
    // STRING_AGG order may vary, so check both keywords are present
    expect(rows[0].keywords).toContain("arctic");
    expect(rows[0].keywords).toContain("sea ice");
  });
});

describe("Batch Pipeline: extractJSON", () => {
  function extractJSON(text: string): unknown {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }

  test("extracts clean JSON", () => {
    const result = extractJSON('{"score": 75, "urgency": "critical"}');
    expect(result).toEqual({ score: 75, urgency: "critical" });
  });

  test("extracts JSON wrapped in markdown code block", () => {
    const result = extractJSON('```json\n{"score": 50}\n```');
    expect(result).toEqual({ score: 50 });
  });

  test("extracts JSON with surrounding text", () => {
    const result = extractJSON('Here is the result:\n{"score": 60, "urgency": "moderate"}\nDone.');
    expect(result).toEqual({ score: 60, urgency: "moderate" });
  });

  test("returns null for no JSON", () => {
    expect(extractJSON("No JSON here")).toBeNull();
  });

  test("returns null for invalid JSON", () => {
    expect(extractJSON("{broken json")).toBeNull();
  });
});
