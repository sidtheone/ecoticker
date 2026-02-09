# Component Guide: EcoTicker

A comprehensive guide to all React components in the EcoTicker application.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Theme System](#theme-system)
- [Layout Components](#layout-components)
- [Data Display Components](#data-display-components)
- [Visualization Components](#visualization-components)
- [Component Patterns](#component-patterns)

---

## Architecture Overview

### Component Hierarchy

```
App Layout (layout.tsx)
├── ThemeProvider
│   ├── FOUC Prevention Script
│   ├── TickerBar
│   ├── ThemeToggle
│   └── Page Content
│       ├── Dashboard (page.tsx)
│       │   ├── BiggestMovers
│       │   │   └── TopicCard[]
│       │   └── TopicGrid
│       │       └── TopicCard[]
│       └── Topic Detail ([slug]/page.tsx)
│           ├── ScoreChart
│           └── ArticleList
```

### Design Principles

1. **Server Components by Default**: All components are Server Components unless they need client-side interactivity
2. **Client Components**: Only for theme management, data fetching, and interactive UI
3. **Data Fetching**: Performed at the page/component level, not in parent layouts
4. **Type Safety**: All props and data structures are TypeScript typed
5. **Accessibility**: Semantic HTML, ARIA labels, keyboard navigation

---

## Theme System

### ThemeProvider

**Location:** `src/components/ThemeProvider.tsx`

**Purpose:** Provides theme context (light/dark mode) to all components with localStorage persistence.

**Type:** Client Component (`'use client'`)

#### API

```typescript
type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

function ThemeProvider({ children }: { children: React.ReactNode }): JSX.Element
function useTheme(): ThemeContextType
```

#### Usage

```tsx
// Wrap app in ThemeProvider (already done in layout.tsx)
import { ThemeProvider } from '@/components/ThemeProvider';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

// Use theme in components
import { useTheme } from '@/components/ThemeProvider';

function MyComponent() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div>
      Current theme: {theme}
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  );
}
```

#### Implementation Details

- **Priority:** localStorage → OS preference (`prefers-color-scheme`) → light default
- **Persistence:** Saves to `localStorage.theme` on every change
- **FOUC Prevention:** Inline script in layout.tsx reads localStorage before React hydration
- **OS Sync:** Listens to `prefers-color-scheme` media query changes

#### Styling Pattern

```tsx
// Use Tailwind dark: variants for theme-aware styling
<div className="bg-cream-50 dark:bg-gray-900 text-stone-900 dark:text-white">
  Content adapts to theme
</div>
```

---

### ThemeToggle

**Location:** `src/components/ThemeToggle.tsx`

**Purpose:** Button to toggle between light and dark themes.

**Type:** Client Component

#### API

```typescript
function ThemeToggle(): JSX.Element
```

#### Usage

```tsx
import ThemeToggle from '@/components/ThemeToggle';

// Already included in layout.tsx
<ThemeToggle />
```

#### Features

- **Fixed Position:** Top-right corner of viewport
- **Icons:** Sun icon for light mode, moon icon for dark mode
- **Accessible:** ARIA labels for screen readers
- **Smooth Transitions:** CSS transitions on all theme changes

#### Customization

```tsx
// Position and styling via Tailwind classes
className="fixed top-4 right-4 z-50 rounded-lg p-2
           bg-cream-100 dark:bg-gray-800
           hover:bg-cream-200 dark:hover:bg-gray-700"
```

---

## Layout Components

### TickerBar

**Location:** `src/components/TickerBar.tsx`

**Purpose:** Scrolling marquee display of top environmental topics (stock ticker style).

**Type:** Client Component

#### API

```typescript
function TickerBar(): JSX.Element
```

#### Features

- **Auto-refresh:** Fetches new data every 5 minutes
- **Seamless Scrolling:** Doubles content to create infinite loop effect
- **Top 15 Topics:** Displays highest-priority environmental issues
- **Click-through:** Each item links to topic detail page

#### Data Source

Fetches from `GET /api/ticker`:
```typescript
interface TickerItem {
  slug: string;
  title: string;
  score: number;
  change: number;
  urgency: 'breaking' | 'critical' | 'moderate' | 'informational';
}
```

#### Usage

```tsx
import TickerBar from '@/components/TickerBar';

// In layout.tsx (sticky at top)
<div className="sticky top-0 z-40">
  <TickerBar />
</div>
```

#### Styling

- **Sticky Position:** Remains visible during scroll
- **Overflow Hidden:** Clips content to viewport width
- **Animation:** CSS `@keyframes scroll` for smooth movement
- **Color Coding:** Urgency-based text colors (red/orange/yellow/green)

#### Implementation Notes

```tsx
// Content doubling for seamless loop
<div className="flex animate-scroll">
  {/* Original items */}
  {items.map((item) => <TickerItem key={item.slug} {...item} />)}
  {/* Duplicated items for seamless effect */}
  {items.map((item) => <TickerItem key={`${item.slug}-dup`} {...item} />)}
</div>
```

---

### TopicGrid

**Location:** `src/components/TopicGrid.tsx`

**Purpose:** Filterable grid display of all environmental topics.

**Type:** Client Component

#### API

```typescript
interface Filter {
  label: string;
  value: 'all' | 'breaking' | 'critical' | 'moderate' | 'informational';
}

function TopicGrid(): JSX.Element
```

#### Features

- **Filtering:** By urgency level (all/breaking/critical/moderate/informational)
- **Responsive Grid:** 1-3 columns based on screen size
- **Loading State:** Skeleton UI during data fetch
- **Empty State:** Message when no topics match filter

#### Data Source

Fetches from `GET /api/topics?urgency={filter}`:
```typescript
interface Topic {
  id: number;
  slug: string;
  title: string;
  description: string;
  currentScore: number;
  previousScore: number | null;
  change: number;
  urgency: string;
  category: string;
  region: string;
  articleCount: number;
  updatedAt: string;
  sparkline: number[];
}
```

#### Usage

```tsx
import TopicGrid from '@/components/TopicGrid';

// In dashboard page
<main>
  <h1>Environmental Impact Dashboard</h1>
  <TopicGrid />
</main>
```

#### Filter Buttons

```tsx
const FILTERS = [
  { label: 'All Topics', value: 'all' },
  { label: 'Breaking', value: 'breaking' },
  { label: 'Critical', value: 'critical' },
  { label: 'Moderate', value: 'moderate' },
  { label: 'Informational', value: 'informational' },
];

// Active filter styling
className={`px-4 py-2 rounded-lg transition-colors ${
  activeFilter === filter.value
    ? 'bg-blue-600 text-white'
    : 'bg-cream-100 dark:bg-gray-800 hover:bg-cream-200 dark:hover:bg-gray-700'
}`}
```

---

## Data Display Components

### TopicCard

**Location:** `src/components/TopicCard.tsx`

**Purpose:** Display summary of a single environmental topic with score, trend, and metadata.

**Type:** Server Component

#### API

```typescript
interface TopicCardProps {
  topic: {
    slug: string;
    title: string;
    description: string;
    currentScore: number;
    previousScore: number | null;
    change: number;
    urgency: string;
    category: string;
    region: string;
    articleCount: number;
    sparkline: number[];
  };
}

function TopicCard({ topic }: TopicCardProps): JSX.Element
```

#### Features

- **Score Display:** Large, color-coded score (0-100)
- **Change Indicator:** Shows score delta with up/down arrow
- **Urgency Badge:** Color-coded badge (red/orange/yellow/green)
- **Sparkline:** Mini chart showing 7-day trend
- **Metadata:** Category, region, article count
- **Click-through:** Links to detailed topic page

#### Usage

```tsx
import TopicCard from '@/components/TopicCard';

<TopicCard topic={{
  slug: 'wildfire-impact',
  title: 'Wildfire Impact (Western US)',
  description: 'Tracking wildfire severity',
  currentScore: 78,
  previousScore: 72,
  change: 6,
  urgency: 'critical',
  category: 'ecology',
  region: 'Western US',
  articleCount: 12,
  sparkline: [65, 68, 72, 75, 78]
}} />
```

#### Visual Structure

```
┌─────────────────────────────────┐
│ Wildfire Impact (Western US)    │
│ Tracking wildfire severity...   │
│                                  │
│      78        ▲ 6    [Critical] │
│   ╱╲╱╲╱╲                         │
│                                  │
│ 🏷️ Ecology  📍 Western US  📄 12 │
└─────────────────────────────────┘
```

#### Color Coding

```tsx
// Score background color
const scoreColorClass = urgencyColor(topic.urgency); // Red/orange/yellow/green

// Change indicator color
const changeColorClass = changeColor(topic.change); // Red (negative) / green (positive)
```

---

### BiggestMovers

**Location:** `src/components/BiggestMovers.tsx`

**Purpose:** Horizontal scrolling list of topics with largest score changes.

**Type:** Client Component

#### API

```typescript
function BiggestMovers(): JSX.Element
```

#### Features

- **Top 5 Movers:** Topics with largest absolute score changes
- **Horizontal Scroll:** Touch/mouse scrollable on mobile/desktop
- **Auto-refresh:** Fetches new data periodically
- **Reuses TopicCard:** Consistent design with main grid

#### Data Source

Fetches from `GET /api/movers`:
```typescript
interface Mover {
  id: number;
  slug: string;
  title: string;
  currentScore: number;
  previousScore: number;
  change: number;
  urgency: string;
  category: string;
  region: string;
  articleCount: number;
  sparkline: number[];
}
```

#### Usage

```tsx
import BiggestMovers from '@/components/BiggestMovers';

// In dashboard (above main grid)
<section>
  <h2>Biggest Movers</h2>
  <BiggestMovers />
</section>
```

#### Responsive Layout

```tsx
// Desktop: horizontal scroll, mobile: stack vertically
<div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory">
  {movers.map((mover) => (
    <div key={mover.slug} className="snap-start min-w-[300px] md:min-w-[350px]">
      <TopicCard topic={mover} />
    </div>
  ))}
</div>
```

---

### ArticleList

**Location:** `src/components/ArticleList.tsx`

**Purpose:** Display list of articles related to a topic.

**Type:** Server Component

#### API

```typescript
interface ArticleListProps {
  articles: {
    id: number;
    title: string;
    url: string;
    source: string;
    summary: string | null;
    imageUrl: string | null;
    publishedAt: string | null;
  }[];
}

function ArticleList({ articles }: ArticleListProps): JSX.Element
```

#### Features

- **External Links:** Opens articles in new tab with `target="_blank" rel="noopener noreferrer"`
- **Source Display:** Shows article source and publication date
- **Summary:** Displays article summary if available
- **Empty State:** Message when no articles available

#### Usage

```tsx
import ArticleList from '@/components/ArticleList';

<section>
  <h2>Related Articles</h2>
  <ArticleList articles={[
    {
      id: 101,
      title: 'California Wildfires Intensify',
      url: 'https://example.com/article',
      source: 'Environmental News',
      summary: 'Recent wildfires have expanded...',
      imageUrl: null,
      publishedAt: '2026-02-08T14:00:00Z'
    }
  ]} />
</section>
```

#### Visual Structure

```
┌───────────────────────────────────────┐
│ 📰 California Wildfires Intensify     │
│    Environmental News • Feb 8, 2026   │
│    Recent wildfires have expanded...  │
└───────────────────────────────────────┘
```

#### Date Formatting

```tsx
// Formats ISO date to readable format
const formattedDate = new Date(publishedAt).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
});
// Output: "Feb 8, 2026"
```

---

## Visualization Components

### UrgencyBadge

**Location:** `src/components/UrgencyBadge.tsx`

**Purpose:** Color-coded badge displaying urgency level.

**Type:** Server Component

#### API

```typescript
interface UrgencyBadgeProps {
  urgency: 'breaking' | 'critical' | 'moderate' | 'informational';
}

function UrgencyBadge({ urgency }: UrgencyBadgeProps): JSX.Element
```

#### Features

- **Color Coding:** Red/orange/yellow/green based on urgency
- **Capitalized Text:** Auto-capitalizes urgency string
- **Compact Design:** Small pill-shaped badge

#### Usage

```tsx
import UrgencyBadge from '@/components/UrgencyBadge';

<UrgencyBadge urgency="critical" />
// Renders: [Critical] in orange
```

#### Color Mapping

| Urgency | Color | Tailwind Classes |
|---------|-------|------------------|
| breaking | Red | `bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200` |
| critical | Orange | `bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200` |
| moderate | Yellow | `bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200` |
| informational | Green | `bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200` |

---

### Sparkline

**Location:** `src/components/Sparkline.tsx`

**Purpose:** Mini line chart showing 7-day score trend.

**Type:** Server Component

#### API

```typescript
interface SparklineProps {
  data: number[];
  color?: string;
}

function Sparkline({ data, color = '#3b82f6' }: SparklineProps): JSX.Element
```

#### Features

- **Minimal Design:** No axes, labels, or grid
- **Trend Indicator:** Visual trend over time
- **Color Customization:** Optional color prop
- **Responsive:** Scales to container size

#### Usage

```tsx
import Sparkline from '@/components/Sparkline';

// Basic usage
<Sparkline data={[65, 68, 72, 75, 78]} />

// Custom color (urgency-based)
<Sparkline
  data={topic.sparkline}
  color={topic.urgency === 'breaking' ? '#ef4444' : '#3b82f6'}
/>
```

#### Technical Details

- **Library:** Recharts `<LineChart>` component
- **Size:** 64px width × 32px height (Tailwind: `w-16 h-8`)
- **Minimum Data:** Requires at least 2 data points
- **Empty State:** Shows "No data" if insufficient points

#### Implementation

```tsx
import { LineChart, Line } from 'recharts';

<LineChart width={64} height={32} data={chartData}>
  <Line
    type="monotone"
    dataKey="value"
    stroke={color}
    strokeWidth={2}
    dot={false}
  />
</LineChart>
```

---

### ScoreChart

**Location:** `src/components/ScoreChart.tsx`

**Purpose:** Full-size chart displaying topic score history with sub-scores (health, ecology, economy).

**Type:** Client Component

#### API

```typescript
interface ScoreChartProps {
  data: {
    score: number;
    healthScore: number;
    ecologyScore: number;
    economyScore: number;
    recordedAt: string;
  }[];
}

function ScoreChart({ data }: ScoreChartProps): JSX.Element
```

#### Features

- **Multi-line Chart:** 4 lines (overall, health, ecology, economy)
- **Theme-aware Colors:** Uses `useTheme()` for dark mode adaptation
- **Responsive:** Adjusts to container width
- **Interactive:** Hover tooltips with values
- **Date Axis:** X-axis shows formatted dates

#### Usage

```tsx
import ScoreChart from '@/components/ScoreChart';

<ScoreChart data={[
  {
    score: 78,
    healthScore: 65,
    ecologyScore: 85,
    economyScore: 72,
    recordedAt: '2026-02-09T00:00:00Z'
  },
  // More entries...
]} />
```

#### Line Colors

```tsx
// Light mode colors
const lightColors = {
  overall: '#3b82f6',   // Blue
  health: '#ef4444',    // Red
  ecology: '#10b981',   // Green
  economy: '#f59e0b',   // Amber
};

// Dark mode colors (more vibrant)
const darkColors = {
  overall: '#60a5fa',
  health: '#f87171',
  ecology: '#34d399',
  economy: '#fbbf24',
};
```

#### Legend

```tsx
<div className="flex justify-center gap-4 mt-4 text-sm">
  <div className="flex items-center gap-2">
    <div className="w-3 h-3 rounded-full bg-blue-600" />
    <span>Overall</span>
  </div>
  <div className="flex items-center gap-2">
    <div className="w-3 h-3 rounded-full bg-red-600" />
    <span>Health</span>
  </div>
  {/* Ecology, Economy... */}
</div>
```

#### Empty State

```tsx
if (data.length === 0) {
  return (
    <div className="h-64 flex items-center justify-center text-stone-500">
      No historical data available
    </div>
  );
}
```

---

## Component Patterns

### Server vs Client Components

**Server Components (default):**
- TopicCard
- ArticleList
- UrgencyBadge
- Sparkline

**Client Components (`'use client'`):**
- ThemeProvider (localStorage, context)
- ThemeToggle (interactive button)
- TickerBar (auto-refresh, fetch)
- TopicGrid (filters, fetch)
- BiggestMovers (fetch)
- ScoreChart (Recharts needs client-side rendering)

### Data Fetching Pattern

```tsx
'use client';

function DataComponent() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/endpoint');
        const json = await res.json();
        setData(json.data);
      } catch (error) {
        console.error('Fetch error:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <LoadingSkeleton />;

  return <DataDisplay data={data} />;
}
```

### Loading States

```tsx
// Skeleton UI for topic cards
<div className="animate-pulse">
  <div className="h-32 bg-stone-200 dark:bg-gray-700 rounded-lg" />
</div>

// Spinner for inline loading
<div className="flex justify-center">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
</div>
```

### Color Utilities

```typescript
// src/lib/utils.ts

function urgencyColor(urgency: string): string {
  switch (urgency) {
    case 'breaking': return 'bg-red-100 text-red-800 dark:bg-red-900';
    case 'critical': return 'bg-orange-100 text-orange-800 dark:bg-orange-900';
    case 'moderate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900';
    default: return 'bg-green-100 text-green-800 dark:bg-green-900';
  }
}

function changeColor(change: number): string {
  if (change > 0) return 'text-red-600 dark:text-red-400'; // Worsening
  if (change < 0) return 'text-green-600 dark:text-green-400'; // Improving
  return 'text-stone-500 dark:text-stone-400'; // No change
}

function formatChange(change: number): string {
  const arrow = change > 0 ? '▲' : change < 0 ? '▼' : '—';
  return `${arrow} ${Math.abs(change)}`;
}
```

### Accessibility Best Practices

```tsx
// Semantic HTML
<nav aria-label="Topic filters">
  <button aria-current={isActive ? 'true' : 'false'}>
    Filter Name
  </button>
</nav>

// Screen reader labels
<button aria-label="Toggle dark mode">
  <SunIcon aria-hidden="true" />
</button>

// Link relationships
<a href={url} target="_blank" rel="noopener noreferrer">
  External Article
</a>

// Loading announcements
<div role="status" aria-live="polite">
  {loading ? 'Loading...' : 'Data loaded'}
</div>
```

### Responsive Design

```tsx
// Mobile-first approach with Tailwind breakpoints
<div className="
  grid
  grid-cols-1           // Mobile: 1 column
  md:grid-cols-2        // Tablet: 2 columns
  lg:grid-cols-3        // Desktop: 3 columns
  gap-4                 // Consistent spacing
">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>

// Horizontal scroll on mobile
<div className="
  flex
  overflow-x-auto      // Enable horizontal scroll
  snap-x               // Snap scrolling
  gap-4
  pb-4                 // Bottom padding for scrollbar
  md:grid              // Grid layout on desktop
  md:grid-cols-3
">
  {items.map(item => (
    <div className="snap-start min-w-[300px] md:min-w-0">
      <Card {...item} />
    </div>
  ))}
</div>
```

---

## Testing Components

### Component Test Pattern

```tsx
import { render, screen } from '@testing-library/react';
import TopicCard from '@/components/TopicCard';

describe('TopicCard', () => {
  const mockTopic = {
    slug: 'test-topic',
    title: 'Test Topic',
    description: 'Test description',
    currentScore: 75,
    previousScore: 70,
    change: 5,
    urgency: 'critical',
    category: 'ecology',
    region: 'Global',
    articleCount: 10,
    sparkline: [65, 70, 72, 73, 75]
  };

  it('renders topic title and description', () => {
    render(<TopicCard topic={mockTopic} />);

    expect(screen.getByText('Test Topic')).toBeInTheDocument();
    expect(screen.getByText(/Test description/)).toBeInTheDocument();
  });

  it('displays correct score with color coding', () => {
    render(<TopicCard topic={mockTopic} />);

    const scoreElement = screen.getByText('75');
    expect(scoreElement).toHaveClass('text-orange-800'); // Critical urgency
  });

  it('shows change indicator with arrow', () => {
    render(<TopicCard topic={mockTopic} />);

    expect(screen.getByText(/▲ 5/)).toBeInTheDocument();
  });
});
```

### Mocking Recharts

```tsx
// tests/setup.ts
jest.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));
```

### Testing Client Components with Fetch

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import TopicGrid from '@/components/TopicGrid';

describe('TopicGrid', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          topics: [
            { id: 1, title: 'Topic 1', slug: 'topic-1', /* ... */ }
          ]
        })
      })
    ) as jest.Mock;
  });

  it('fetches and displays topics', async () => {
    render(<TopicGrid />);

    // Check loading state
    expect(screen.getByText(/Loading/)).toBeInTheDocument();

    // Wait for data
    await waitFor(() => {
      expect(screen.getByText('Topic 1')).toBeInTheDocument();
    });
  });
});
```

---

**Last Updated:** 2026-02-09
