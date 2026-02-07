# Real Data Setup Guide

This guide shows you how to configure EcoTicker to fetch real environmental news instead of using demo data.

## Prerequisites

You'll need API keys from two services:

1. **NewsAPI** - For fetching news articles
2. **OpenRouter** - For AI classification and scoring

## Step 1: Get API Keys

### NewsAPI Key

1. Visit https://newsapi.org
2. Click "Get API Key"
3. Sign up for a free account
4. Copy your API key from the dashboard
5. Free tier: 100 requests/day (sufficient for daily cron job)

### OpenRouter API Key

1. Visit https://openrouter.ai
2. Sign up for an account
3. Go to "Keys" section
4. Create a new API key
5. Copy the key (starts with `sk-or-...`)
6. Free models available (recommended: `meta-llama/llama-3.1-8b-instruct:free`)

## Step 2: Add Keys to Railway

1. Go to your Railway dashboard
2. Select the EcoTicker project
3. Click on "Variables" tab
4. Add the following environment variables:

```bash
NEWSAPI_KEY=your_newsapi_key_here
OPENROUTER_API_KEY=sk-or-your_openrouter_key_here
```

### Optional Configuration

```bash
# OpenRouter model to use (defaults to free llama-3.1-8b)
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free

# Keywords to search for (comma-separated)
BATCH_KEYWORDS=climate change,pollution,deforestation,wildfire,flood,ocean acidification
```

## Step 3: Verify Setup

After adding the keys to Railway, the app will automatically redeploy.

### Test the Batch Endpoint

```bash
# Call the batch endpoint directly (requires valid API keys in env)
curl -X POST https://ecoticker-production.up.railway.app/api/batch

# Or use the cron endpoint (requires CRON_SECRET)
curl -X GET \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://ecoticker-production.up.railway.app/api/cron/batch
```

### Check the Response

With API keys configured, you should see:

```json
{
  "success": true,
  "timestamp": "2026-02-07T22:00:00.000Z",
  "mode": "real-data",
  "stats": {
    "topicsProcessed": 5,
    "articlesAdded": 25,
    "scoresRecorded": 5,
    "totalTopics": 15,
    "totalArticles": 65
  },
  "message": "Batch processing completed successfully"
}
```

Without API keys, you'll see:

```json
{
  "success": true,
  "timestamp": "2026-02-07T22:00:00.000Z",
  "mode": "demo-data",
  "stats": {
    "topics": 10,
    "articles": 40,
    "scoreHistory": 70
  },
  "message": "Database seeded successfully"
}
```

## Step 4: Set Up Cron Job

Configure an external cron service to call the batch endpoint daily:

### Using cron-job.org (Free)

1. Visit https://cron-job.org
2. Create account and add new cron job
3. Configure:
   - **URL**: `https://ecoticker-production.up.railway.app/api/cron/batch`
   - **Schedule**: `0 6 * * *` (daily at 6am UTC)
   - **Method**: GET
   - **Headers**:
     - `Authorization: Bearer YOUR_CRON_SECRET`
4. Save and enable

### Using Railway Cron (Requires Pro Plan)

Add to `railway.toml`:

```toml
[deploy]
healthcheckPath = "/api/ticker"
healthcheckTimeout = 10

[experimental.cron]
enabled = true

[[experimental.cron.schedules]]
name = "daily-batch"
schedule = "0 6 * * *"
command = "curl -H 'Authorization: Bearer $CRON_SECRET' http://localhost:3000/api/cron/batch"
```

## How It Works

### Batch Processing Flow

1. **Fetch News** - NewsAPI retrieves recent articles about environmental keywords
2. **Classify Topics** - OpenRouter LLM groups articles into environmental topics
3. **Score Severity** - LLM rates each topic's impact on 0-100 scale
4. **Update Database** - New topics, articles, and scores saved to SQLite

### Data Freshness

- Cron job runs daily at 6am UTC
- Fetches last 24 hours of news
- Updates existing topics or creates new ones
- Preserves score history for trend analysis

### Cost Estimates

**NewsAPI Free Tier:**
- 100 requests/day
- Batch job uses 2-3 requests
- Cost: $0/month

**OpenRouter (Free Model):**
- `meta-llama/llama-3.1-8b-instruct:free`
- ~10 LLM calls per batch
- Cost: $0/month

**Total Monthly Cost**: $0 (using free tiers)

### Upgrading for More Data

If you need more frequent updates or higher quality:

**NewsAPI Developer Plan** ($449/month):
- Unlimited requests
- Run batch job hourly

**OpenRouter Paid Models**:
- `anthropic/claude-3.5-sonnet`: ~$3/1M input tokens
- `openai/gpt-4-turbo`: ~$10/1M input tokens
- Better classification and scoring accuracy

## Troubleshooting

### "Missing API keys" Error

Check Railway environment variables are set:
```bash
railway variables
```

Should show:
```
NEWSAPI_KEY=...
OPENROUTER_API_KEY=sk-or-...
```

### "Rate limit exceeded" Error

NewsAPI free tier: 100 requests/day
- Reduce `BATCH_KEYWORDS` count
- Run cron job less frequently
- Upgrade to paid plan

### "Model not found" Error

Check `OPENROUTER_MODEL` value:
```bash
# List available free models
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer sk-or-..." | jq '.data[] | select(.pricing.prompt == "0")'
```

### No New Topics Appearing

- Check cron job is running (check Railway logs)
- Verify batch endpoint returns success
- Try calling `/api/batch` directly to test
- Check NewsAPI actually returns articles for your keywords

## Monitoring

### Check Last Batch Run

```bash
# Check Railway logs
railway logs --filter "Batch processing"

# Or check via API
curl https://ecoticker-production.up.railway.app/api/topics | jq '.topics[0].updated_at'
```

### View Processing Stats

The batch endpoint returns detailed stats:
- Topics processed this run
- Articles added
- Score history records created
- Total topics/articles in database

## Security Notes

- Never commit API keys to git
- Use Railway environment variables only
- Rotate keys if accidentally exposed
- CRON_SECRET prevents unauthorized batch runs

---

**Need Help?**
- NewsAPI docs: https://newsapi.org/docs
- OpenRouter docs: https://openrouter.ai/docs
- Railway docs: https://docs.railway.app
