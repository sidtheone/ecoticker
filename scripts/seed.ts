import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "db", "ecoticker.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf-8"));

// Clear existing data
db.exec("DELETE FROM topic_keywords; DELETE FROM score_history; DELETE FROM articles; DELETE FROM topics;");

const topics = [
  { name: "Amazon Deforestation", category: "deforestation", region: "South America", score: 82, prev: 75, urgency: "breaking", summary: "Satellite data reveals accelerating forest loss in the Amazon basin, threatening critical carbon sinks and biodiversity.", keywords: ["amazon", "deforestation", "brazil", "rainforest"] },
  { name: "Delhi Air Quality Crisis", category: "air_quality", region: "South Asia", score: 91, prev: 88, urgency: "breaking", summary: "Air quality index in Delhi reaches hazardous levels, with PM2.5 concentrations exceeding WHO limits by 15x.", keywords: ["delhi", "air quality", "pollution", "smog"] },
  { name: "Great Barrier Reef Bleaching", category: "ocean", region: "Oceania", score: 74, prev: 68, urgency: "critical", summary: "Mass coral bleaching event affects 60% of the Great Barrier Reef as ocean temperatures hit record highs.", keywords: ["coral", "bleaching", "reef", "ocean temperature"] },
  { name: "California Wildfire Season", category: "climate", region: "North America", score: 67, prev: 72, urgency: "critical", summary: "Wildfire activity decreases slightly but drought conditions maintain elevated risk across the western US.", keywords: ["wildfire", "california", "drought", "fire"] },
  { name: "Plastic Ocean Pollution", category: "pollution", region: "Global", score: 58, prev: 55, urgency: "moderate", summary: "New research identifies microplastic concentration increases in all major ocean basins.", keywords: ["plastic", "ocean", "microplastic", "pollution"] },
  { name: "Arctic Sea Ice Decline", category: "climate", region: "Arctic", score: 85, prev: 79, urgency: "breaking", summary: "Arctic sea ice extent reaches lowest recorded February measurement, accelerating feedback loop.", keywords: ["arctic", "sea ice", "melting", "climate change"] },
  { name: "European Heat Wave", category: "climate", region: "Europe", score: 63, prev: 70, urgency: "critical", summary: "Winter heat anomalies across southern Europe raise concerns about upcoming summer conditions.", keywords: ["heat wave", "europe", "temperature", "climate"] },
  { name: "Congo Basin Mining Impact", category: "biodiversity", region: "Central Africa", score: 71, prev: 65, urgency: "critical", summary: "Industrial mining expansion threatens critical gorilla habitats in the Congo Basin.", keywords: ["congo", "mining", "biodiversity", "gorilla"] },
  { name: "Ganges River Pollution", category: "water", region: "South Asia", score: 45, prev: 52, urgency: "moderate", summary: "Cleanup efforts show progress but industrial discharge continues to impact downstream communities.", keywords: ["ganges", "river", "water pollution", "india"] },
  { name: "Renewable Energy Transition", category: "energy", region: "Global", score: 22, prev: 28, urgency: "informational", summary: "Global renewable energy capacity grew 15% year-over-year, with solar leading installations.", keywords: ["renewable", "solar", "wind", "energy transition"] },
  { name: "Pacific Garbage Patch Growth", category: "waste", region: "Pacific Ocean", score: 54, prev: 51, urgency: "moderate", summary: "The Great Pacific Garbage Patch has grown an estimated 8% in the past year despite cleanup efforts.", keywords: ["garbage patch", "pacific", "waste", "ocean cleanup"] },
  { name: "Southeast Asian Flooding", category: "climate", region: "Southeast Asia", score: 76, prev: 60, urgency: "critical", summary: "Unprecedented monsoon flooding displaces millions across Myanmar, Thailand, and Vietnam.", keywords: ["flooding", "monsoon", "southeast asia", "displacement"] },
];

const insertTopic = db.prepare(`
  INSERT INTO topics (name, slug, category, region, current_score, previous_score, urgency, impact_summary, article_count)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertArticle = db.prepare(`
  INSERT INTO articles (topic_id, title, url, source, summary, published_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertScore = db.prepare(`
  INSERT INTO score_history (topic_id, score, health_score, eco_score, econ_score, impact_summary, recorded_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertKeyword = db.prepare(`
  INSERT INTO topic_keywords (topic_id, keyword) VALUES (?, ?)
`);

const sources = ["Reuters", "BBC", "The Guardian", "AP News", "Al Jazeera", "CNN"];

for (const t of topics) {
  const slug = t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
  insertTopic.run(slug === "" ? "topic" : t.name, slug, t.category, t.region, t.score, t.prev, t.urgency, t.summary, 3);

  const topicId = (db.prepare("SELECT id FROM topics WHERE slug = ?").get(slug) as { id: number }).id;

  // Insert sample articles
  for (let i = 0; i < 3; i++) {
    const source = sources[Math.floor(Math.random() * sources.length)];
    const daysAgo = Math.floor(Math.random() * 5);
    const date = new Date(Date.now() - daysAgo * 86400000).toISOString();
    insertArticle.run(
      topicId,
      `${t.name}: ${["New developments reported", "Experts raise concerns", "Government response underway"][i]}`,
      `https://example.com/${slug}-${i + 1}`,
      source,
      t.summary,
      date
    );
  }

  // Insert 7 days of score history
  for (let day = 6; day >= 0; day--) {
    const date = new Date(Date.now() - day * 86400000).toISOString().split("T")[0];
    const variance = Math.floor(Math.random() * 15) - 7;
    const dayScore = Math.max(0, Math.min(100, t.score + variance));
    const h = Math.max(0, Math.min(100, dayScore + Math.floor(Math.random() * 20) - 10));
    const e = Math.max(0, Math.min(100, dayScore + Math.floor(Math.random() * 20) - 10));
    const ec = Math.max(0, Math.min(100, dayScore + Math.floor(Math.random() * 20) - 10));
    insertScore.run(topicId, dayScore, h, e, ec, t.summary, date);
  }

  // Insert keywords
  for (const kw of t.keywords) {
    insertKeyword.run(topicId, kw);
  }
}

const topicCount = (db.prepare("SELECT COUNT(*) as c FROM topics").get() as { c: number }).c;
const articleCount = (db.prepare("SELECT COUNT(*) as c FROM articles").get() as { c: number }).c;
const scoreCount = (db.prepare("SELECT COUNT(*) as c FROM score_history").get() as { c: number }).c;

console.log(`Seeded: ${topicCount} topics, ${articleCount} articles, ${scoreCount} score history entries`);
db.close();
