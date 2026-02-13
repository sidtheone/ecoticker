# NewsAPI Quality Solution

**Problem:** NewsAPI free tier returns low-quality, irrelevant results even with specific keywords
**Root Cause:** Free tier lacks domain filtering and topic classification
**Date:** 2026-02-13

---

## Test Results Summary

### Keywords Tested
| Keyword | Total Results | Relevance | Example Irrelevant |
|---------|--------------|-----------|-------------------|
| `climate change` | 17,390 | ~20% | "Love Is Blind" reality TV, immigration news |
| `"ocean acidification"` | 12 | ~40% | Gear reviews, fish trivia |
| `wildfire OR bushfire` | 871 | ~30% | Emergency kit sales |
| `species endangered` | 7,171 | ~15% | Pet care Q&A |
| `renewable energy record` | 481 | ~50% | Silver price speculation |

**Conclusion:** Even specific keywords return 50-85% irrelevant results on free tier.

---

## Why NewsAPI Free Tier Has Quality Issues

### Missing Features (Pro Tier Only)
1. **Domain filtering** - Can't prioritize reuters.com, bbc.co.uk, etc.
2. **Source ranking** - No quality scoring
3. **Topic classification** - No automatic categorization
4. **Advanced operators** - Limited Boolean support
5. **Historical search** - Only last 30 days

### What Free Tier Provides
- ✅ 100 requests/day
- ✅ Basic keyword search
- ✅ Recent articles (publishedAt sorting)
- ❌ No quality filtering
- ❌ No topic relevance scoring

---

## Solution 1: LLM Classification Filter (Recommended)

**Strategy:** Let the LLM reject irrelevant articles during classification

### Current Classification Prompt
```typescript
// scripts/batch.ts line ~95
const classificationPrompt = `Group these articles into environmental topics...`
```

### Enhanced Classification Prompt
```typescript
const classificationPrompt = `You are an environmental news classifier.

STEP 1: Filter out NON-environmental articles
Reject articles about:
- Celebrity news and entertainment
- Sports and games
- General politics (unless directly about environmental policy)
- Business/finance (unless about environmental impact)
- Technology (unless about climate tech or environmental applications)
- Pet care and animal trivia

STEP 2: Group remaining ENVIRONMENTAL articles into topics
Only include articles about:
- Climate change impacts (heatwaves, storms, droughts, floods)
- Biodiversity loss and species threats
- Pollution (air, water, plastic, chemicals)
- Ocean health (acidification, warming, coral, overfishing)
- Deforestation and habitat destruction
- Environmental policy and regulations
- Clean energy and emissions

Return JSON:
{
  "topics": [
    {
      "name": "topic name",
      "articles": [0, 1, 2],  // indices of relevant articles only
      "reason": "why these articles are environmental news"
    }
  ],
  "rejected": [3, 4],  // indices of non-environmental articles
  "rejectedReasons": ["Celebrity gossip", "Sports news"]
}

Articles: ${JSON.stringify(articles)}
`;
```

### Implementation
1. Update `scripts/batch.ts` classification prompt
2. Add rejection tracking: `console.log('Rejected:', data.rejected.length, 'irrelevant articles')`
3. Monitor rejection rate (target: 50-80% of articles rejected in first run)

### Benefits
- ✅ Uses existing Mistral Nemo model (no new cost)
- ✅ Works with current NewsAPI free tier
- ✅ Improves quality without API upgrade
- ✅ Adds ~0.5s to classification step

### Drawbacks
- ⚠️ Uses ~200 more tokens per batch (+$0.000004 cost)
- ⚠️ May reject borderline environmental news

---

## Solution 2: Better Keyword Strategy

**Approach:** Use data-driven + event keywords that naturally filter quality

### Recommended Keywords (Best for Free Tier)
```bash
BATCH_KEYWORDS=wildfire,flood damage,drought,coral bleaching,deforestation,emissions,oil spill,heatwave,endangered species,pollution
```

**Why these work:**
- Concrete events (not abstract concepts like "climate change")
- Newsworthy (media covers these actively)
- Data-driven (articles cite measurements)
- Mix of impacts (wildfires) and policies (emissions)

