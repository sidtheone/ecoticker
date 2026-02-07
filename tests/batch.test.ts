import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";

// We test the batch logic by simulating what batch.ts does against a real DB.
// This avoids needing real API keys while verifying the DB operations.

function createTestDb() {
  const dbPath = path.join(os.tmpdir(), `ecoticker-batch-test-${Date.now()}.db`);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf-8"));
  return { db, dbPath };
}

function cleanup(db: Database.Database, dbPath: string) {
  db.close();
  try { fs.unlinkSync(dbPath); } catch {}
}

describe("Batch Pipeline DB Operations", () => {
  let db: Database.Database;
  let dbPath: string;

  beforeEach(() => {
    ({ db, dbPath } = createTestDb());
  });
  afterEach(() => cleanup(db, dbPath));

  test("full batch cycle: insert topics, articles, scores, keywords", () => {
    // Simulate what batch.ts does after LLM calls
    const insertTopic = db.prepare(`
      INSERT INTO topics (name, slug, category, region, current_score, previous_score, urgency, impact_summary, image_url, article_count)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        previous_score = topics.current_score,
        current_score = excluded.current_score,
        urgency = excluded.urgency,
        impact_summary = excluded.impact_summary,
        image_url = COALESCE(excluded.image_url, topics.image_url),
        category = excluded.category,
        region = excluded.region,
        article_count = topics.article_count + excluded.article_count,
        updated_at = CURRENT_TIMESTAMP
    `);
    const insertArticle = db.prepare("INSERT OR IGNORE INTO articles (topic_id, title, url, source, summary, published_at) VALUES (?, ?, ?, ?, ?, ?)");
    const insertScore = db.prepare("INSERT INTO score_history (topic_id, score, health_score, eco_score, econ_score, impact_summary) VALUES (?, ?, ?, ?, ?, ?)");
    const insertKeyword = db.prepare(`
      INSERT INTO topic_keywords (topic_id, keyword)
      SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM topic_keywords WHERE topic_id = ? AND keyword = ?)
    `);
    const getTopicBySlug = db.prepare("SELECT id FROM topics WHERE slug = ?");

    // Day 1: Insert a topic
    insertTopic.run("Amazon Deforestation", "amazon-deforestation", "deforestation", "South America", 65, "critical", "Forest loss accelerating", null, 2);
    const topic = getTopicBySlug.get("amazon-deforestation") as { id: number };
    expect(topic).toBeDefined();

    insertArticle.run(topic.id, "Article 1", "https://example.com/1", "Reuters", "Summary 1", "2026-02-06");
    insertArticle.run(topic.id, "Article 2", "https://example.com/2", "BBC", "Summary 2", "2026-02-06");
    insertScore.run(topic.id, 65, 50, 80, 55, "Forest loss accelerating");
    insertKeyword.run(topic.id, "amazon", topic.id, "amazon");
    insertKeyword.run(topic.id, "deforestation", topic.id, "deforestation");

    // Verify day 1
    let topicRow = db.prepare("SELECT * FROM topics WHERE slug = 'amazon-deforestation'").get() as Record<string, unknown>;
    expect(topicRow.current_score).toBe(65);
    expect(topicRow.previous_score).toBe(0);
    expect(topicRow.article_count).toBe(2);

    // Day 2: Upsert same topic with new score
    insertTopic.run("Amazon Deforestation", "amazon-deforestation", "deforestation", "South America", 78, "breaking", "Fires now spreading", "https://img.com/fire.jpg", 3);

    // Duplicate article URL should be skipped
    insertArticle.run(topic.id, "Article 1 duplicate", "https://example.com/1", "Reuters", "Same URL", "2026-02-07");
    insertArticle.run(topic.id, "Article 3", "https://example.com/3", "CNN", "New article", "2026-02-07");

    insertScore.run(topic.id, 78, 60, 85, 70, "Fires now spreading");

    // Duplicate keyword should be skipped
    insertKeyword.run(topic.id, "amazon", topic.id, "amazon");
    insertKeyword.run(topic.id, "fire", topic.id, "fire");

    // Verify day 2
    topicRow = db.prepare("SELECT * FROM topics WHERE slug = 'amazon-deforestation'").get() as Record<string, unknown>;
    expect(topicRow.current_score).toBe(78);
    expect(topicRow.previous_score).toBe(65); // Rotated from day 1
    expect(topicRow.urgency).toBe("breaking");
    expect(topicRow.article_count).toBe(5); // 2 + 3
    expect(topicRow.image_url).toBe("https://img.com/fire.jpg");

    // Articles: 3 unique (not 4, since one was duplicate)
    const articleCount = (db.prepare("SELECT COUNT(*) as c FROM articles WHERE topic_id = ?").get(topic.id) as { c: number }).c;
    expect(articleCount).toBe(3);

    // Score history: 2 entries
    const scores = db.prepare("SELECT score FROM score_history WHERE topic_id = ? ORDER BY id").all(topic.id) as { score: number }[];
    expect(scores.map((s) => s.score)).toEqual([65, 78]);

    // Keywords: 3 unique (amazon, deforestation, fire)
    const keywords = db.prepare("SELECT keyword FROM topic_keywords WHERE topic_id = ? ORDER BY keyword").all(topic.id) as { keyword: string }[];
    expect(keywords.map((k) => k.keyword)).toEqual(["amazon", "deforestation", "fire"]);
  });

  test("existing topics with keywords can be loaded for classification", () => {
    // Insert topic with keywords
    db.prepare("INSERT INTO topics (name, slug, category) VALUES (?, ?, ?)").run("Arctic Ice", "arctic-ice", "climate");
    const topicId = (db.prepare("SELECT id FROM topics WHERE slug = 'arctic-ice'").get() as { id: number }).id;
    db.prepare("INSERT INTO topic_keywords (topic_id, keyword) VALUES (?, ?)").run(topicId, "arctic");
    db.prepare("INSERT INTO topic_keywords (topic_id, keyword) VALUES (?, ?)").run(topicId, "sea ice");

    // Query like batch.ts does
    const rows = db.prepare(`
      SELECT t.id, t.name, t.current_score, GROUP_CONCAT(tk.keyword) as keywords
      FROM topics t LEFT JOIN topic_keywords tk ON tk.topic_id = t.id
      GROUP BY t.id
    `).all() as { id: number; name: string; current_score: number; keywords: string | null }[];

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Arctic Ice");
    expect(rows[0].keywords).toBe("arctic,sea ice");
  });
});

describe("Batch Pipeline: extractJSON", () => {
  // Replicate the extractJSON function from batch.ts
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
