# Development Guide: EcoTicker

Complete guide for developers working on the EcoTicker project.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Organization](#code-organization)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Security](#security)
- [Performance](#performance)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- **Node.js:** 20.x or later
- **npm:** 10.x or later
- **PostgreSQL:** 16.x or later
- **Docker:** (optional, for containerized development)

### Initial Setup

```bash
# 1. Clone repository
git clone https://github.com/sidtheone/ecoticker.git
cd ecoticker

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env

# 4. Configure database
# Edit .env with your PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/ecoticker

# 5. Set up API keys (optional for basic development)
NEWSAPI_KEY=your_newsapi_key
OPENROUTER_API_KEY=your_openrouter_key
ADMIN_API_KEY=$(openssl rand -base64 32)

# 6. Initialize database (automatic on first run)
npm run dev
# Schema auto-loads from db/schema.sql

# 7. Seed demo data (optional)
npx tsx scripts/seed.ts
```

### Git Hooks Setup

Git hooks are automatically installed via the `postinstall` script. If not installed:

```bash
npm run setup:hooks
```

**Hooks Installed:**
- **pre-commit:** TypeScript check → Build → Lint
- **pre-push:** Run full test suite

**Bypass (emergency only):**
```bash
git commit --no-verify
```

---

## Development Workflow

### Daily Development

```bash
# Start development server with hot reload
npm run dev
# Open http://localhost:3000

# In separate terminal: run tests in watch mode
npx jest --watch

# Type check
npx tsc --noEmit

# Lint code
npm run lint
```

### Feature Development Process

1. **Read PROJECT_INDEX.md** to understand codebase structure (saves 53,500 tokens)
2. **Create feature branch** from `main`
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. **Write tests first** (TDD approach)
4. **Implement feature**
5. **Run full test suite**
   ```bash
   npx jest
   ```
6. **Build and verify**
   ```bash
   npm run build
   npm run start
   ```
7. **Commit with hooks** (automatic checks)
8. **Push and create PR**

### Branch Naming

- **Features:** `feat/feature-name`
- **Bugfixes:** `fix/bug-description`
- **Refactoring:** `refactor/description`
- **Documentation:** `docs/description`

---

## Code Organization

### Directory Structure

```
ecoticker/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout (ThemeProvider, TickerBar)
│   │   ├── page.tsx            # Dashboard page
│   │   ├── globals.css         # Global styles (Tailwind)
│   │   ├── topic/[slug]/       # Dynamic topic detail pages
│   │   └── api/                # API routes
│   │       ├── topics/
│   │       ├── articles/
│   │       ├── ticker/
│   │       ├── movers/
│   │       ├── batch/
│   │       ├── seed/
│   │       ├── cleanup/
│   │       └── audit-logs/
│   ├── components/             # React components
│   │   ├── ThemeProvider.tsx   # Client: theme context
│   │   ├── ThemeToggle.tsx     # Client: theme button
│   │   ├── TickerBar.tsx       # Client: auto-refresh ticker
│   │   ├── TopicGrid.tsx       # Client: filterable grid
│   │   ├── TopicCard.tsx       # Server: topic summary
│   │   ├── BiggestMovers.tsx   # Client: movers list
│   │   ├── Sparkline.tsx       # Server: mini chart
│   │   ├── ScoreChart.tsx      # Client: full chart
│   │   ├── ArticleList.tsx     # Server: article list
│   │   └── UrgencyBadge.tsx    # Server: urgency label
│   └── lib/                    # Utilities and helpers
│       ├── db.ts               # PostgreSQL pool singleton
│       ├── types.ts            # TypeScript type definitions
│       ├── utils.ts            # Utility functions
│       ├── auth.ts             # API key authentication
│       ├── rate-limit.ts       # Rate limiting
│       ├── validation.ts       # Zod schemas
│       ├── errors.ts           # Error handling
│       └── audit-log.ts        # Audit logging
├── scripts/
│   ├── batch.ts                # Batch processing pipeline
│   ├── seed.ts                 # Demo data seeding
│   └── setup-git-hooks.sh      # Git hooks installer
├── db/
│   └── schema.sql              # PostgreSQL schema
├── tests/                      # Jest tests
│   ├── test-db.ts              # pg-mem test helper
│   ├── db.test.ts              # Database tests
│   ├── api-*.test.ts           # API route tests
│   └── *.test.tsx              # Component tests
├── docs/                       # Documentation
│   ├── API_REFERENCE.md        # API documentation
│   ├── COMPONENT_GUIDE.md      # Component documentation
│   ├── DATABASE_GUIDE.md       # Database documentation
│   └── DEVELOPMENT_GUIDE.md    # This file
├── Dockerfile                  # Docker build config
├── docker-compose.yml          # Multi-container setup
├── nginx.conf                  # Nginx reverse proxy
├── jest.config.ts              # Jest configuration
├── next.config.ts              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies and scripts
├── CLAUDE.md                   # AI assistant instructions
└── PROJECT_INDEX.md            # Project structure index
```

---

## Coding Standards

### TypeScript

**Type Everything:**
```typescript
// ✅ Explicit types
interface Topic {
  id: number;
  slug: string;
  title: string;
  currentScore: number;
}

function getTopic(slug: string): Promise<Topic | null> {
  // ...
}

// ❌ Avoid 'any'
function getData(): any { /* ... */ }
```

**Use Type Aliases:**
```typescript
// src/lib/types.ts
export type Urgency = 'breaking' | 'critical' | 'moderate' | 'informational';
export type Category = 'health' | 'ecology' | 'economy';

// Usage
function filterByUrgency(urgency: Urgency) {
  // TypeScript enforces valid values
}
```

---

### Naming Conventions

**Files:**
- Components: PascalCase (`TopicCard.tsx`)
- Utilities: camelCase (`db.ts`, `utils.ts`)
- Tests: `*.test.ts` or `*.test.tsx`

**Variables:**
```typescript
// camelCase for variables and functions
const topicSlug = 'wildfire-impact';
function fetchTopics() { }

// PascalCase for components and classes
function TopicCard() { }
class RateLimiter { }

// UPPER_SNAKE_CASE for constants
const MAX_RETRY_ATTEMPTS = 3;
const DATABASE_URL = process.env.DATABASE_URL;
```

**Database:**
- Tables: snake_case (`score_history`)
- Columns: snake_case (`current_score`)
- Convert to camelCase in TypeScript: `currentScore`

---

### React Patterns

**Server Components by Default:**
```tsx
// Server Component (default)
function TopicCard({ topic }: { topic: Topic }) {
  return <div>{topic.title}</div>;
}

// Client Component (when needed)
'use client';

import { useState } from 'react';

function TopicGrid() {
  const [filter, setFilter] = useState('all');
  // ...
}
```

**When to Use Client Components:**
- State management (`useState`, `useReducer`)
- Effects (`useEffect`)
- Event handlers (`onClick`, `onChange`)
- Browser APIs (`localStorage`, `fetch`)
- Context providers/consumers

**Component Props:**
```typescript
// Define prop types
interface TopicCardProps {
  topic: Topic;
  showDetails?: boolean;  // Optional
}

// Use in component
function TopicCard({ topic, showDetails = false }: TopicCardProps) {
  // ...
}
```

---

### API Route Structure

```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdminKey } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { logSuccess, logFailure } from '@/lib/audit-log';

// GET handler (public)
export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const result = await db.query('SELECT * FROM topics LIMIT 10');

    return NextResponse.json({
      topics: result.rows
    });

  } catch (error) {
    console.error('Error fetching topics:', error);
    return createErrorResponse(error, 500, req);
  }
}

// POST handler (protected)
export async function POST(req: NextRequest) {
  // 1. Authentication
  const authCheck = requireAdminKey(req);
  if (authCheck) return authCheck;

  try {
    // 2. Parse and validate input
    const body = await req.json();
    // Use Zod validation here

    // 3. Database operation
    const db = getDb();
    const result = await db.query(
      'INSERT INTO topics (slug, title) VALUES ($1, $2) RETURNING *',
      [body.slug, body.title]
    );

    // 4. Audit log
    await logSuccess({
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      endpoint: '/api/example',
      method: 'POST',
      action: 'create_topic',
      details: JSON.stringify({ topicId: result.rows[0].id })
    });

    // 5. Return response
    return NextResponse.json({
      topic: result.rows[0]
    }, { status: 201 });

  } catch (error) {
    // Audit failure
    await logFailure({
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      endpoint: '/api/example',
      method: 'POST',
      action: 'create_topic',
      errorMessage: error.message
    });

    return createErrorResponse(error, 500, req);
  }
}
```

---

### Database Patterns

**Always Use Parameterized Queries:**
```typescript
// ✅ Safe
const result = await db.query(
  'SELECT * FROM topics WHERE slug = $1',
  [slug]
);

// ❌ SQL injection vulnerability
const result = await db.query(
  `SELECT * FROM topics WHERE slug = '${slug}'`
);
```

**Handle Errors:**
```typescript
try {
  const result = await db.query(query, params);
  return result.rows;

} catch (error) {
  if (error.code === '23505') {
    // Unique constraint violation
    throw new Error('Resource already exists');
  }
  if (error.code === '23503') {
    // Foreign key violation
    throw new Error('Referenced resource not found');
  }
  throw error;
}
```

---

### Error Handling

**Use Centralized Error Response:**
```typescript
// src/lib/errors.ts
export function createErrorResponse(
  error: any,
  statusCode: number,
  req?: NextRequest
) {
  const isDev = process.env.NODE_ENV === 'development';

  return NextResponse.json({
    error: isDev ? error.message : 'Internal server error',
    status: statusCode,
    requestId: crypto.randomUUID(),
    ...(isDev && { details: error.stack })
  }, { status: statusCode });
}

// Usage in API routes
return createErrorResponse(error, 500, req);
```

---

## Testing

### Test Structure

```typescript
// tests/example.test.ts
import { createTestDb } from './test-db';

describe('Feature Name', () => {
  let db: any;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(async () => {
    await db.end();
  });

  describe('Specific Functionality', () => {
    it('should do something specific', async () => {
      // Arrange
      const input = { slug: 'test' };

      // Act
      const result = await someFunction(db, input);

      // Assert
      expect(result).toBeDefined();
      expect(result.slug).toBe('test');
    });
  });
});
```

### Component Testing

```tsx
// tests/TopicCard.test.tsx
import { render, screen } from '@testing-library/react';
import TopicCard from '@/components/TopicCard';

describe('TopicCard', () => {
  const mockTopic = {
    slug: 'test-topic',
    title: 'Test Topic',
    currentScore: 75,
    // ... other fields
  };

  it('renders topic information', () => {
    render(<TopicCard topic={mockTopic} />);

    expect(screen.getByText('Test Topic')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
  });
});
```

### API Testing

```typescript
// tests/api-topics.test.ts
describe('GET /api/topics', () => {
  it('returns list of topics', async () => {
    // Insert test data
    await db.query(
      'INSERT INTO topics (slug, title, current_score) VALUES ($1, $2, $3)',
      ['test', 'Test Topic', 75]
    );

    // Mock Next.js request
    const req = new NextRequest('http://localhost:3000/api/topics');

    // Call handler
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.topics).toHaveLength(1);
    expect(data.topics[0].slug).toBe('test');
  });
});
```

### Running Tests

```bash
# All tests
npx jest

# With coverage
npx jest --coverage

# Watch mode
npx jest --watch

# Specific file
npx jest tests/api-topics.test.ts

# Specific test
npx jest -t "returns list of topics"
```

### Test Coverage Goals

- **Statements:** 95%+
- **Branches:** 90%+
- **Functions:** 95%+
- **Lines:** 95%+

Current coverage: **98.6%** (maintain or improve)

---

## Security

### Authentication

**All write operations require API key:**
```typescript
import { requireAdminKey } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const authCheck = requireAdminKey(req);
  if (authCheck) return authCheck;  // 401 if invalid

  // Proceed with authorized operation
}
```

**Generate API key:**
```bash
openssl rand -base64 32
# Add to .env as ADMIN_API_KEY
```

---

### Input Validation

**Use Zod schemas for all inputs:**
```typescript
import { z } from 'zod';

const articleSchema = z.object({
  topicId: z.number().int().positive(),
  title: z.string().min(1).max(500),
  url: z.string().url(),
  source: z.string().min(1).max(200),
  summary: z.string().max(2000).optional(),
});

// In API route
const validation = articleSchema.safeParse(body);
if (!validation.success) {
  return NextResponse.json({
    error: 'Validation failed',
    details: validation.error.errors
  }, { status: 400 });
}

const article = validation.data;
```

---

### SQL Injection Prevention

**Always use parameterized queries:**
```typescript
// ✅ Safe
const query = 'SELECT * FROM topics WHERE category = $1';
const result = await db.query(query, [category]);

// ❌ Vulnerable
const query = `SELECT * FROM topics WHERE category = '${category}'`;
```

**Be careful with LIKE patterns:**
```typescript
// Escape user input for LIKE
function escapeLike(str: string): string {
  return str.replace(/[%_]/g, '\\$&');
}

const pattern = `%${escapeLike(userInput)}%`;
const query = 'SELECT * FROM articles WHERE title LIKE $1';
```

---

### Rate Limiting

**In-memory rate limiter (sufficient for demo/personal projects):**
```typescript
import { RateLimiter } from '@/lib/rate-limit';

const limiter = new RateLimiter({
  read: { maxRequests: 100, windowMs: 60000 },    // 100/min
  write: { maxRequests: 10, windowMs: 60000 },    // 10/min
  batch: { maxRequests: 2, windowMs: 3600000 },   // 2/hour
});

// In middleware
const ip = req.headers.get('x-forwarded-for') || 'unknown';
if (!limiter.checkLimit(ip, 'read')) {
  return NextResponse.json({
    error: 'Too many requests',
    retryAfter: 60
  }, { status: 429 });
}
```

---

### Content Security Policy

**Set in middleware:**
```typescript
// middleware.ts
export function middleware(req: NextRequest) {
  const response = NextResponse.next();

  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );

  return response;
}
```

---

## Performance

### Database Optimization

**Use indexes for common queries:**
```sql
CREATE INDEX idx_topics_urgency ON topics(urgency);
CREATE INDEX idx_articles_topic ON articles(topic_id);
```

**Limit result sets:**
```typescript
// Always use LIMIT/OFFSET for pagination
const query = `
  SELECT * FROM articles
  LIMIT $1 OFFSET $2
`;
const result = await db.query(query, [limit, offset]);
```

**Use JSON aggregation to avoid N+1:**
```typescript
// ✅ Single query with JSON aggregation
const query = `
  SELECT
    t.*,
    (SELECT json_agg(a.*) FROM articles a WHERE a.topic_id = t.id) as articles
  FROM topics t
`;

// ❌ N+1 query problem
const topics = await getTopics();
for (const topic of topics) {
  topic.articles = await getArticles(topic.id);
}
```

---

### Caching Strategy

**Next.js Route Cache:**
```typescript
// Force no cache for dynamic data
export const dynamic = 'force-dynamic';

// Or set revalidation period
export const revalidate = 300; // 5 minutes
```

**Client-side caching:**
```typescript
// TickerBar auto-refresh with stale-while-revalidate pattern
useEffect(() => {
  fetchData(); // Immediate fetch
  const interval = setInterval(fetchData, 5 * 60 * 1000); // 5 min
  return () => clearInterval(interval);
}, []);
```

---

### Bundle Size

**Analyze bundle:**
```bash
npm run build
# Check .next/static output
```

**Lazy load heavy components:**
```typescript
import dynamic from 'next/dynamic';

const ScoreChart = dynamic(() => import('@/components/ScoreChart'), {
  loading: () => <div>Loading chart...</div>,
  ssr: false
});
```

---

## Deployment

### Docker

**Build and run locally:**
```bash
docker compose build
docker compose up -d

# View logs
docker compose logs -f app

# Stop
docker compose down
```

**Environment variables for production:**
```bash
# docker-compose.yml
environment:
  - DATABASE_URL=postgresql://user:pass@postgres:5432/ecoticker
  - NEWSAPI_KEY=${NEWSAPI_KEY}
  - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
  - ADMIN_API_KEY=${ADMIN_API_KEY}
  - NODE_ENV=production
```

---

### Railway

**Deployment process:**
```bash
# 1. Push to GitHub
git push origin main

# 2. Railway auto-deploys on push
# Or manual deploy:
railway up

# 3. Set environment variables in Railway dashboard
DATABASE_URL=<provided by Railway Postgres>
NEWSAPI_KEY=<your key>
OPENROUTER_API_KEY=<your key>
ADMIN_API_KEY=<generated key>

# 4. Run seed (one-time)
railway run npm run railway:seed
```

**Health check endpoint:**
```typescript
// src/app/api/health/route.ts
export async function GET() {
  const db = getDb();
  const result = await db.query('SELECT NOW()');

  return NextResponse.json({
    status: 'healthy',
    database: 'connected',
    timestamp: result.rows[0].now
  });
}
```

---

## Troubleshooting

### Common Issues

**Database connection errors:**
```bash
# Check DATABASE_URL format
# PostgreSQL: postgresql://user:password@host:port/database
# With SSL: postgresql://user:password@host:port/database?sslmode=require

# Test connection
psql $DATABASE_URL
```

**Build errors:**
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

**Test failures:**
```bash
# Clear Jest cache
npx jest --clearCache

# Run specific test with debug
npx jest --verbose tests/failing-test.test.ts
```

**Port already in use:**
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev
```

---

### Debugging

**Server-side debugging:**
```typescript
console.log('Debug data:', { variable, otherVariable });
console.error('Error details:', error);

// Use environment check
if (process.env.NODE_ENV === 'development') {
  console.debug('Detailed debug info:', data);
}
```

**Client-side debugging:**
```typescript
// React DevTools
useEffect(() => {
  console.log('Component mounted with props:', props);
}, []);

// Network requests
fetch('/api/endpoint')
  .then(res => {
    console.log('Response status:', res.status);
    return res.json();
  })
  .then(data => console.log('Response data:', data));
```

**Database query debugging:**
```typescript
const query = 'SELECT * FROM topics WHERE urgency = $1';
const params = ['critical'];

console.log('Query:', query);
console.log('Params:', params);

const result = await db.query(query, params);
console.log('Result rows:', result.rows.length);
```

---

### Performance Profiling

**Next.js Build Analysis:**
```bash
# Enable bundle analysis
ANALYZE=true npm run build
```

**Database Query Performance:**
```sql
-- Enable timing
\timing on

-- Explain query
EXPLAIN ANALYZE
SELECT * FROM topics
WHERE urgency = 'critical'
ORDER BY current_score DESC;
```

---

## Additional Resources

- **Next.js Docs:** https://nextjs.org/docs
- **React Docs:** https://react.dev
- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/
- **Jest Docs:** https://jestjs.io/docs/getting-started
- **Tailwind CSS:** https://tailwindcss.com/docs

---

**Last Updated:** 2026-02-09
