# EcoTicker Refresh Button - Design Specification

**Version:** 1.0
**Date:** 2026-02-07
**Status:** Design Phase

---

## 1. Problem Statement

### Current Issues
- Articles and topic data don't refresh after initial page load
- `TopicGrid` only fetches on mount or filter change
- `BiggestMovers` only fetches on mount (no refresh mechanism)
- `TickerBar` auto-refreshes every 5 minutes but doesn't trigger new batch processing
- No user-facing control to trigger fresh news classification from NewsAPI

### User Requirements
- Ability to manually refresh all articles and data points
- Clear visual feedback during refresh operation
- Trigger new batch processing to fetch latest news from NewsAPI

---

## 2. Solution Architecture

### 2.1 Component Design

#### **RefreshButton Component**
**Location:** `src/components/RefreshButton.tsx`

**Responsibilities:**
- Trigger `/api/batch` endpoint (fetch news + classify + score)
- Broadcast refresh event to all data-consuming components
- Display loading state during batch processing
- Handle errors gracefully with user feedback

**Component Type:** Client component (`"use client"`)

**States:**
- `isRefreshing: boolean` - Loading state
- `error: string | null` - Error message
- `lastRefresh: Date | null` - Timestamp of last successful refresh

**UI Design:**
```
┌─────────────────────────────┐
│  🔄 Refresh News            │  ← Default state
└─────────────────────────────┘

┌─────────────────────────────┐
│  ⏳ Fetching latest news... │  ← Loading state (disabled)
└─────────────────────────────┘

┌─────────────────────────────┐
│  ✓ Updated 2 min ago        │  ← Success state (shows timestamp)
└─────────────────────────────┘
```

**Visual Placement:**
- Position: Next to page title (top-right of header)
- Mobile: Below title on small screens
- Style: Matches theme (warm cream/beige light, dark mode support)

---

### 2.2 Data Flow Architecture

```
┌──────────────────┐
│  RefreshButton   │
│  (User clicks)   │
└────────┬─────────┘
         │
         ├─► 1. POST /api/batch
         │   ├─ Fetch news (NewsAPI)
         │   ├─ Classify articles (LLM)
         │   ├─ Score topics (LLM)
         │   └─ Update database
         │
         └─► 2. Broadcast "refresh" event
             │
             ├─► TopicGrid.refetch()
             ├─► BiggestMovers.refetch()
             └─► TickerBar.refetch()
```

**Sequence Diagram:**
```
User          RefreshButton    /api/batch    Database    Components
 │                │                │             │            │
 │─── Click ────>│                │             │            │
 │                │─── POST ────>│             │            │
 │                │                │── Fetch ──>│            │
 │                │                │<── Save ───│            │
 │                │<── 200 OK ────│             │            │
 │                │─── Event("refresh") ───────>│            │
 │                │                │             │── GET ───>│
 │<── Success ───│                │             │<── Data ──│
```

---

### 2.3 Event System Design

#### **Option A: Custom Event Bus** (Recommended)
**Pros:** Type-safe, decoupled, no prop drilling
**Cons:** Requires new utility

```typescript
// src/lib/events.ts
type EventMap = {
  'data-refresh': void;
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
eventBus.emit('data-refresh');

// TopicGrid.tsx
useEffect(() => {
  const unsubscribe = eventBus.subscribe('data-refresh', () => {
    fetchTopics();
  });
  return unsubscribe;
}, []);
```

#### **Option B: React Context + State** (Alternative)
**Pros:** React-native, familiar pattern
**Cons:** More boilerplate, prop drilling

---

### 2.4 API Integration

#### **Batch Endpoint**
**Endpoint:** `POST /api/batch`
**Response Time:** 30-90 seconds (LLM processing)
**Timeout:** 90 seconds