### Keywords to AVOID (Too Generic)
```bash
# ❌ TOO BROAD
climate,environment,sustainability,green,eco

# ❌ TOO VAGUE
"climate crisis"  # Returns opinion pieces
"environmental news"  # Meta keyword
```

### Keywords with Boolean Filters
```bash
# Use NOT to exclude irrelevant domains
BATCH_KEYWORDS=wildfire NOT game,flood damage NOT insurance,coral bleaching,deforestation rate

# More examples:
pollution NOT scandal  # Avoid political pollution scandals
species NOT crypto  # Avoid "endangered cryptos"
```

**Limitation:** NewsAPI free tier has weak NOT support (may not work consistently)

---

## Solution 3: Alternative News APIs

If quality is critical, consider these NewsAPI alternatives:

### NewsData.io
- **Free tier:** 200 requests/day (2x NewsAPI)
- **Quality:** Better source filtering
- **Pricing:** $99/month (vs NewsAPI $449/month)
- **Pros:** Better free tier, cheaper paid tier
- **Cons:** Less total sources than NewsAPI

### TheNewsAPI
- **Free tier:** 150 requests/day
- **Quality:** Domain prioritization on free tier
- **Pricing:** $29/month for basic plan
- **Pros:** Cheapest paid tier, good quality
- **Cons:** Smaller source database

### NewsAPI.ai (Event-Based)
- **Free tier:** 1,000 requests/month
- **Quality:** Event detection (not just keywords)
- **Pricing:** $49/month
- **Pros:** Semantic search, event clustering
- **Cons:** 33 requests/day vs NewsAPI 100/day

### Recommendation
- **Stick with NewsAPI + LLM filter** for now (cost: $0.012/month)
- **Upgrade to TheNewsAPI** if quality critical (cost: $29/month + $0.012/month LLM)

---

## Solution 4: Multi-Source Aggregation

**Strategy:** Combine multiple free tiers for better coverage

```typescript
// Pseudo-code for multi-source batch
const sources = [
  { api: 'newsapi', limit: 100, keywords: [...] },
  { api: 'newsdata', limit: 200, keywords: [...] },
  { api: 'thenewsapi', limit: 150, keywords: [...] }
];

// Rotate daily: Day 1 uses NewsAPI, Day 2 uses NewsData, etc.
const todaySource = sources[new Date().getDate() % sources.length];
```

**Benefits:**
- ✅ 450 requests/day total across 3 free tiers
- ✅ Diverse sources reduce bias
- ✅ Fallback if one API is down

**Drawbacks:**
- ⚠️ 3x integration complexity
- ⚠️ Different response formats to normalize
- ⚠️ Managing 3 API keys

---

## Recommended Action Plan

### Phase 1: Immediate (0 cost)
1. ✅ Update keywords to event-based (see Solution 2)
2. ✅ Enhance LLM classification with rejection filter (see Solution 1)
3. ✅ Monitor rejection rate over 1 week

### Phase 2: If Quality Still Poor (1 week later)
1. Test TheNewsAPI free tier (150 requests/day)
2. Compare article quality vs NewsAPI
3. Decide if $29/month upgrade is worth it

### Phase 3: Production (optional)
1. If scaling beyond 100 requests/day, upgrade to paid tier
2. Add domain filtering: `domains=reuters.com,bbc.co.uk,apnews.com`
3. Implement multi-source aggregation for resilience

---

## Implementation: Enhanced Classification Filter

### Update scripts/batch.ts

```typescript
// Line ~85-120, replace classificationPrompt with:

const classificationPrompt = `You are an environmental news filter and classifier.

TASK 1 - FILTER: Identify which articles are about ENVIRONMENTAL topics.

✅ INCLUDE articles about:
- Climate impacts: heatwaves, floods, droughts, storms, sea level rise
- Biodiversity: species extinction, habitat loss, wildlife decline
- Pollution: air quality, water contamination, plastic, chemicals (PFAS, etc.)
- Oceans: coral bleaching, acidification, overfishing, marine pollution
- Forests: deforestation, wildfires, forest health
- Energy & emissions: fossil fuels, renewables, carbon capture
- Environmental policy: regulations, treaties, climate conferences

❌ EXCLUDE articles about:
- Celebrity/entertainment news
- Sports and games
- General politics (unless environmental policy)
- Business news (unless environmental impact)
- Technology (unless climate/env tech)
- Pet care, animal trivia
- Product reviews, shopping deals

