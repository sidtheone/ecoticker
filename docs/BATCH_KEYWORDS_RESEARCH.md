# Batch Keywords Research - Environmental News

**Date:** 2026-02-13
**Purpose:** Optimize BATCH_KEYWORDS for relevant environmental news articles
**Source:** NewsAPI filtering research + 2026 trending topics analysis

---

## Category-Based Keywords

### 🌊 Ocean & Marine (High Activity in 2026)
```
"ocean acidification"
"coral bleaching"
"microplastic pollution"
"marine biodiversity"
"overfishing crisis"
"dead zones ocean"
"sea level rise"
```

**Why these work:**
- Specific enough to avoid false positives
- Active news coverage in 2026
- Quote marks ensure exact phrase matching
- Measurable impacts (easier for LLM scoring)

**Example articles expected:**
- "Pacific Ocean Acidification Reaches Record Levels"
- "Great Barrier Reef Suffers Fifth Mass Bleaching Event"
- "Microplastics Found in 90% of Ocean Species"

---

### 🌳 Biodiversity & Habitats
```
"species extinction"
"habitat destruction"
"biodiversity collapse"
"endangered species"
"wildlife population decline"
"tropical deforestation"
"Amazon rainforest loss"
```

**Why these work:**
- Trending topic: 68% wildlife decline (1970-2016)
- UK intelligence classified biodiversity as security threat
- Concrete metrics available (species counts, hectares lost)

**Example articles expected:**
- "500 Land Species Face Extinction Within 20 Years"
- "Amazon Deforestation Hits Decade High"
- "Insect Populations Crash 75% in Protected Areas"

---

### 🌡️ Climate & Extreme Weather
```
"climate tipping point"
"extreme weather events"
"record heatwave"
"catastrophic flooding"
"wildfire severity"
"drought emergency"
"glacier melting"
```

**Why these work:**
- 2026 trending: Earth nearing "point of no return"
- Specific events vs generic "climate change"
- Clear severity indicators for scoring

**Example articles expected:**
- "Scientists Warn Earth Nearing Climate Point of No Return"
- "Category 6 Hurricane Proposal After Record Storms"
- "European Heatwave Breaks 500-Year Records"

---

### 🏭 Pollution & Contamination
```
"air quality emergency"
"PFAS contamination"
"forever chemicals"
"toxic waste spill"
"PM2.5 levels"
"water pollution crisis"
"industrial emissions"
```

**Why these work:**
- Measurable pollutants (PM2.5, PFAS concentrations)
- Health impacts clear (respiratory illness, cancer)
- Economic costs quantifiable

**Example articles expected:**
- "Delhi Air Quality Reaches Hazardous PM2.5 Levels"
- "PFAS Forever Chemicals Found in 97% of US Drinking Water"
- "Chemical Plant Explosion Contaminates River System"

---

### ⚡ Energy & Emissions
```
"carbon emissions record"
"fossil fuel expansion"
"renewable energy milestone"
"coal plant closure"
"methane leaks"
"carbon capture failure"
```

**Why these work:**
- Mix of positive (renewables) and negative (fossil fuels)
- Quantifiable metrics (tons CO2, MW capacity)
- Economic and policy angles

**Example articles expected:**
- "Global Carbon Emissions Hit New Record Despite Pledges"
- "Renewable Energy Surpasses Coal for First Time in Asia"
- "Methane Super-Emitter Satellites Detect 1,000+ Leaks"

---

## NewsAPI Query Syntax Best Practices

### Boolean Operators
```bash
# Require specific terms (AND)
"climate change" AND adaptation AND funding

# Exclude irrelevant topics (NOT)
"biodiversity loss" NOT cryptocurrency NOT stocks

# Alternative keywords (OR)
"coral bleaching" OR "reef degradation" OR "ocean acidification"
```

### Field-Specific Searches
```bash
# Search only in titles (more relevant)
title:"climate emergency"

# Search in descriptions
description:"carbon emissions"
```

### Advanced Filtering
```bash
# Combine operators
("ocean warming" OR "sea temperature") AND NOT sports
```

---

## Recommended BATCH_KEYWORDS Sets

### Option 1: Balanced Coverage (Recommended)
```bash
BATCH_KEYWORDS="ocean acidification","coral bleaching","species extinction","climate tipping point","PFAS contamination","wildfire severity","carbon emissions record","tropical deforestation"
```

**Expected:** 8-15 articles per batch, diverse topics, high relevance

**Pros:**
- Covers all major environmental categories
- Specific enough to avoid false positives
- Balanced positive/negative news

**Cons:**
- May miss niche environmental stories
- 8 keywords = 8 NewsAPI calls (free tier: 100/day)

---

### Option 2: High-Impact Focus
```bash
BATCH_KEYWORDS="biodiversity collapse","climate tipping point","ocean acidification","PFAS contamination","extreme weather events"
```

**Expected:** 10-20 articles per batch, high-severity topics

