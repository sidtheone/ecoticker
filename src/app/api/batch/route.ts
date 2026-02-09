import { NextRequest, NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
import slugify from 'slugify';
import { requireAdminKey, getUnauthorizedResponse } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { logSuccess, logFailure } from '@/lib/audit-log';
import { TIMEOUTS, BATCH } from '@/lib/constants';

// --- Config ---
const NEWSAPI_KEY = process.env.NEWSAPI_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';
const KEYWORDS = (process.env.BATCH_KEYWORDS || 'climate change,pollution,deforestation,wildfire,flood').split(',');

// --- Types ---
interface NewsArticle {
  title: string;
  url: string;
  source: { name: string };
  description: string | null;
  urlToImage: string | null;
  publishedAt: string;
}

interface Classification {
  articleIndex: number;
  topicName: string;
  isNew: boolean;
}

interface TopicScore {
  score: number;
  healthScore: number;
  ecoScore: number;
  econScore: number;
  urgency: string;
  impactSummary: string;
  category: string;
  region: string;
  keywords: string[];
}

// --- NewsAPI ---
async function fetchNews(): Promise<NewsArticle[]> {
  const allArticles: NewsArticle[] = [];

  const keywordGroups = [];
  for (let i = 0; i < KEYWORDS.length; i += BATCH.KEYWORD_GROUP_SIZE) {
    keywordGroups.push(KEYWORDS.slice(i, i + BATCH.KEYWORD_GROUP_SIZE).join(' OR '));
  }

  for (const query of keywordGroups) {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&searchIn=title&language=en&sortBy=publishedAt&pageSize=10&apiKey=${NEWSAPI_KEY}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUTS.NEWS_API_MS) });
      const data = await res.json();

      if (data.status === 'error') {
        console.error(`NewsAPI error for "${query}":`, data.message);
        continue;
      }

      if (data.articles) {
        const filteredArticles = data.articles.filter((a: NewsArticle) => {
          const source = a.source?.name?.toLowerCase() || '';
          return !source.includes('bringatrailer') &&
                 !source.includes('auction') &&
                 !source.includes('ebay') &&
                 a.title && a.description;
        });
        allArticles.push(...filteredArticles);
      }
    } catch (err) {
      console.error(`Failed to fetch news for "${query}":`, err);
    }
  }

  const seen = new Set<string>();
  return allArticles.filter((a) => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

// --- OpenRouter LLM ---
async function callLLM(prompt: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUTS.LLM_API_MS),
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

function extractJSON(text: string): unknown {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

// --- Pass 1: Classification ---
async function classifyArticles(
  articles: NewsArticle[],
  existingTopics: { name: string; keywords: string[] }[]
): Promise<Classification[]> {
  const topicsList = existingTopics
    .map((t) => `- "${t.name}" (keywords: ${t.keywords.join(', ')})`)
    .join('\n');

  const titlesList = articles.map((a, i) => `${i}. ${a.title}`).join('\n');

  const prompt = `You are an environmental news classifier. Group these articles into environmental topics.

IMPORTANT: Only classify articles that are genuinely about environmental issues like:
- Climate change, global warming, carbon emissions
- Pollution (air, water, soil, ocean, plastic)
- Deforestation, habitat loss, biodiversity
- Natural disasters (hurricanes, floods, wildfires)
- Renewable energy, sustainability
- Wildlife conservation, endangered species

SKIP any articles about:
- Cars, vehicles, or auctions (unless specifically about electric vehicles/emissions)
- General business news (unless directly about environmental impact)
- Sports, entertainment, politics (unless environmental policy)

Use existing topics where they match. Create new topic names only when no existing topic fits.
Each topic should be a clear environmental issue (e.g. "Amazon Deforestation", "Delhi Air Quality Crisis").

Existing topics:
${topicsList || '(none yet)'}

Articles to classify:
${titlesList}

Respond with ONLY valid JSON, no other text. Use empty array if no environmental articles:
{"classifications": [{"articleIndex": 0, "topicName": "Topic Name", "isNew": false}, ...]}`;

  const response = await callLLM(prompt);
  console.log('LLM Classification Response:', response.substring(0, 500));

  const parsed = extractJSON(response) as { classifications?: Classification[] } | null;

  if (parsed?.classifications) {
    console.log(`Successfully classified ${parsed.classifications.length} articles`);
    return parsed.classifications;
  }

  console.error('Classification LLM failed to return valid JSON');
  console.error('LLM Response was:', response.substring(0, 1000));
  console.warn('Skipping these articles due to classification failure');
  return [];
}

// --- Pass 2: Scoring ---
async function scoreTopic(topicName: string, articles: NewsArticle[]): Promise<TopicScore> {
  const summaries = articles
    .map((a) => `- ${a.title}: ${a.description || 'No description'}`)
    .join('\n');

  const prompt = `You are an environmental impact analyst. Analyze the following news about "${topicName}".

Articles:
${summaries}

Rate severity on 0-100 scale. Respond with ONLY valid JSON, no other text:
{
  "score": 50,
  "healthScore": 40,
  "ecoScore": 60,
  "econScore": 45,
  "urgency": "moderate",
  "impactSummary": "Brief 1-2 sentence impact summary",
  "category": "climate",
  "region": "Global",
  "keywords": ["keyword1", "keyword2"]
}

Valid urgency values: breaking, critical, moderate, informational
Valid categories: air_quality, deforestation, ocean, climate, pollution, biodiversity, wildlife, energy, waste, water`;

  const response = await callLLM(prompt);
  const parsed = extractJSON(response) as TopicScore | null;

  if (parsed?.score !== undefined) return parsed;

  console.warn(`Scoring LLM failed for "${topicName}", using defaults`);
  return {
    score: 50,
    healthScore: 50,
    ecoScore: 50,
    econScore: 50,
    urgency: 'moderate',
    impactSummary: `Recent news coverage about ${topicName}.`,
    category: 'climate',
    region: 'Global',
    keywords: topicName.toLowerCase().split(' '),
  };
}

// --- Main Batch Logic ---
export async function POST(request: NextRequest) {
  if (!requireAdminKey(request)) {
    return getUnauthorizedResponse();
  }

  try {
    if (!NEWSAPI_KEY || !OPENROUTER_API_KEY) {
      return NextResponse.json(
        {
          error: 'Missing API keys',
          details: 'NEWSAPI_KEY and OPENROUTER_API_KEY must be set in environment variables',
        },
        { status: 500 }
      );
    }

    console.log('=== EcoTicker Batch Pipeline ===');
    console.log(`Time: ${new Date().toISOString()}`);

    await initDb();
    const pool = getDb();

    // Step 1: Fetch news
    console.log('\n[1/4] Fetching news...');
    const articles = await fetchNews();
    console.log(`Fetched ${articles.length} articles`);

    if (articles.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new articles found',
        stats: { topics: 0, articles: 0, scoreHistory: 0 },
        timestamp: new Date().toISOString(),
      });
    }

    // Load existing topics + keywords
    const { rows: existingTopics } = await pool.query(`
      SELECT t.id, t.name, t.current_score,
        STRING_AGG(tk.keyword, ',') as keywords
      FROM topics t
      LEFT JOIN topic_keywords tk ON tk.topic_id = t.id
      GROUP BY t.id
    `);

    const topicsWithKeywords = existingTopics.map((t: { id: number; name: string; current_score: number; keywords: string | null }) => ({
      ...t,
      keywords: t.keywords ? t.keywords.split(',') : [],
    }));

    // Step 2: Classify articles into topics (in batches)
    console.log('\n[2/4] Classifying articles into topics...');
    const allClassifications: Classification[] = [];

    const batchSize = BATCH.CLASSIFICATION_BATCH_SIZE;
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);
      console.log(`  Classifying batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(articles.length / batchSize)} (${batch.length} articles)...`);

      try {
        const batchClassifications = await classifyArticles(batch, topicsWithKeywords);
        const adjustedClassifications = batchClassifications.map(c => ({
          ...c,
          articleIndex: c.articleIndex + i
        }));
        allClassifications.push(...adjustedClassifications);
      } catch (err) {
        console.error(`  Failed to classify batch ${Math.floor(i / batchSize) + 1}:`, err);
      }
    }

    const classifications = allClassifications;
    console.log(`Classified into ${new Set(classifications.map((c) => c.topicName)).size} topics`);

    // Group articles by topic name
    const topicGroups = new Map<string, NewsArticle[]>();
    for (const c of classifications) {
      const article = articles[c.articleIndex];
      if (!article) continue;
      const existing = topicGroups.get(c.topicName) || [];
      existing.push(article);
      topicGroups.set(c.topicName, existing);
    }

    // Step 3: Score each topic
    console.log('\n[3/4] Scoring topics...');

    let topicCount = 0;
    let articleCount = 0;
    let scoreCount = 0;

    for (const [topicName, topicArticles] of topicGroups) {
      const scoreResult = await scoreTopic(topicName, topicArticles);
      const slug = slugify(topicName, { lower: true, strict: true });
      const imageUrl = topicArticles.find((a) => a.urlToImage)?.urlToImage || null;

      console.log(`  ${topicName}: score=${scoreResult.score}, urgency=${scoreResult.urgency}`);

      // Upsert topic
      await pool.query(`
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
      `, [
        topicName, slug, scoreResult.category, scoreResult.region,
        scoreResult.score, scoreResult.urgency, scoreResult.impactSummary,
        imageUrl, topicArticles.length
      ]);
      topicCount++;

      const { rows: topicRows } = await pool.query('SELECT id FROM topics WHERE slug = $1', [slug]);
      if (topicRows.length === 0) continue;
      const topicId = topicRows[0].id;

      // Insert articles
      for (const a of topicArticles) {
        await pool.query(`
          INSERT INTO articles (topic_id, title, url, source, summary, image_url, published_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (url) DO NOTHING
        `, [topicId, a.title, a.url, a.source?.name, a.description, a.urlToImage, a.publishedAt]);
        articleCount++;
      }

      // Insert score history
      await pool.query(`
        INSERT INTO score_history (topic_id, score, health_score, eco_score, econ_score, impact_summary)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        topicId, scoreResult.score, scoreResult.healthScore,
        scoreResult.ecoScore, scoreResult.econScore, scoreResult.impactSummary
      ]);
      scoreCount++;

      // Insert keywords
      for (const kw of scoreResult.keywords) {
        await pool.query(`
          INSERT INTO topic_keywords (topic_id, keyword)
          SELECT $1, $2 WHERE NOT EXISTS (
            SELECT 1 FROM topic_keywords WHERE topic_id = $1 AND keyword = $2
          )
        `, [topicId, kw.toLowerCase()]);
      }
    }

    // Step 4: Summary
    const { rows: [topicTotal] } = await pool.query('SELECT COUNT(*) as c FROM topics');
    const { rows: [articleTotal] } = await pool.query('SELECT COUNT(*) as c FROM articles');
    const totalTopics = parseInt(topicTotal.c);
    const totalArticles = parseInt(articleTotal.c);
    console.log(`\n[4/4] Done! ${totalTopics} total topics, ${totalArticles} total articles in database.`);

    logSuccess(request, 'batch_process', {
      topicsProcessed: topicCount,
      articlesAdded: articleCount,
      scoresRecorded: scoreCount,
      totalTopics,
      totalArticles,
    });

    return NextResponse.json({
      success: true,
      message: 'Batch processing completed successfully',
      stats: {
        topicsProcessed: topicCount,
        articlesAdded: articleCount,
        scoresRecorded: scoreCount,
        totalTopics,
        totalArticles,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logFailure(request, 'batch_process', error instanceof Error ? error.message : 'Unknown error');
    return createErrorResponse(error, 'Batch processing failed');
  }
}