**Request:**
```typescript
fetch('/api/batch', {
  method: 'POST',
  signal: AbortSignal.timeout(90000), // 90s timeout
});
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Batch processing completed successfully",
  "stats": {
    "topicsProcessed": 13,
    "articlesAdded": 16,
    "scoresRecorded": 13,
    "totalTopics": 14,
    "totalArticles": 17
  },
  "timestamp": "2026-02-07T23:02:52.276Z"
}
```

**Error Response (500):**
```json
{
  "error": "Batch processing failed",
  "details": "NewsAPI rate limit exceeded",
  "timestamp": "2026-02-07T23:02:52.276Z"
}
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
  error: string | null;
  lastRefresh: Date | null;
  stats: BatchStats | null;
}

interface BatchStats {
  topicsProcessed: number;
  articlesAdded: number;
  totalTopics: number;
  totalArticles: number;
}
```

**Methods:**
```typescript
async handleRefresh(): Promise<void> {
  // 1. Set loading state
  // 2. Call /api/batch
  // 3. On success: emit event, update timestamp, show stats
  // 4. On error: display error message
  // 5. Reset loading state
}

formatTimestamp(date: Date): string {
  // "2 min ago" | "1 hour ago" | "Just now"
}
```

**Accessibility:**
- `aria-label="Refresh environmental news data"`
- `aria-busy={isRefreshing}`
- `aria-live="polite"` for status messages
- Keyboard accessible (Enter/Space)

**Theme Support:**
- Light mode: `bg-[#f5f0e8]` hover `bg-[#e8dfd3]`, `text-stone-700`
- Dark mode: `dark:bg-gray-900` hover `dark:bg-gray-800`, `dark:text-gray-200`

---

### 3.2 Modified Components

#### **TopicGrid Modifications**
**File:** `src/components/TopicGrid.tsx`

**Changes:**
1. Add event listener for `'data-refresh'`
2. Extract `fetchTopics()` to be reusable
3. Call `fetchTopics()` on refresh event

**Code Additions:**
```typescript
useEffect(() => {
  const unsubscribe = eventBus.subscribe('data-refresh', () => {
    setLoading(true);
    fetchTopics();
  });
  return unsubscribe;
}, [urgencyFilter]);
```

#### **BiggestMovers Modifications**
**File:** `src/components/BiggestMovers.tsx`

**Changes:**
1. Add event listener for `'data-refresh'`
2. Extract fetch logic to `fetchMovers()`
3. Call `fetchMovers()` on refresh event

#### **TickerBar Modifications**
**File:** `src/components/TickerBar.tsx`

**Changes:**
1. Add event listener for `'data-refresh'`
2. Reuse existing `fetchTicker()` on refresh event

---

### 3.3 Layout Integration

**File:** `src/app/page.tsx`

**Layout Structure:**
```tsx
<div>
  {/* Header with Refresh Button */}
  <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold text-stone-800 dark:text-white">
        EcoTicker
      </h1>
      <p className="text-sm sm:text-base text-stone-400 dark:text-gray-400 mt-1">
        Environmental news impact tracker
      </p>
    </div>
    <RefreshButton />
  </div>

  {/* Existing Components */}
  <div className="mb-8">
    <BiggestMovers />
  </div>
  <TopicGrid />
</div>
```

---

## 4. User Experience Flow

### 4.1 Success Flow
1. User clicks "🔄 Refresh News" button
2. Button changes to "⏳ Fetching latest news..." (disabled)
3. Spinner icon animates (rotate)
4. After 30-90s: Success toast/message appears
5. Button shows "✓ Updated just now"
6. All components reload data automatically
7. After 5s: Button returns to default state

### 4.2 Error Flow
1. User clicks "🔄 Refresh News" button
2. Button shows loading state
3. If timeout/error: Error message displays
4. Error text: "Failed to refresh. Please try again."
5. Button returns to default state (clickable)
6. User can retry immediately

### 4.3 Rate Limiting
- No built-in rate limiting (rely on NewsAPI limits)
- Show warning if refresh < 1 minute since last refresh
- Optional: Disable button for 30s after successful refresh

---

## 5. Testing Strategy

### 5.1 Unit Tests

