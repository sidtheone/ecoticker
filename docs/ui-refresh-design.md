# EcoTicker UI Refresh Button - Design Specification

**Version:** 2.0 (UI-Only Refresh)
**Date:** 2026-02-07
**Status:** Design Phase

---

## 1. Problem Statement

### Current Issues
- Articles and topic data don't refresh after initial page load
- `TopicGrid` only fetches on mount or filter change
- `BiggestMovers` only fetches on mount (no refresh mechanism)
- `TickerBar` auto-refreshes every 5 minutes but user has no manual control
- User cannot see if new data is available without page reload

### User Requirements
- Ability to manually refresh UI data from existing database
- Clear visual feedback during refresh operation
- Fast response (< 2 seconds) since only fetching from database
- No backend batch processing (handled by cron job separately)

---

## 2. Solution Architecture

### 2.1 Simplified Design

**Key Change:** Button only refreshes UI by re-fetching from existing API endpoints
- ❌ Does NOT call `/api/batch` (backend refresh)
- ✅ Does call `/api/topics`, `/api/movers`, `/api/ticker` (UI refresh)
- ⏰ Backend refresh handled by cron job (every 6 hours)

### 2.2 Component Design

#### **RefreshButton Component**
**Location:** `src/components/RefreshButton.tsx`

**Responsibilities:**
- Broadcast refresh event to all data-consuming components
- Display loading state during data fetch (< 2s)
- Show last refresh timestamp
- No API calls - just coordinates component refreshes

**Component Type:** Client component (`"use client"`)

**States:**
- `isRefreshing: boolean` - Loading state
- `lastRefresh: Date | null` - Timestamp of last refresh

**UI Design:**
```
┌─────────────────────────────┐
│  🔄 Refresh                 │  ← Default state
└─────────────────────────────┘

┌─────────────────────────────┐
│  ⏳ Refreshing...           │  ← Loading state (1-2s)
└─────────────────────────────┘

┌─────────────────────────────┐
│  ✓ Just now                 │  ← Success state (auto-reset after 3s)
└─────────────────────────────┘
```

**Visual Placement:**
- Position: Top-right of header, next to theme toggle
- Mobile: Below title on small screens
- Style: Icon button (compact), matches theme toggle style

---

### 2.3 Data Flow Architecture

```
┌──────────────────┐
│  RefreshButton   │
│  (User clicks)   │
└────────┬─────────┘
         │
         └─► Broadcast "refresh" event
             │
             ├─► TopicGrid.refetch() ──► GET /api/topics
             ├─► BiggestMovers.refetch() ──► GET /api/movers
             └─► TickerBar.refetch() ──► GET /api/ticker
```

**Sequence Diagram:**
```
User          RefreshButton    TopicGrid    /api/topics    Database
 │                │                │             │            │
 │─── Click ────>│                │             │            │
 │                │─── Event ────>│             │            │
 │                │                │── GET ────>│            │
 │                │                │             │── Read ──>│
 │                │                │             │<── Data ──│
 │                │                │<── JSON ───│            │
 │<── Refresh ───│<── Done ───────│             │            │
```

**Performance:**
- Total time: **1-2 seconds** (3 parallel API calls)
- No LLM processing, just database reads
- Instant user feedback

---

### 2.4 Event System Design

#### **Custom Event Bus** (Recommended)
Same as previous design, but simpler usage:

```typescript
// src/lib/events.ts
type EventMap = {
  'ui-refresh': void;
};

export const eventBus = {
  emit: <K extends keyof EventMap>(event: K, data?: EventMap[K]) => {
    window.dispatchEvent(new CustomEvent(event, { detail: data }));
  },

  subscribe: <K extends keyof EventMap>(
    event: K,
    callback: (data?: EventMap[K]) => void
  ) => {
    const handler = (e: Event) => callback((e as CustomEvent).detail);
    window.addEventListener(event, handler);
    return () => window.removeEventListener(event, handler);
  },
};
```

**Usage in components:**
```typescript
// RefreshButton.tsx
eventBus.emit('ui-refresh');

// TopicGrid.tsx
useEffect(() => {
  const unsubscribe = eventBus.subscribe('ui-refresh', () => {
    fetchTopics(); // Existing function
  });
  return unsubscribe;
}, []);
```

---

## 3. Component Specifications

### 3.1 RefreshButton Component

**File:** `src/components/RefreshButton.tsx`

**Props:** None

**State:**
```typescript
interface RefreshState {
  isRefreshing: boolean;
  lastRefresh: Date | null;
}
```

