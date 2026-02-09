import { execSync } from "child_process";

describe("Seed Script", () => {
  test("seed script populates database with expected data", async () => {
    // The seed script creates its own pg Pool connection, so it requires
    // a real PostgreSQL instance. Skip if TEST_DATABASE_URL is not set.
    const DATABASE_URL = process.env.TEST_DATABASE_URL;
    if (!DATABASE_URL) {
      console.log("Skipping seed integration test — TEST_DATABASE_URL not set");
      return;
    }

    // Run seed script with a test DB URL
    execSync(`npx tsx scripts/seed.ts`, {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL },
    });

    // Use real pg to verify (seed.ts creates its own connection)
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: DATABASE_URL });

    const { rows: [topicCount] } = await pool.query("SELECT COUNT(*) as c FROM topics");
    expect(parseInt(topicCount.c)).toBe(12);

    const { rows: [articleCount] } = await pool.query("SELECT COUNT(*) as c FROM articles");
    expect(parseInt(articleCount.c)).toBe(36);

    const { rows: [scoreCount] } = await pool.query("SELECT COUNT(*) as c FROM score_history");
    expect(parseInt(scoreCount.c)).toBe(84);

    const { rows: [keywordCount] } = await pool.query("SELECT COUNT(*) as c FROM topic_keywords");
    expect(parseInt(keywordCount.c)).toBeGreaterThan(0);

    // Verify topics have expected fields populated
    const { rows: topics } = await pool.query("SELECT * FROM topics");
    for (const t of topics) {
      expect(t.name).toBeTruthy();
      expect(t.slug).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(t.region).toBeTruthy();
      expect(t.impact_summary).toBeTruthy();
      expect(typeof t.current_score).toBe("number");
      expect(typeof t.previous_score).toBe("number");
      expect(["breaking", "critical", "moderate", "informational"]).toContain(t.urgency);
    }

    // Verify score_history has sub-scores
    const { rows: [scores] } = await pool.query("SELECT * FROM score_history LIMIT 1");
    expect(scores.health_score).toBeDefined();
    expect(scores.eco_score).toBeDefined();
    expect(scores.econ_score).toBeDefined();

    await pool.end();
  });
});
