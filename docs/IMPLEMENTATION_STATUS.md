# NewsAPI Quality Solution - Implementation Status

**Date:** 2026-02-13
**Status:** ✅ IMPLEMENTED (Pending commit)
**Related Docs:** `NEWSAPI_QUALITY_SOLUTION.md`, `BATCH_KEYWORDS_RESEARCH.md`

---

## Implementation Summary

Successfully implemented **Solution 1** (LLM Classification Filter) + **Solution 2** (Event-Based Keywords) from the NewsAPI quality research.

### Changes Made

#### 1. Enhanced LLM Classification Filter (`scripts/batch.ts`)
**Status:** ✅ Implemented (lines 161-232)

**What Changed:**
- Added **TASK 1 - FILTER** step to reject non-environmental articles before classification
- Added **TASK 2 - CLASSIFY** step to group remaining environmental articles into topics
- Implemented detailed rejection logging with article titles and reasons
- Added relevance rate calculation and statistics

**Key Features:**
```typescript
✅ INCLUDE criteria:
- Climate impacts (heatwaves, floods, droughts, storms, sea level rise)
- Biodiversity (species extinction, habitat loss, wildlife decline)
- Pollution (air quality, water contamination, plastic, chemicals)
- Oceans (coral bleaching, acidification, overfishing, marine pollution)
- Forests (deforestation, wildfires, forest degradation)
- Energy & emissions (fossil fuels, renewables, carbon emissions)
- Environmental policy (regulations, treaties, climate action)

❌ REJECT criteria:
- Celebrity/entertainment news
- Sports and games
- General politics (unless environmental policy)
- Business news (unless environmental impact)
- Technology (unless climate/environmental tech)
- Pet care, animal trivia, lifestyle
- Product reviews, shopping deals, promotions
```

**Output Example:**
```
📋 Filtered 6 irrelevant articles:
   ❌ [1] "Love Is Blind Season 4 Couples..." (Celebrity news)
   ❌ [3] "Best Dog Food for Sensitive Stomachs" (Pet care Q&A)
   ❌ [5] "Emergency Kit Sale: 50% Off Today" (Shopping deal)
✅ Relevance rate: 70.0% (7/10 articles)
```

#### 2. Event-Based Keywords Configuration (`.env`)
**Status:** ✅ Already configured (optimal keywords)

**Current Configuration:**
```bash
BATCH_KEYWORDS=wildfire,flood damage,drought,coral bleaching,deforestation,emissions,oil spill,heatwave,endangered species,pollution
```

**Why These Keywords Work:**
- **Concrete events** (not abstract concepts like "climate change")
- **Newsworthy** (media actively covers these)
- **Data-driven** (articles cite measurements)
- **Mix of impacts** (wildfires, oil spills) and processes (deforestation, emissions)

**Alignment with Research:**
- ✅ Matches "Option 1: Balanced Coverage" from `BATCH_KEYWORDS_RESEARCH.md`
- ✅ Covers all major environmental categories (ocean, biodiversity, climate, pollution, energy)
- ✅ Expected: 8-15 articles per batch, diverse topics, high relevance

#### 3. Infrastructure Updates

**docker-compose.yml:**
```yaml
postgres:
  image: postgres:17-alpine
  restart: unless-stopped
  ports:
    - "5433:5432"  # ✅ ADDED: External port mapping for local development
```

**.gitignore:**
```
.serena/
SECURITY_CHECKLIST.md  # ✅ ADDED
```

---

## Cost Analysis

### Current Implementation: NewsAPI Free + Mistral Nemo + LLM Filter
- **NewsAPI:** $0.00 (100 requests/day free tier)
- **LLM classification** (with filter): ~$0.0005/batch (+25% tokens vs baseline)
- **LLM scoring:** ~$0.0004/batch
- **Total:** **$0.027/month** (30 daily batches)

### Expected Quality Improvement
- **Before:** ~20-30% relevant articles (estimated)
- **After:** **40-60% relevant articles** (expected with LLM filter)
- **Target:** 2-4 good environmental topics per batch

### Alternative Considered (Not Implemented)
- **Upgrade to NewsAPI Pro:** $449/month (❌ not cost-effective)
- **Switch to TheNewsAPI:** $29/month (⏸️ deferred - test free solution first)
- **Multi-source aggregation:** 3x integration complexity (⏸️ deferred - overkill for MVP)

---

## Testing Plan

### Week 1: Monitor Rejection Rates (Starting 2026-02-13)
```bash
# Run daily batch and observe rejection statistics
npx tsx scripts/batch.ts

# Expected output:
# [2/4] Classifying articles into topics...
# 📋 Filtered 5 irrelevant articles:
#    ❌ [1] "Article title..." (Reason)
# ✅ Relevance rate: 50-70% (target)
```