**Methods:**
```typescript
async handleRefresh(): Promise<void> {
  // 1. Set loading state
  setIsRefreshing(true);

  // 2. Emit refresh event
  eventBus.emit('ui-refresh');

  // 3. Wait for components to finish (simulate)
  await new Promise(resolve => setTimeout(resolve, 1500));

  // 4. Update timestamp
  setLastRefresh(new Date());
  setIsRefreshing(false);

  // 5. Auto-reset after 3s
  setTimeout(() => setLastRefresh(null), 3000);
}

formatTimestamp(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}
```

**Component Structure:**
```tsx
export default function RefreshButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    eventBus.emit('ui-refresh');

    // Wait for components to finish refreshing
    await new Promise(resolve => setTimeout(resolve, 1500));

    setLastRefresh(new Date());
    setIsRefreshing(false);

    // Reset after 3 seconds
    setTimeout(() => setLastRefresh(null), 3000);
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      aria-label="Refresh dashboard data"
      aria-busy={isRefreshing}
      className="..."
    >
      {isRefreshing ? (
        <>
          <Spinner className="animate-spin" />
          <span>Refreshing...</span>
        </>
      ) : lastRefresh ? (
        <>
          <CheckIcon />
          <span>Just now</span>
        </>
      ) : (
        <>
          <RefreshIcon />
          <span>Refresh</span>
        </>
      )}
    </button>
  );
}
```

**Accessibility:**
- `aria-label="Refresh dashboard data"`
- `aria-busy={isRefreshing}`
- Keyboard accessible (Enter/Space)
- Disabled state during refresh (prevent double-click)

**Theme Support:**
```tsx
// Light mode
bg-[#f5f0e8] hover:bg-[#e8dfd3] text-stone-700

// Dark mode
dark:bg-gray-900 dark:hover:bg-gray-800 dark:text-gray-200
```

**Icon Style (Match ThemeToggle):**
- Size: `h-5 w-5` or `h-4 w-4`
- Padding: `px-3 py-1.5`
- Border: `border border-[#e8dfd3] dark:border-gray-800`
- Rounded: `rounded-md`

---

### 3.2 Modified Components

#### **TopicGrid Modifications**
**File:** `src/components/TopicGrid.tsx`

**Changes:**
1. Add event listener for `'ui-refresh'`
2. Existing `fetchTopics()` already works - just call it
3. Show loading state during refresh

**Code Additions:**
```typescript
useEffect(() => {
  const unsubscribe = eventBus.subscribe('ui-refresh', () => {
    setLoading(true);
    fetchTopics();
  });
  return unsubscribe;
}, [urgencyFilter]); // Re-subscribe when filter changes
```

**No other changes needed!** ✅

---

#### **BiggestMovers Modifications**
**File:** `src/components/BiggestMovers.tsx`

**Changes:**
1. Extract fetch logic into `fetchMovers()` function
2. Add event listener for `'ui-refresh'`
3. Call `fetchMovers()` on refresh event

**Code Additions:**
```typescript
const fetchMovers = useCallback(() => {
  setLoading(true);
  fetch("/api/movers")
    .then((r) => r.json())
    .then((data) => setMovers(data.movers || []))
    .catch(() => setMovers([]))
    .finally(() => setLoading(false));
}, []);

useEffect(() => {
  fetchMovers(); // Initial fetch

  const unsubscribe = eventBus.subscribe('ui-refresh', fetchMovers);
  return unsubscribe;
}, [fetchMovers]);
```

---

#### **TickerBar Modifications**
**File:** `src/components/TickerBar.tsx`

**Changes:**
1. Add event listener for `'ui-refresh'`
2. Reuse existing `fetchTicker()` function

**Code Additions:**
```typescript
useEffect(() => {
  fetchTicker(); // Initial fetch

  const interval = setInterval(fetchTicker, 5 * 60 * 1000); // Auto-refresh every 5min
  const unsubscribe = eventBus.subscribe('ui-refresh', fetchTicker); // Manual refresh

  return () => {
    clearInterval(interval);
    unsubscribe();
  };
}, []);
```

---

### 3.3 Layout Integration

**File:** `src/app/page.tsx`

**Layout Structure:**
```tsx
export default function Home() {
  return (
    <div>
      {/* Header with Theme Toggle + Refresh Button */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-800 dark:text-white">
            EcoTicker
          </h1>
          <p className="text-sm sm:text-base text-stone-400 dark:text-gray-400 mt-1">
            Environmental news impact tracker
          </p>
        </div>

        {/* Theme Toggle + Refresh Button */}
        <div className="flex gap-2">
          <RefreshButton />
          <ThemeToggle />
        </div>
      </div>

      {/* Existing Components */}
      <div className="mb-8">
        <BiggestMovers />
      </div>
      <TopicGrid />
    </div>
  );
}
```

