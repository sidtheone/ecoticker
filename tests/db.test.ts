import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";

function createTestDb() {
  const dbPath = path.join(os.tmpdir(), `ecoticker-test-${Date.now()}.db`);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf-8");
  db.exec(schema);
  return { db, dbPath };
}

function cleanup(db: Database.Database, dbPath: string) {
  db.close();
  try { fs.unlinkSync(dbPath); } catch {}
}

describe("Database Schema", () => {
  let db: Database.Database;
  let dbPath: string;

  beforeEach(() => {
    ({ db, dbPath } = createTestDb());
  });
  afterEach(() => cleanup(db, dbPath));

  test("creates all 4 tables", () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence' ORDER BY name")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toEqual(["articles", "score_history", "topic_keywords", "topics"]);
  });

  test("schema is idempotent (can run twice)", () => {
    const schema = fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf-8");
    expect(() => db.exec(schema)).not.toThrow();
  });

  test("topic slug is unique", () => {
    db.prepare("INSERT INTO topics (name, slug) VALUES (?, ?)").run("Test", "test-topic");
    expect(() =>
      db.prepare("INSERT INTO topics (name, slug) VALUES (?, ?)").run("Test2", "test-topic")
    ).toThrow();
  });

  test("article url is unique", () => {
    db.prepare("INSERT INTO topics (name, slug) VALUES (?, ?)").run("T", "t");
    const topicId = (db.prepare("SELECT id FROM topics WHERE slug = 't'").get() as { id: number }).id;
    db.prepare("INSERT INTO articles (topic_id, title, url) VALUES (?, ?, ?)").run(topicId, "A1", "https://example.com/1");
    expect(() =>
      db.prepare("INSERT INTO articles (topic_id, title, url) VALUES (?, ?, ?)").run(topicId, "A2", "https://example.com/1")
    ).toThrow();
  });

  test("INSERT OR IGNORE skips duplicate article urls", () => {
    db.prepare("INSERT INTO topics (name, slug) VALUES (?, ?)").run("T", "t");
    const topicId = (db.prepare("SELECT id FROM topics WHERE slug = 't'").get() as { id: number }).id;
    db.prepare("INSERT INTO articles (topic_id, title, url) VALUES (?, ?, ?)").run(topicId, "A1", "https://example.com/1");
    expect(() =>
      db.prepare("INSERT OR IGNORE INTO articles (topic_id, title, url) VALUES (?, ?, ?)").run(topicId, "A2", "https://example.com/1")
    ).not.toThrow();
    const count = (db.prepare("SELECT COUNT(*) as c FROM articles").get() as { c: number }).c;
    expect(count).toBe(1);
  });

  test("foreign key constraint on articles.topic_id", () => {
    expect(() =>
      db.prepare("INSERT INTO articles (topic_id, title, url) VALUES (?, ?, ?)").run(999, "A1", "https://x.com")
    ).toThrow();
  });

  test("score_history stores sub-scores", () => {
    db.prepare("INSERT INTO topics (name, slug) VALUES (?, ?)").run("T", "t");
    const topicId = (db.prepare("SELECT id FROM topics WHERE slug = 't'").get() as { id: number }).id;
    db.prepare(
      "INSERT INTO score_history (topic_id, score, health_score, eco_score, econ_score, impact_summary) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(topicId, 75, 80, 70, 60, "Test summary");

    const row = db.prepare("SELECT * FROM score_history WHERE topic_id = ?").get(topicId) as Record<string, unknown>;
    expect(row.score).toBe(75);
    expect(row.health_score).toBe(80);
    expect(row.eco_score).toBe(70);
    expect(row.econ_score).toBe(60);
    expect(row.impact_summary).toBe("Test summary");
  });

  test("topic_keywords links to topics", () => {
    db.prepare("INSERT INTO topics (name, slug) VALUES (?, ?)").run("T", "t");
    const topicId = (db.prepare("SELECT id FROM topics WHERE slug = 't'").get() as { id: number }).id;
    db.prepare("INSERT INTO topic_keywords (topic_id, keyword) VALUES (?, ?)").run(topicId, "climate");
    db.prepare("INSERT INTO topic_keywords (topic_id, keyword) VALUES (?, ?)").run(topicId, "warming");

    const keywords = db.prepare("SELECT keyword FROM topic_keywords WHERE topic_id = ? ORDER BY keyword").all(topicId) as { keyword: string }[];
    expect(keywords.map((k) => k.keyword)).toEqual(["climate", "warming"]);
  });

  test("topic upsert updates scores correctly", () => {
    const upsert = db.prepare(`
      INSERT INTO topics (name, slug, current_score, previous_score, urgency, article_count)
      VALUES (?, ?, ?, 0, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        previous_score = topics.current_score,
        current_score = excluded.current_score,
        urgency = excluded.urgency,
        article_count = topics.article_count + excluded.article_count,
        updated_at = CURRENT_TIMESTAMP
    `);

    upsert.run("Topic", "topic", 50, "moderate", 3);
    let row = db.prepare("SELECT * FROM topics WHERE slug = 'topic'").get() as Record<string, unknown>;
    expect(row.current_score).toBe(50);
    expect(row.previous_score).toBe(0);
    expect(row.article_count).toBe(3);

    // Second upsert should rotate scores
    upsert.run("Topic", "topic", 75, "critical", 2);
    row = db.prepare("SELECT * FROM topics WHERE slug = 'topic'").get() as Record<string, unknown>;
    expect(row.current_score).toBe(75);
    expect(row.previous_score).toBe(50);
    expect(row.article_count).toBe(5);
    expect(row.urgency).toBe("critical");
  });

  test("default values are set correctly", () => {
    db.prepare("INSERT INTO topics (name, slug) VALUES (?, ?)").run("T", "t");
    const row = db.prepare("SELECT * FROM topics WHERE slug = 't'").get() as Record<string, unknown>;
    expect(row.current_score).toBe(0);
    expect(row.previous_score).toBe(0);
    expect(row.urgency).toBe("informational");
    expect(row.category).toBe("climate");
    expect(row.article_count).toBe(0);
  });
});
