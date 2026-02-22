# EMERGENCY FIX: Article Newsworthiness Filter

**Date:** 2026-02-18
**Priority:** CRITICAL — 39% of production articles are junk Q&A content
**Status:** READY FOR IMPLEMENTATION

---

## Problem

The batch pipeline's classification prompt (`scripts/batch.ts:161-199`) only checks **topical relevance** — is the article about an environmental topic? It does NOT check **newsworthiness** — is this a real news event?

### Impact (from production audit)
- **7 of 18 articles (39%) are Q&A/educational junk** — not news
- **6 of 7 junk articles** come from `lifesciencesworld.com` (SEO Q&A farm)
- **3 entire topics are fake** — built on zero real news articles:
  - "Ocean Acidification" (scored 85 BREAKING — actually a Q&A listicle)
  - "Climate Impacts on Aquatic Life" (scored 53 — Q&A article)
  - Plus articles contaminating 3 other topics
- Junk articles inflate scores because the LLM scores the *topic* severity, not the *article's* actual reporting

### Root Cause
The classifier's REJECT list catches celebrity news, sports, pet care etc. — but **environmental Q&A articles** pass the topical relevance check because they ARE about environmental topics. The prompt has no concept of "is this actual journalism reporting a real event?"

---

## Fix Plan (2 changes, both in `scripts/batch.ts`)

### Fix 1: Domain Blacklist (pre-filter before LLM)

**Location:** `scripts/batch.ts` — new constant + filter in `fetchNews()` or before `classifyArticles()`

**Add a blocked domains list:**
```typescript
const BLOCKED_DOMAINS = [
  'lifesciencesworld.com',
  'alltoc.com',
];
```

**Filter articles before classification** — strip any article whose URL hostname matches a blocked domain. This is a hard filter that saves LLM tokens and prevents these sites from ever entering the pipeline.

**Why:** 6 of 7 junk articles came from `lifesciencesworld.com`. Domain-level blocking is fast, cheap, and deterministic. New junk domains can be added as discovered.

### Fix 2: Newsworthiness Criteria in Classifier Prompt

**Location:** `scripts/batch.ts:161-199` — the `classifyArticles()` prompt

**Add to the ❌ REJECT section:**
```
- Q&A articles, FAQs, and "What is..." / "How does..." / "Why do..." educational content
- Evergreen/educational explainers with no specific date, event, or incident
- Listicles and trivia ("3 effects of...", "10 facts about...")
- Articles where the title is a question (strong signal of Q&A, not news)
- Research papers or academic studies (unless reporting on NEW findings with real-world impact)
```

**Add a new instruction block after REJECT:**
```
🔍 NEWSWORTHINESS TEST — An article must pass ALL of these to be included:
1. Reports on a SPECIFIC recent event, incident, or development (not general knowledge)
2. Contains a date reference, named location, or specific actors/organizations
3. Is written as journalism (news report, investigation, analysis) — NOT as Q&A, FAQ, tutorial, or educational explainer
4. Title is a statement, not a question (questions indicate Q&A content)
```

### Fix 3: Clear production data and re-run batch

After deploying the fix:
1. Clear all data from production DB (articles, score_history, topic_keywords, topics)
2. Re-run `scripts/batch.ts` against production
3. Verify zero Q&A articles survive
4. Verify all topics are backed by real news events

---

## Files to Modify

| File | Change |
|------|--------|
| `scripts/batch.ts` | Add `BLOCKED_DOMAINS` constant, add pre-filter, update classifier prompt |
| `tests/batch.test.ts` | Add test: Q&A article titles are rejected, blocked domains are filtered |

---

## Acceptance Criteria

- [ ] `lifesciencesworld.com` and `alltoc.com` articles never enter the pipeline
- [ ] Q&A format articles ("What are...", "How does...") are rejected by the classifier
- [ ] Evergreen/educational content is rejected
- [ ] All production topics are backed by at least 1 real news article
- [ ] All existing tests still pass (266/266)
- [ ] New tests cover: domain blacklist filtering, Q&A title rejection

---

## Verification (post-deploy)

```bash
# 1. Clear production data
DATABASE_URL="..." npx tsx -e "..."

# 2. Run batch
DATABASE_URL="..." OPENROUTER_MODEL="deepseek/deepseek-chat" npx tsx scripts/batch.ts

# 3. Audit — zero Q&A articles should appear
curl -s https://ecoticker.sidsinsights.com/api/topics | python3 -c "..."
```

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Over-filtering real news with question headlines | The newsworthiness test requires ALL 4 criteria — a real news article with a question headline will still pass if it has a date, location, and is written as journalism |
| New junk domains appearing | BLOCKED_DOMAINS is easily extensible; the prompt-level filter catches the pattern regardless of domain |
| LLM ignoring the new instructions | DeepSeek V3.2 is a 685B model — reliable at following detailed prompts. The domain blacklist is a hard pre-filter that doesn't depend on the LLM |