**Mobile Layout:**
```tsx
<div className="mb-8">
  <div className="flex items-start justify-between mb-2">
    <h1 className="text-2xl font-bold text-stone-800 dark:text-white">
      EcoTicker
    </h1>
    {/* Buttons stay on same line on mobile */}
    <div className="flex gap-2">
      <RefreshButton />
      <ThemeToggle />
    </div>
  </div>
  <p className="text-sm text-stone-400 dark:text-gray-400">
    Environmental news impact tracker
  </p>
</div>
```

---

## 4. User Experience Flow

### 4.1 Success Flow (Fast - 1-2s)
1. User clicks "🔄 Refresh" button
2. Button changes to "⏳ Refreshing..." with spinning icon
3. All components show loading state
4. After 1-2s: Components display updated data
5. Button shows "✓ Just now" for 3 seconds
6. Button returns to default "🔄 Refresh" state

### 4.2 No Changes Flow
1. User clicks "🔄 Refresh"
2. Button shows loading state (1-2s)
3. Components reload same data (no changes in DB)
4. Button shows "✓ Just now" (confirms refresh worked)
5. User knows UI is current, even if no visual changes

### 4.3 Network Error Flow
1. User clicks "🔄 Refresh"
2. Button shows loading state
3. If API fails: Component shows existing cached data
4. Button shows "✓ Just now" (best effort)
5. No error message (graceful degradation)

**Rationale:** Since backend refresh is handled by cron, UI refresh failures are non-critical. Components fall back to cached data.

---

## 5. Testing Strategy

### 5.1 Unit Tests

**RefreshButton.test.tsx:**
- ✓ Renders with default state ("Refresh" icon)
- ✓ Shows loading state during refresh
- ✓ Displays "Just now" after refresh
- ✓ Auto-resets to default after 3 seconds
- ✓ Emits 'ui-refresh' event on click
- ✓ Disabled during loading (prevent double-click)
- ✓ Formats timestamp correctly
- ✓ Accessibility: aria-labels, keyboard navigation
- ✓ Theme support: light/dark mode classes

**Event Bus Tests:**
- ✓ Subscribe/unsubscribe works
- ✓ Multiple listeners receive events
- ✓ Cleanup on unmount prevents memory leaks

### 5.2 Integration Tests

**Dashboard Refresh Flow:**
```typescript
test('clicking refresh button updates all components', async () => {
  render(<Home />);

  const refreshButton = screen.getByLabelText('Refresh dashboard data');

  // Mock API responses
  global.fetch = jest.fn((url) => {
    if (url.includes('/api/topics')) return Promise.resolve(mockTopicsResponse);
    if (url.includes('/api/movers')) return Promise.resolve(mockMoversResponse);
    if (url.includes('/api/ticker')) return Promise.resolve(mockTickerResponse);
  });

  // Click refresh
  fireEvent.click(refreshButton);

  // Verify loading state
  expect(refreshButton).toHaveTextContent('Refreshing...');

  // Wait for completion
  await waitFor(() => {
    expect(refreshButton).toHaveTextContent('Just now');
  });

  // Verify all components fetched
  expect(global.fetch).toHaveBeenCalledWith('/api/topics');
  expect(global.fetch).toHaveBeenCalledWith('/api/movers');
  expect(global.fetch).toHaveBeenCalledWith('/api/ticker');
});
```

---

## 6. Performance Considerations

### 6.1 Optimizations
- **Parallel Fetching:** All 3 APIs called simultaneously (< 2s total)
- **Debounce:** Prevent double-clicks (button disabled during refresh)
- **No Rate Limiting:** UI refresh is cheap (just DB reads)
- **Optimistic Updates:** Show loading state immediately

### 6.2 Comparison: UI Refresh vs Full Refresh

| Metric | UI Refresh | Full Refresh (Old Design) |
|--------|-----------|---------------------------|
| **Duration** | 1-2 seconds | 30-90 seconds |
| **API Calls** | 3 (topics, movers, ticker) | 4 (+ batch) |
| **Backend Load** | Low (DB reads) | High (NewsAPI + LLM) |
| **Cost** | Free | $0.02-0.10 per refresh |
| **Rate Limits** | None | NewsAPI 100/day |
| **User Experience** | Instant feedback | Long wait |

