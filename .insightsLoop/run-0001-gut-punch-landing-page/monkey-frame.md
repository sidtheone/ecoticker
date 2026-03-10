# Monkey Finding — Frame

## Technique: Removal

## Target: RefreshButton becomes a no-op on server-rendered landing page

## Finding

The plan commits to "fully server-rendered landing page, no client fetch" but keeps RefreshButton in layout.tsx. RefreshButton emits `eventBus.emit("ui-refresh")` — but TopicList is a server component and doesn't subscribe to the event bus. On the landing page, clicking refresh does nothing. A button that doesn't work violates "nothing decorative" and "every pixel serves the task."

## Resolution

Add `router.refresh()` (Next.js RSC refresh) to RefreshButton alongside the event bus emit. This re-fetches server components on the current page while preserving event bus behavior for client components on other pages (topic detail).

## Survived: Yes (after adding router.refresh() to RefreshButton)

## Notes

Monkey also flagged TickerBar density loss — but the user explicitly said "ticker bar goes for sure, too much for nothing." User's decision, not a plan gap.