**Success Criteria:**
- ✅ 50-70% rejection rate = Good filtering (keywords + LLM working together)
- ✅ 2-4 environmental topics per batch = Quality improvement
- ⚠️ <30% rejection = Keywords too specific, need adjustment
- ❌ >80% rejection = Keywords too broad or LLM too strict

### Week 2: Keyword Refinement
Based on Week 1 data:
- Identify keywords with >80% rejection → Remove or refine
- Identify keywords with <20% rejection → Keep and expand similar terms
- Analyze which categories produce highest quality articles

### Week 3: Decision Point
- **If relevance ≥40%:** Continue with current setup ✅
- **If relevance 30-40%:** Optimize keywords further ⚠️
- **If relevance <30%:** Consider upgrading to TheNewsAPI ($29/month) ❌

---

## Metrics to Track

### Automatic Metrics (Console Output)
```
[2/4] Classifying articles into topics...
📋 Filtered 6 irrelevant articles:
   ❌ [1] "..." (Celebrity news)
✅ Relevance rate: 60.0% (6/10 articles)
Classified into 3 topics
```

### Manual Quality Checks (Weekly)
1. **Topic Quality Score:** Pick 2 random topics, rate 1-5 for relevance
   - Target: Average 4+ (good quality)

2. **Article-to-Topic Ratio:**
   - Target: 3-5 articles per topic
   - Too low (<2): Keywords too specific
   - Too high (>8): Keywords too broad

3. **Urgency Distribution:**
   ```sql
   SELECT urgency, COUNT(*) FROM topics GROUP BY urgency;
   ```
   - Target: Mix of all levels (not all breaking/critical)

---

## Next Steps

### Immediate (Before Commit)
- ✅ Implementation complete
- ✅ Build passes
- 🔄 **Run test batch** (confirming now)
- 🔄 **Commit changes**

### Week 1 (2026-02-13 to 2026-02-20)
- [ ] Monitor daily batch logs
- [ ] Track rejection rates
- [ ] Record topic quality (manual review)
- [ ] Identify best-performing keywords

### Week 2 (2026-02-21 to 2026-02-27)
- [ ] Analyze Week 1 data
- [ ] Refine keyword list based on data
- [ ] Update `.env` with optimized keywords
- [ ] Continue monitoring

### Week 3 (2026-02-28 onwards)
- [ ] Make go/no-go decision on paid tier upgrade
- [ ] If staying free: Document final keyword strategy
- [ ] If upgrading: Test TheNewsAPI free tier first

---

## Files Modified

| File | Status | Changes |
|------|--------|---------|
| `scripts/batch.ts` | ✅ Modified | Enhanced LLM classification with filtering (lines 161-232) |
| `.env` | ✅ Already optimal | Event-based keywords configured |
| `docker-compose.yml` | ✅ Modified | Added PostgreSQL port mapping (5433:5432) |
| `.gitignore` | ✅ Modified | Added SECURITY_CHECKLIST.md |
| `docs/NEWSAPI_QUALITY_SOLUTION.md` | ✅ New | Research and solution design |
| `docs/BATCH_KEYWORDS_RESEARCH.md` | ✅ New | Keyword strategy research |
| `docs/IMPLEMENTATION_STATUS.md` | ✅ New | This status document |

---

## Commit Message

```
feat(batch): implement LLM-based article filtering to improve news quality

Problem:
- NewsAPI free tier returns 50-85% irrelevant results
- No domain filtering or topic classification available

Solution:
- Enhanced classification prompt with 2-step filtering (TASK 1: FILTER, TASK 2: CLASSIFY)
- Added detailed rejection criteria (celebrity news, sports, shopping, etc.)
- Implemented rejection statistics logging (relevance rate, rejection reasons)
- Event-based keywords already configured (wildfire, coral bleaching, etc.)

Expected Impact:
- 40-60% relevance rate (up from 20-30%)
- 2-4 quality environmental topics per batch
- $0.027/month cost (effectively free)

Related:
- docs/NEWSAPI_QUALITY_SOLUTION.md (design rationale)
- docs/BATCH_KEYWORDS_RESEARCH.md (keyword strategy)
- docs/IMPLEMENTATION_STATUS.md (tracking metrics)

Changes:
- scripts/batch.ts: Enhanced classifyArticles() with filtering logic
- docker-compose.yml: Added PostgreSQL port mapping (5433:5432)
- .gitignore: Added SECURITY_CHECKLIST.md
```

---

## References

- **Design Document:** `docs/NEWSAPI_QUALITY_SOLUTION.md`
- **Keyword Research:** `docs/BATCH_KEYWORDS_RESEARCH.md`
- **NewsAPI Docs:** https://newsapi.org/docs/endpoints/everything
- **Comparison:** https://newsdata.io/blog/news-api-comparison/
