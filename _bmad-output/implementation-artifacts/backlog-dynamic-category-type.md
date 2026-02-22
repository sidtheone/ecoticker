# Backlog: Make Category Type Dynamic

**Status:** backlog
**Size:** S
**Priority:** Low
**Created:** 2026-02-22

## Problem

The `Category` type in `src/lib/types.ts` is a hardcoded union of 10 values. The database and LLM classification pipeline can produce categories outside this set (e.g., `"environmental policy"`, `"forests"`). When this happens:

1. `CATEGORY_LABELS[cat]` returns `undefined` — filter buttons render blank (no visible text)
2. `TopicCard` category chips render blank
3. TypeScript's `Record<Category, string>` type safety gives false confidence

**Hotfix applied (2026-02-22):** Fallback to title-cased raw string in `TopicGrid.tsx` and `TopicCard.tsx` (`CATEGORY_LABELS[cat] || cat.replace(...)`) — buttons now show text, but the type system is still lying.

## Proposed Solution

### Option A: Dynamic categories (recommended if LLM controls categories)
- Change `Category` type from union to `string`
- Change `CATEGORY_LABELS` from `Record<Category, string>` to `Record<string, string>` (known labels) with fallback
- Remove enum validation in `/api/topics` route (or make it a warning, not a 400)

### Option B: Expand the union (recommended if categories are controlled)
- Add missing categories to the `Category` union (`"forests"`, `"environmental_policy"`, etc.)
- Add corresponding entries to `CATEGORY_LABELS`
- Update Zod validation schemas
- Ensure LLM classification prompt constrains output to allowed categories

### Option C: Normalize at ingestion boundary
- Map LLM-returned categories to nearest known category at the batch pipeline level
- e.g., `"forests"` → `"deforestation"`, `"environmental policy"` → `"climate"`
- Keeps type system tight, handles LLM drift

## Acceptance Criteria

- [ ] No blank category buttons regardless of DB content
- [ ] Type system accurately reflects what categories can exist
- [ ] Category filter works for all categories in DB
- [ ] TopicCard category chip always shows text

## Files to Modify

- `src/lib/types.ts` — `Category` type
- `src/lib/utils.ts` — `CATEGORY_LABELS`
- `src/lib/validation.ts` — Zod schemas (if enum validation exists)
- `src/app/api/topics/route.ts` — `validCategories` check
- `scripts/batch.ts` — LLM classification prompt (if constraining output)
