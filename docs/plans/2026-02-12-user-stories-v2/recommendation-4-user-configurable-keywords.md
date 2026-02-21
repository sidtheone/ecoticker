# Recommendation #4: User-Configurable Keywords

> Meadows: "The loop is open. The user cannot add a topic they care about." Porter: "5 hardcoded keywords means supplier power is Very High — the product only covers what YOU decided matters."

## US-4.1: Add a new search keyword to track
**As a** power user, **I want** to add a search keyword so the system tracks environmental news about it, **so that** I can monitor issues that matter to me.

**Critical naming clarification:** Users add "search keywords" — NOT "topics." The keyword is a search query sent to NewsAPI. The LLM's classification step CREATES topics from the articles that come back. A keyword "PFAS contamination" might produce a topic named "PFAS Water Contamination Crisis" — the LLM chooses the topic name.

**User journey (Morgan, sustainability officer):**
1. Morgan's company manufactures near a river. They want to track "PFAS contamination"
2. Goes to `/admin/keywords` (protected by API key)
3. Types "PFAS contamination" → clicks "Add Keyword"
4. System validates: 2-100 chars, alphanumeric + spaces + hyphens ✓
5. Keyword saved with status "Pending" — next batch run will search for it
6. 6 AM next morning: batch runs. NewsAPI returns 4 articles about PFAS. LLM classifies them. New topic "PFAS Water Contamination" created with a score of 48 (MODERATE).
7. Morgan visits dashboard — sees the new topic.

**What if NewsAPI returns 0 articles for the keyword?**
- Keyword stays in "Pending" state (never transitions to "Active")
- After 3 consecutive batch runs with 0 results, status changes to "No Results"
- User sees this on the keywords admin page and can edit or remove the keyword
- We do NOT create an empty topic with score 0 — that's confusing

**Acceptance Criteria:**
- New `tracked_keywords` table: `id INTEGER PRIMARY KEY, keyword TEXT NOT NULL UNIQUE, active INTEGER DEFAULT 1, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_searched_at DATETIME, result_count INTEGER DEFAULT 0`
- Status values: "pending" (never searched), "active" (producing results), "no_results" (3+ runs, 0 articles), "inactive" (deactivated by user)
- Batch pipeline reads keywords from BOTH env var `KEYWORDS` (backward compat) AND `tracked_keywords` table (active ones)
- New API endpoints:
  - `POST /api/keywords` (admin) — add keyword, validate, check uniqueness
  - `GET /api/keywords` (admin) — list all keywords with status
  - `PATCH /api/keywords/[id]` (admin) — update active status
  - `DELETE /api/keywords/[id]` (admin) — hard delete (remove keyword + optionally its topic)
- Admin UI: `/admin/keywords` page with keyword list + add form
- Validation: 2-100 chars, regex `^[a-zA-Z0-9\s\-]+$`, unique

**Complexity:** M (new table + 4 API endpoints + admin page + batch pipeline integration)
**Dependencies:** None

---

## US-4.2: Deactivate a topic from tracking
**As a** power user, **I want** to stop tracking a topic, **so that** the dashboard stays focused.

**User journey:** Morgan's company resolved the PFAS issue. They don't need to track it anymore. They go to `/admin/keywords`, find "PFAS contamination", click "Deactivate." The keyword's status becomes "inactive." Next batch skips it. The topic remains in the DB with all historical data — Morgan can still view historical scores. But the topic is hidden from the default dashboard view.

**Acceptance Criteria:**
- `PATCH /api/keywords/[id]` with `{ active: false }` → sets status to "inactive"
- Inactive keywords skipped by batch pipeline
- Topics associated with inactive keywords: add `hidden INTEGER DEFAULT 0` to `topics` table. Set `hidden = 1` when keyword deactivated.
- `GET /api/topics` filters out `hidden = 1` by default. Add `?includeHidden=true` for admin views.
- Topic remains accessible via direct URL (`/topic/[slug]`) — data preserved, just hidden from dashboard
- Reactivation: `PATCH /api/keywords/[id]` with `{ active: true }` → sets status back to "pending", unhides topic

**Complexity:** S
**Dependencies:** US-4.1

---

## US-4.3: View tracked keywords and their status
**As a** site administrator, **I want** to see all tracked keywords and their current status, **so that** I can manage what the system monitors.

**User journey:** Operator checks `/admin/keywords` weekly. Sees:
- "climate change" — Active, last searched today, 12 articles
- "PFAS contamination" — Active, last searched today, 4 articles
- "microplastic fish" — No Results (3 runs, 0 articles) — should edit or remove
- "wildfire" — Inactive (deactivated by user)

**Acceptance Criteria:**
- `/admin/keywords` page (same as US-4.1 admin UI) — this is the LIST view
- Table columns: Keyword, Status (with color badge), Last Searched, Article Count, Actions (Activate/Deactivate/Delete)
- Protected by API key (admin auth)
- `GET /api/keywords` returns all keywords with status, last_searched_at, result_count
- Include env-var keywords as "System" type (not editable, not deletable — shown for completeness)

**Complexity:** S
**Dependencies:** US-4.1

---
