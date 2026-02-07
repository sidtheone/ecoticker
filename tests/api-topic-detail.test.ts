import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import os from "os";

function createTestDb() {
  const dbPath = path.join(os.tmpdir(), `ecoticker-detail-test-${Date.now()}.db`);
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

function seedTopicWithDetails(db: Database.Database) {
  db.prepare(`
    INSERT INTO topics (name, slug, category, region, current_score, previous_score, urgency, impact_summary, article_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("Arctic Ice Decline", "arctic-ice-decline", "climate", "Arctic", 85, 79, "breaking", "Sea ice at record lows", 3);

  const topicId = (db.prepare("SELECT id FROM topics WHERE slug = 'arctic-ice-decline'").get() as { id: number }).id;

  // Articles — different dates for ordering
  db.prepare("INSERT INTO articles (topic_id, title, url, source, summary, published_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(topicId, "Ice melting fast", "https://example.com/1", "Reuters", "Summary 1", "2026-02-07T10:00:00Z");
  db.prepare("INSERT INTO articles (topic_id, title, url, source, summary, published_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(topicId, "Arctic report released", "https://example.com/2", "BBC", "Summary 2", "2026-02-06T08:00:00Z");
  db.prepare("INSERT INTO articles (topic_id, title, url, source, summary, published_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(topicId, "Scientists warn", "https://example.com/3", "CNN", "Summary 3", "2026-02-05T12:00:00Z");

  // Score history — different dates for ordering
  db.prepare("INSERT INTO score_history (topic_id, score, health_score, eco_score, econ_score, impact_summary, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(topicId, 70, 50, 80, 60, "Day 1 summary", "2026-02-05");
  db.prepare("INSERT INTO score_history (topic_id, score, health_score, eco_score, econ_score, impact_summary, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(topicId, 79, 55, 85, 65, "Day 2 summary", "2026-02-06");
  db.prepare("INSERT INTO score_history (topic_id, score, health_score, eco_score, econ_score, impact_summary, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(topicId, 85, 60, 90, 70, "Day 3 summary", "2026-02-07");

  return topicId;
}

// Simulate the API route query logic
function getTopicDetail(db: Database.Database, slug: string) {
  const topicRow = db.prepare(`
    SELECT id, name, slug, category, region,
      current_score, previous_score,
      (current_score - previous_score) as change,
      urgency, impact_summary, image_url, article_count, updated_at
    FROM topics WHERE slug = ?
  `).get(slug) as Record<string, unknown> | undefined;

  if (!topicRow) return null;

  const articles = db.prepare(`
    SELECT id, topic_id, title, url, source, summary, image_url, published_at
    FROM articles WHERE topic_id = ? ORDER BY published_at DESC
  `).all(topicRow.id) as Record<string, unknown>[];

  const scoreHistory = db.prepare(`
    SELECT score, health_score, eco_score, econ_score, impact_summary, recorded_at
    FROM score_history WHERE topic_id = ? ORDER BY recorded_at ASC
  `).all(topicRow.id) as Record<string, unknown>[];

  return { topic: topicRow, articles, scoreHistory };
}

describe("GET /api/topics/[slug] — query logic", () => {
  let db: Database.Database;
  let dbPath: string;

  beforeEach(() => {
    ({ db, dbPath } = createTestDb());
    seedTopicWithDetails(db);
  });
  afterEach(() => cleanup(db, dbPath));

  test("returns topic with correct fields", () => {
    const result = getTopicDetail(db, "arctic-ice-decline")!;
    expect(result.topic.name).toBe("Arctic Ice Decline");
    expect(result.topic.current_score).toBe(85);
    expect(result.topic.previous_score).toBe(79);
    expect(result.topic.change).toBe(6);
    expect(result.topic.urgency).toBe("breaking");
    expect(result.topic.category).toBe("climate");
    expect(result.topic.region).toBe("Arctic");
  });

  test("returns articles ordered by published_at DESC (newest first)", () => {
    const result = getTopicDetail(db, "arctic-ice-decline")!;
    expect(result.articles).toHaveLength(3);
    expect(result.articles[0].title).toBe("Ice melting fast"); // Feb 7
    expect(result.articles[2].title).toBe("Scientists warn");  // Feb 5
  });

  test("returns score history ordered by recorded_at ASC (oldest first)", () => {
    const result = getTopicDetail(db, "arctic-ice-decline")!;
    expect(result.scoreHistory).toHaveLength(3);
    expect(result.scoreHistory[0].score).toBe(70);  // Feb 5
    expect(result.scoreHistory[2].score).toBe(85);   // Feb 7
  });

  test("score history includes sub-scores", () => {
    const result = getTopicDetail(db, "arctic-ice-decline")!;
    const latest = result.scoreHistory[2];
    expect(latest.health_score).toBe(60);
    expect(latest.eco_score).toBe(90);
    expect(latest.econ_score).toBe(70);
    expect(latest.impact_summary).toBe("Day 3 summary");
  });

  test("returns null for non-existent slug", () => {
    const result = getTopicDetail(db, "does-not-exist");
    expect(result).toBeNull();
  });

  test("articles include all expected fields", () => {
    const result = getTopicDetail(db, "arctic-ice-decline")!;
    const article = result.articles[0];
    expect(article.title).toBeDefined();
    expect(article.url).toBeDefined();
    expect(article.source).toBeDefined();
    expect(article.summary).toBeDefined();
    expect(article.published_at).toBeDefined();
  });
});