**RefreshButton.test.tsx:**
- ✓ Renders with default state
- ✓ Shows loading state during fetch
- ✓ Displays success message after batch
- ✓ Handles errors gracefully
- ✓ Emits refresh event on success
- ✓ Formats timestamp correctly ("2 min ago")
- ✓ Accessibility: aria-labels, keyboard navigation

**Event Bus Tests:**
- ✓ Subscribe/unsubscribe works
- ✓ Multiple listeners receive events
- ✓ Type safety enforced

### 5.2 Integration Tests

**Dashboard Refresh Flow:**
- ✓ Click refresh → all components reload
- ✓ TopicGrid updates after batch
- ✓ BiggestMovers updates after batch
- ✓ TickerBar updates after batch

### 5.3 E2E Tests (Optional)

**User Journey:**
1. Load dashboard → see stale data
2. Click refresh button → loading state
3. Wait 60s → new topics appear
4. Verify timestamp shows "Just now"

---

## 6. Performance Considerations

### 6.1 Optimizations
- **Debounce:** Prevent double-clicks (500ms debounce)
- **Caching:** Cache batch response for 30s (avoid duplicate calls)
- **Optimistic Updates:** Show loading state immediately
- **Abort Controller:** Cancel in-flight requests if user navigates away

### 6.2 Monitoring
- Log batch processing time (NewRelic/Sentry)
- Track success/failure rates
- Monitor NewsAPI quota usage

---

## 7. Security Considerations

### 7.1 Rate Limiting
- **Client-side:** Debounce (500ms), cooldown (30s)
- **Server-side:** Consider adding rate limit middleware (e.g., 1 batch per minute per IP)

### 7.2 API Key Protection
- Batch endpoint already uses server-side env vars
- No client-side exposure of NEWSAPI_KEY or OPENROUTER_API_KEY

---

## 8. Deployment Strategy

### 8.1 Rollout Plan
1. **Phase 1:** Create RefreshButton component + event bus
2. **Phase 2:** Modify components to listen for refresh event
3. **Phase 3:** Integrate into page.tsx layout
4. **Phase 4:** Add tests
5. **Phase 5:** Deploy to Railway

### 8.2 Rollback Plan
- Remove RefreshButton import from page.tsx
- Components continue to work as before (no breaking changes)

---

## 9. Future Enhancements

### 9.1 Short-term
- **Auto-refresh toggle:** Let users enable/disable auto-refresh every 30 min
- **Notification badge:** Show "New data available" badge before refresh

### 9.2 Long-term
- **Real-time updates:** WebSocket/SSE for live topic updates
- **Partial refresh:** Refresh only specific topics (not full batch)
- **Refresh history:** Log of past refreshes with stats

---

## 10. Technical Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Event System** | Custom Event Bus | Type-safe, decoupled, no prop drilling |
| **Loading State** | Local state in RefreshButton | Simple, no global state needed |
| **Error Handling** | Inline error message | Clear user feedback without modal |
| **Timestamp Format** | Relative ("2 min ago") | Better UX than absolute timestamps |
| **API Timeout** | 90 seconds | Matches LLM processing time |
| **Rate Limiting** | Client-side debounce only | Keep it simple, rely on NewsAPI limits |
| **Theme Support** | Tailwind dark: variants | Consistent with existing theme system |

---

## 11. Acceptance Criteria

### Feature Complete When:
- ✅ RefreshButton component renders on dashboard
- ✅ Clicking button triggers `/api/batch` endpoint
- ✅ Loading state displays during processing (30-90s)
- ✅ Success shows timestamp "Updated X min ago"
- ✅ Errors display user-friendly message
- ✅ All components (TopicGrid, BiggestMovers, TickerBar) refresh automatically
- ✅ Button supports light/dark theme
- ✅ Accessible (keyboard, screen readers)
- ✅ Unit tests pass (>95% coverage)
- ✅ No console errors in production

---

## 12. Implementation Checklist