**Pros:**
- Focuses on crisis-level events (SIGNIFICANT/SEVERE scores)
- Fewer API calls (5 keywords)
- Maximizes alarm value for users

**Cons:**
- Misses moderate environmental issues
- Less diverse topic coverage
- May be too alarmist

---

### Option 3: Specific + Measurable
```bash
BATCH_KEYWORDS="PM2.5 levels","coral bleaching event","Amazon deforestation rate","Arctic sea ice minimum","species extinction rate"
```

**Expected:** 5-10 articles per batch, highly quantifiable

**Pros:**
- Every keyword has measurable metrics
- Easier for LLM to score (numeric data in articles)
- High relevance to health/eco/econ impacts

**Cons:**
- May miss qualitative environmental stories
- Requires specific terminology in news articles
- Lower volume of results

---

### Option 4: Trending 2026 Topics
```bash
BATCH_KEYWORDS="microplastic ocean","biodiversity security threat","climate point of no return","forever chemicals regulation","High Seas Treaty"
```

**Expected:** 12-18 articles per batch, current events focus

**Pros:**
- Aligned with 2026 trending topics
- High media coverage (more articles available)
- Mix of crisis (microplastics) and solutions (High Seas Treaty)

**Cons:**
- May become outdated as news cycles change
- Some keywords may fade after initial coverage spike

---

## NewsAPI Advanced Filters (For Later)

### Domain Filtering (Pro Tier)
```bash
# Prioritize reputable sources
domains=bbc.co.uk,reuters.com,apnews.com,theguardian.com

# Exclude low-quality sources
excludeDomains=dailymail.co.uk,buzzfeed.com
```

### Language & Region
```bash
language=en
# For specific regions
q="deforestation" AND (Brazil OR Indonesia)
```

### Date Range
```bash
# Last 24 hours only
from=2026-02-12T00:00:00Z
to=2026-02-13T00:00:00Z
```

---

## Implementation Guide

### Step 1: Update .env
```bash
# Choose one of the recommended sets above
BATCH_KEYWORDS="ocean acidification","coral bleaching","species extinction","climate tipping point","PFAS contamination","wildfire severity","carbon emissions record","tropical deforestation"
```

### Step 2: Test with Specific Query
```bash
# Test a single keyword first
curl -s "https://newsapi.org/v2/everything?q=\"ocean+acidification\"&sortBy=publishedAt&language=en&pageSize=5&apiKey=$NEWSAPI_KEY" | jq '.articles[] | {title, description}'
```

### Step 3: Run Batch Pipeline
```bash
npx tsx scripts/batch.ts
```

### Step 4: Verify Results
```bash
# Check classified topics
curl -s http://localhost:3000/api/topics | jq '.topics[] | {name, currentScore, urgency, articleCount}'
```

---

## Quality Metrics to Track

### Relevance Rate
```
Target: >80% articles are environmental news
Measure: Manual review of 10 random articles per batch
```

### Topic Diversity
```
Target: 3-5 unique topics per batch
Measure: Count distinct topic names in database
```

### Severity Distribution
```
Target: Mix of all urgency levels (not all critical/breaking)
Measure: SELECT urgency, COUNT(*) FROM topics GROUP BY urgency
```

### Article Freshness
```
Target: <24 hours old
Measure: Check publishedAt timestamps
```

---

## Troubleshooting

### Problem: Still Getting Irrelevant Results
**Solution 1:** Add NOT filters
```bash
BATCH_KEYWORDS="climate change" NOT celebrity NOT entertainment
```

**Solution 2:** Use exact phrases only (quote marks)
```bash
BATCH_KEYWORDS="climate crisis","biodiversity loss"  # NOT climate,biodiversity
```

**Solution 3:** Add domain filtering (requires Pro tier)
```bash
domains=scientificamerican.com,nationalgeographic.com,nature.com
```

### Problem: Too Few Articles
**Solution:** Broaden keywords slightly
```bash
# Instead of "Arctic sea ice minimum"
# Use "Arctic sea ice" OR "polar ice melt"
```

### Problem: All Articles Scored as SEVERE
**Solution:** Include positive environmental news
```bash
BATCH_KEYWORDS="renewable energy milestone","conservation success","species recovery"
```

---

## Sources

- [NewsAPI Documentation - Everything Endpoint](https://newsapi.org/docs/endpoints/everything)
- [Top 5 Filters For News API](https://newsdata.io/blog/top-filters-for-news-api/)
- [16 Biggest Environmental Problems 2026](https://earth.org/the-biggest-environmental-problems-of-our-lifetime/)
- [Biodiversity Loss Security Threat](https://theecologist.org/2026/jan/29/biodiversity-loss-threat-security)
- [Ocean Microplastics Crisis](https://www.sciencedaily.com/releases/2026/01/260116035322.htm)

---

**Last Updated:** 2026-02-13
**Next Review:** After 1 week of batch runs (analyze topic quality)