**Winner:** UI Refresh ✅

---

## 7. Backend Refresh (Cron Job)

### 7.1 Cron Configuration
**File:** `crontab` (already exists)

```bash
0 */6 * * * curl -X POST http://localhost:3000/api/batch
# Runs every 6 hours: 12am, 6am, 12pm, 6pm UTC
```

**Docker Setup:**
```yaml
# docker-compose.yml
cron:
  image: ecoticker-app
  command: crond -f -l 2
  volumes:
    - ecoticker-data:/app/db
  environment:
    - NEWSAPI_KEY=${NEWSAPI_KEY}
    - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
```

### 7.2 Separation of Concerns

| Component | Responsibility | Trigger |
|-----------|---------------|---------|
| **Cron Job** | Fetch news, classify, score, update DB | Every 6 hours (automatic) |
| **Refresh Button** | Reload UI from existing DB data | User clicks (manual) |

**Benefits:**
- ✅ User gets instant feedback (no 90s wait)
- ✅ Backend refresh happens in background
- ✅ No API quota wasted on UI refreshes
- ✅ Clear separation of concerns

---

## 8. Technical Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Event System** | Custom Event Bus | Type-safe, decoupled, lightweight |
| **Button Action** | Emit event only | No API calls, just coordinates refreshes |
| **Loading Time** | 1-2 seconds | Database reads are fast |
| **Error Handling** | Silent fallback | Non-critical, components cache data |
| **Auto-reset** | 3 seconds | Enough time to see success, then clean |
| **Icon Style** | Match ThemeToggle | Visual consistency |
| **Backend Refresh** | Cron job (6 hours) | Automatic, cost-effective |
| **Rate Limiting** | None | UI refresh is cheap |

---

## 9. Acceptance Criteria

### Feature Complete When:
- ✅ RefreshButton renders next to ThemeToggle
- ✅ Clicking button emits 'ui-refresh' event
- ✅ Loading state displays for 1-2s
- ✅ Success shows "Just now" for 3s
- ✅ All components (TopicGrid, BiggestMovers, TickerBar) refresh
- ✅ Button matches ThemeToggle style (icon, size, theme)
- ✅ Accessible (keyboard, screen readers, ARIA)
- ✅ Unit tests pass (>95% coverage)
- ✅ No console errors
- ✅ Works on mobile (responsive)

---

## 10. Implementation Checklist

### Frontend Components
- [ ] Create `src/lib/events.ts` (event bus utility)
- [ ] Create `src/components/RefreshButton.tsx`
- [ ] Modify `src/components/TopicGrid.tsx` (add event listener)
- [ ] Modify `src/components/BiggestMovers.tsx` (add event listener)
- [ ] Modify `src/components/TickerBar.tsx` (add event listener)
- [ ] Modify `src/app/page.tsx` (add RefreshButton to layout)

### Testing
- [ ] Unit tests: `RefreshButton.test.tsx`
- [ ] Unit tests: `events.test.ts`
- [ ] Integration test: Dashboard refresh flow
- [ ] Manual testing: Light/dark theme, mobile

### Documentation
- [ ] Update `CLAUDE.md` with UI refresh pattern
- [ ] Update `PROJECT_INDEX.md` with new files

---

## 11. File Structure

```
ecoticker/
├── src/
│   ├── lib/
│   │   └── events.ts              ← NEW: Event bus utility
│   ├── components/
│   │   ├── RefreshButton.tsx      ← NEW: UI refresh button
│   │   ├── TopicGrid.tsx          ← MODIFIED: Add event listener
│   │   ├── BiggestMovers.tsx      ← MODIFIED: Add event listener
│   │   └── TickerBar.tsx          ← MODIFIED: Add event listener
│   └── app/
│       └── page.tsx               ← MODIFIED: Add RefreshButton
├── tests/
│   ├── RefreshButton.test.tsx     ← NEW: Component tests
│   └── events.test.ts             ← NEW: Event bus tests
├── crontab                        ← EXISTING: Cron job for backend refresh
└── docs/
    └── ui-refresh-design.md       ← THIS FILE
```

---

## 12. API Reference

### Event Bus API

```typescript
// src/lib/events.ts

type EventMap = {
  'ui-refresh': void;
};

export const eventBus = {
  emit: <K extends keyof EventMap>(event: K, data?: EventMap[K]) => void;
  subscribe: <K extends keyof EventMap>(
    event: K,
    callback: (data?: EventMap[K]) => void
  ) => () => void; // Returns unsubscribe function
};
```

