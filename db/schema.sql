CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT DEFAULT 'climate',
  region TEXT,
  current_score INTEGER DEFAULT 0,
  previous_score INTEGER DEFAULT 0,
  urgency TEXT DEFAULT 'informational',
  impact_summary TEXT,
  image_url TEXT,
  article_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  source TEXT,
  summary TEXT,
  image_url TEXT,
  published_at DATETIME,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS score_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  score INTEGER NOT NULL,
  health_score INTEGER,
  eco_score INTEGER,
  econ_score INTEGER,
  impact_summary TEXT,
  recorded_at DATE DEFAULT (date('now'))
);

CREATE TABLE IF NOT EXISTS topic_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  keyword TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_articles_topic ON articles(topic_id);
CREATE INDEX IF NOT EXISTS idx_score_history_topic ON score_history(topic_id);
CREATE INDEX IF NOT EXISTS idx_score_history_date ON score_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_topic_keywords_topic ON topic_keywords(topic_id);
