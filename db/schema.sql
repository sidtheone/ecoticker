CREATE TABLE IF NOT EXISTS topics (
  id SERIAL PRIMARY KEY,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  source TEXT,
  summary TEXT,
  image_url TEXT,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS score_history (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  score INTEGER NOT NULL,
  health_score INTEGER,
  eco_score INTEGER,
  econ_score INTEGER,
  impact_summary TEXT,
  recorded_at DATE DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS topic_keywords (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  keyword TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  action TEXT NOT NULL,
  success INTEGER DEFAULT 1,
  error_message TEXT,
  details TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_topic ON articles(topic_id);
CREATE INDEX IF NOT EXISTS idx_score_history_topic ON score_history(topic_id);
CREATE INDEX IF NOT EXISTS idx_score_history_date ON score_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_topic_keywords_topic ON topic_keywords(topic_id);
CREATE INDEX IF NOT EXISTS idx_topics_urgency ON topics(urgency);
CREATE INDEX IF NOT EXISTS idx_topics_category ON topics(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
