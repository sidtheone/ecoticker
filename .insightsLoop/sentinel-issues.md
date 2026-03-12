# Sentinel Issues

Discovered: run-0003 retro, 2026-03-12

## Issue: Weak fixture for filtering/aggregation functions

**What happened:**

Contract 1 ("no duplicates → topicsAffected: 0") used `mockDb.mockSelect([])` — empty array. The actual query is a GROUP BY that returns ALL groups including singletons (count=1). The test passed whether or not the implementation had a HAVING/filter, because the mock never gave the implementation anything to filter.

The Shipwright implemented without a filter. All 7 tests passed. The Cartographer caught it at Ship.

**Root cause:**

The Sentinel defined "no duplicates" as *what the mock returns* rather than *what the implementation does with the data it receives*. That's a fixture that describes itself, not a contract that tests behavior.

**Rule to add to Sentinel's brief:**

> For functions that filter or aggregate query results, at least one test must mock the un-filtered data shape and verify the filter is applied — not mock the already-filtered result.

**Correct Contract 1 fixture:**

```typescript
// Mock returns a singleton group (count=1) — the kind the DB actually returns
mockDb.mockSelect([{ topicId: 1, recordedAt: "2026-03-01", count: 1, maxId: 5 }]);

const result = await dedupScoreHistory(db, false);

// Implementation must filter out count=1 groups
expect(result).toEqual({ topicsAffected: 0, rowsDeleted: 0 });
expect(mockDb.chain.delete).not.toHaveBeenCalled();
```

This test would have *failed* with the Shipwright's implementation and *forced* the HAVING filter to be written.

## Fix to apply

In `.claude/skills/insight-sentinel/SKILL.md`, add to the Rules section:

> **For filtering/aggregation functions, mock the unfiltered shape.** If the function is supposed to filter or aggregate query results, at least one test must pass data the implementation must filter out — not data that's already filtered. `mockSelect([])` for a "no matches" contract is not sufficient when the real query returns all rows and the implementation must exclude some.