TASK 2 - CLASSIFY: Group relevant articles into topic clusters.

Return JSON:
{
  "topics": [
    {
      "name": "Descriptive topic name",
      "articles": [0, 2, 4],
      "environmentalFocus": "What environmental issue this covers"
    }
  ],
  "rejectedArticles": [1, 3, 5],
  "rejectionReasons": ["Celebrity news", "Pet care Q&A", "Shopping deal"]
}

Articles to classify:
${JSON.stringify(articles.map((a, i) => ({
  index: i,
  title: a.title,
  description: a.description?.substring(0, 200)
})))}
`;

// After classification, log rejection stats:
console.log(`Classified ${data.topics.length} topics, rejected ${data.rejectedArticles?.length || 0} irrelevant articles`);
if (data.rejectedArticles?.length > 0) {
  console.log('Rejection reasons:', data.rejectionReasons);
}
```

### Expected Output
```
=== EcoTicker Batch Pipeline v2 ===

[1/4] Fetching news...
Fetched 10 articles

[2/4] Classifying articles into topics...
Classified 2 topics, rejected 6 irrelevant articles
Rejection reasons: ["Reality TV show", "Immigration politics", "Pet care Q&A", "Shopping deal", "Sports news", "Crypto speculation"]

[3/4] Scoring topics...
  Wildfire Severity Escalates: overall=68, urgency=critical
  Coral Reef Collapse Accelerates: overall=71, urgency=critical
...
```

---

## Testing Plan

### Week 1: Current Keywords + LLM Filter
```bash
# Day 1-3: Monitor rejection rates
BATCH_KEYWORDS=wildfire,flood damage,coral bleaching,deforestation,emissions,oil spill

# Expected: 50-70% rejection rate (good!)
```

### Week 2: Refined Keywords Based on Data
```bash
# Analyze which keywords produced most relevant articles
# Double down on high-quality keywords
# Remove keywords with >80% rejection rate
```

### Week 3: Decision Point
- If <30% rejection: Keywords working, LLM filter effective ✅
- If 30-60% rejection: Acceptable quality, optimize keywords ⚠️
- If >60% rejection: Consider upgrading to TheNewsAPI ($29/month) ❌

---

## Cost Analysis

### Current: NewsAPI Free + Mistral Nemo + LLM Filter
- NewsAPI: $0.00
- LLM classification (with filter): ~$0.0005/batch (+25% tokens)
- LLM scoring: ~$0.0004/batch
- **Total: $0.027/month** (30 daily batches)

### Option A: Upgrade NewsAPI to Pro
- NewsAPI Pro: $449/month
- LLM: $0.012/month
- **Total: $449/month** (not worth it!)

### Option B: Switch to TheNewsAPI Basic
- TheNewsAPI: $29/month
- LLM (less filtering needed): $0.008/month
- **Total: $29/month** (only if quality critical)

### Option C: Stay Free, Accept 50% Rejection
- Cost: $0.027/month
- Quality: ~50% relevant (2-3 good topics per batch)
- **Recommended for MVP/testing phase**

---

## Metrics to Track

### Rejection Rate
```sql
-- Add to batch script
INSERT INTO batch_metrics (date, fetched, classified, rejected, rejection_rate)
VALUES (NOW(), 10, 4, 6, 0.60);
```

### Topic Quality Score (Manual Review)
```
Daily review: Pick 2 random topics, score 1-5 for relevance
Target: Average 4+ (good quality)
```

### Article-to-Topic Ratio
```
Target: 3-5 articles per topic
Too low (<2): Keywords too specific
Too high (>8): Keywords too broad
```

---

## Sources

- [NewsAPI Documentation](https://newsapi.org/docs/endpoints/everything)
- [NewsData.io Free Tier](https://newsdata.io/pricing)
- [TheNewsAPI Pricing](https://www.thenewsapi.com/pricing)
- [Best News APIs 2026 Comparison](https://newsdata.io/blog/news-api-comparison/)

---

**Recommendation:** Implement LLM classification filter (Solution 1) + event-based keywords (Solution 2)

**Cost:** $0.027/month (effectively free)
**Expected Quality:** 40-60% relevant articles → 2-4 good topics per batch
**Next Review:** After 1 week of daily batches