### Backend (No changes needed)
- ✅ `/api/batch` endpoint exists and works

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
- [ ] Integration tests: Dashboard refresh flow
- [ ] Manual testing: Light/dark theme, mobile responsive

### Documentation
- [ ] Update `CLAUDE.md` with refresh button pattern
- [ ] Update `PROJECT_INDEX.md` with new files

---

## 13. File Structure

```
ecoticker/
├── src/
│   ├── lib/
│   │   └── events.ts              ← NEW: Event bus utility
│   ├── components/
│   │   ├── RefreshButton.tsx      ← NEW: Refresh button component
│   │   ├── TopicGrid.tsx          ← MODIFIED: Add event listener
│   │   ├── BiggestMovers.tsx      ← MODIFIED: Add event listener
│   │   └── TickerBar.tsx          ← MODIFIED: Add event listener
│   └── app/
│       └── page.tsx               ← MODIFIED: Add RefreshButton to layout
├── tests/
│   ├── RefreshButton.test.tsx     ← NEW: Component tests
│   └── events.test.ts             ← NEW: Event bus tests
└── docs/
    └── refresh-button-design.md   ← THIS FILE
```

---

## 14. API Reference

### Event Bus API

```typescript
// src/lib/events.ts

type EventMap = {
  'data-refresh': void;
  // Future events can be added here
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
// Emit event (in RefreshButton)
import { eventBus } from '@/lib/events';
eventBus.emit('data-refresh');

// Subscribe to event (in TopicGrid)
import { eventBus } from '@/lib/events';

useEffect(() => {
  const unsubscribe = eventBus.subscribe('data-refresh', () => {
    fetchTopics();
  });
  return unsubscribe; // Cleanup on unmount
}, []);
```

---

## 15. Wireframes

### Desktop Layout
```
┌─────────────────────────────────────────────────────┐
│  EcoTicker                    🔄 Refresh News       │
│  Environmental news impact tracker                  │
├─────────────────────────────────────────────────────┤
│  Biggest Movers                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Floods   │ │ Deforest │ │ Pollution│            │
│  │ 85  +10▲ │ │ 75  +5▲  │ │ 65  +3▲  │            │
│  └──────────┘ └──────────┘ └──────────┘            │
├─────────────────────────────────────────────────────┤
│  [All] [Breaking] [Critical] [Moderate] [Info]     │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Topic 1  │ │ Topic 2  │ │ Topic 3  │            │
│  └──────────┘ └──────────┘ └──────────┘            │
└─────────────────────────────────────────────────────┘
```

### Mobile Layout
```
┌──────────────────────┐
│  EcoTicker           │
│  Environmental...    │
│  ┌────────────────┐  │
│  │ 🔄 Refresh     │  │
│  └────────────────┘  │
├──────────────────────┤
│  Biggest Movers      │
│  ┌──────┐ ┌──────┐  │
│  │Floods│ │Defor │  │
│  └──────┘ └──────┘  │
├──────────────────────┤
│  [All] [Breaking]... │
│  ┌────────────────┐  │
│  │ Topic Card     │  │
│  └────────────────┘  │
└──────────────────────┘
```

---

## 16. Open Questions

1. **Rate limiting:** Should we add server-side rate limiting (1 req/min per IP)?
   - **Recommendation:** Start without, add if abuse occurs

2. **Auto-refresh:** Should button auto-trigger on page load if data > 24h old?
   - **Recommendation:** No - let users control refreshes (NewsAPI has limits)

3. **Progress indicator:** Show detailed progress (1/4 steps: fetching, classifying...)?
   - **Recommendation:** Simple spinner first, add progress later if users request

4. **Success notification:** Toast vs inline message vs modal?
   - **Recommendation:** Inline message in button (least intrusive)

---

## Next Steps

1. **Review this design** with team/stakeholders
2. **Approve architecture decisions** (event bus vs context, UI placement)
3. **Create implementation plan** (estimate: 4-6 hours)
4. **Execute implementation** using `/sc:implement`
5. **Deploy to Railway** and monitor

---

**Document End**