**Usage Examples:**

```typescript
// Emit event (RefreshButton)
import { eventBus } from '@/lib/events';
eventBus.emit('ui-refresh');

// Subscribe to event (TopicGrid)
import { eventBus } from '@/lib/events';

useEffect(() => {
  const unsubscribe = eventBus.subscribe('ui-refresh', () => {
    setLoading(true);
    fetchTopics();
  });
  return unsubscribe; // Cleanup on unmount
}, []);
```

---

## 13. Wireframes

### Desktop Layout
```
┌───────────────────────────────────────────────────┐
│  EcoTicker                    🔄 Refresh  🌙/☀️   │
│  Environmental news impact tracker                │
├───────────────────────────────────────────────────┤
│  Biggest Movers                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Floods   │ │ Deforest │ │ Pollution│          │
│  │ 85  +10▲ │ │ 75  +5▲  │ │ 65  +3▲  │          │
│  └──────────┘ └──────────┘ └──────────┘          │
├───────────────────────────────────────────────────┤
│  [All] [Breaking] [Critical] [Moderate] [Info]   │
│                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Topic 1  │ │ Topic 2  │ │ Topic 3  │          │
│  └──────────┘ └──────────┘ └──────────┘          │
└───────────────────────────────────────────────────┘
```

### Mobile Layout
```
┌────────────────────────┐
│  EcoTicker  🔄 🌙      │
│  Environmental...      │
├────────────────────────┤
│  Biggest Movers        │
│  ┌──────┐ ┌──────┐    │
│  │Floods│ │Defor │    │
│  └──────┘ └──────┘    │
├────────────────────────┤
│  [All] [Breaking]...   │
│  ┌──────────────────┐  │
│  │ Topic Card       │  │
│  └──────────────────┘  │
└────────────────────────┘
```

### Button States (Detailed)
```
Default:
┌─────────────┐
│ 🔄 Refresh  │
└─────────────┘

Loading (1-2s):
┌────────────────────┐
│ ⏳ Refreshing...   │ ← Spinner rotates
└────────────────────┘

Success (3s):
┌─────────────┐
│ ✓ Just now  │
└─────────────┘

After 3s:
┌─────────────┐
│ 🔄 Refresh  │ ← Back to default
└─────────────┘
```

---

## 14. Implementation Estimate

**Total Time:** 2-3 hours

| Task | Time | Complexity |
|------|------|-----------|
| Event bus utility | 15 min | Low |
| RefreshButton component | 45 min | Low |
| Component modifications | 30 min | Low |
| Layout integration | 15 min | Low |
| Unit tests | 45 min | Low |
| Integration + manual testing | 30 min | Low |

**Reduced from 4-6 hours** because:
- No batch API integration
- Simpler logic (just emit event)
- Faster testing (no 90s waits)

---

## 15. Future Enhancements

### 15.1 Short-term
- **Last updated badge:** Show "Last updated: 2 hours ago" in footer
- **Auto-refresh toggle:** Let users enable UI auto-refresh every 5 min
- **Pulse animation:** Subtle pulse on button when data > 6 hours old

### 15.2 Long-term
- **WebSocket updates:** Push notifications when cron job completes
- **Progress indicator:** Show "Backend refreshing..." during cron job
- **Smart refresh:** Only refresh if data timestamp changed

---

## 16. Open Questions

1. **Button placement:** Next to theme toggle (right) or left of it?
   - **Recommendation:** Right side (Refresh | Theme) - refresh is less frequently used

2. **Button text:** Show "Refresh" text or icon only?
   - **Recommendation:** Icon + text on desktop, icon only on mobile

3. **Success duration:** 3 seconds enough for "Just now" message?
   - **Recommendation:** Yes - enough to see, not too long

---

## Next Steps

1. **Approve this simplified design** ✅
2. **Implement RefreshButton** (2-3 hours)
3. **Test on Railway production** (verify cron job still works)
4. **Monitor user behavior** (how often do they click refresh?)

---

**Key Difference from Previous Design:**
- ❌ Old: Button triggers `/api/batch` (90s wait, NewsAPI + LLM)
- ✅ New: Button refreshes UI only (2s, database reads)
- ⏰ Backend refresh: Handled by cron job (automatic every 6 hours)

**Benefits:**
- ⚡ Instant user feedback
- 💰 No API costs for UI refreshes
- 🎯 Clear separation: UI (manual) vs Backend (automatic)
- 📊 Better UX (no long waits)

---

**Document End**
