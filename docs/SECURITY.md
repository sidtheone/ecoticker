# Security Documentation: EcoTicker

Comprehensive security documentation covering threat model, mitigations, and best practices.

---

## Table of Contents

- [Security Overview](#security-overview)
- [Authentication & Authorization](#authentication--authorization)
- [Input Validation](#input-validation)
- [SQL Injection Prevention](#sql-injection-prevention)
- [Rate Limiting](#rate-limiting)
- [Audit Logging](#audit-logging)
- [Content Security Policy](#content-security-policy)
- [Error Handling](#error-handling)
- [Environment Security](#environment-security)
- [Deployment Security](#deployment-security)
- [Security Checklist](#security-checklist)

---

## Security Overview

### Threat Model

**Assets to Protect:**
1. Database integrity (topics, articles, scores)
2. Admin API key (write access control)
3. External API keys (NewsAPI, OpenRouter)
4. User privacy (audit logs, IP addresses)
5. System availability (prevent DoS)

**Threat Actors:**
- **Script kiddies:** Automated scanning, common exploits
- **Malicious users:** Rate limit abuse, SQL injection attempts
- **Competitors:** Data scraping, API abuse
- **Insider threats:** N/A (personal project)

**Attack Vectors:**
- SQL injection
- XSS (cross-site scripting)
- CSRF (cross-site request forgery)
- Rate limit bypass
- API key exposure
- DoS/DDoS attacks

---

## Authentication & Authorization

### API Key Authentication

**Mechanism:** Bearer token in `X-API-Key` header for all write operations.

**Implementation:**
```typescript
// src/lib/auth.ts
export function requireAdminKey(req: NextRequest): NextResponse | null {
  const apiKey = req.headers.get('X-API-Key');
  const validKey = process.env.ADMIN_API_KEY;

  if (!apiKey || apiKey !== validKey) {
    return NextResponse.json({
      error: 'Unauthorized: Valid API key required',
      status: 401
    }, { status: 401 });
  }

  return null; // Authentication successful
}
```

**Usage in API routes:**
```typescript
export async function POST(req: NextRequest) {
  // First line: check authentication
  const authCheck = requireAdminKey(req);
  if (authCheck) return authCheck; // 401 if failed

  // Proceed with authorized operation
  // ...
}
```

### Key Generation

**Generate strong API key:**
```bash
openssl rand -base64 32
# Example: 8X9kJ2mN4pQ6rS8tU0vW2yA4bC6dE8fG0hI2jK4lM6n=
```

**Store in environment:**
```bash
# .env (local)
ADMIN_API_KEY=8X9kJ2mN4pQ6rS8tU0vW2yA4bC6dE8fG0hI2jK4lM6n=

# Railway (production)
# Add via dashboard: Settings → Environment Variables
```

### Key Rotation

**Best Practice:** Rotate API key every 90 days.

**Process:**
1. Generate new key: `openssl rand -base64 32`
2. Update in Railway dashboard (or .env for local)
3. Redeploy application
4. Update any scripts/clients using the key
5. Revoke old key after transition period

### Authorization Levels

| Operation | Authentication | Authorization |
|-----------|---------------|---------------|
| **GET /api/topics** | None | Public |
| **GET /api/articles** | None | Public |
| **POST /api/articles** | X-API-Key | Admin only |
| **DELETE /api/topics** | X-API-Key | Admin only |
| **POST /api/batch** | X-API-Key | Admin only |
| **POST /api/seed** | X-API-Key | Admin only |
| **GET /api/audit-logs** | X-API-Key | Admin only |

**Future Enhancement:** Role-based access control (RBAC) with multiple API keys per role.

---

## Input Validation

### Zod Schema Validation

**All write endpoints validate input:**

```typescript
// src/lib/validation.ts
import { z } from 'zod';

export const articleCreateSchema = z.object({
  topicId: z.number().int().positive(),
  title: z.string().min(1).max(500),
  url: z.string().url(),
  source: z.string().min(1).max(200),
  summary: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional(),
  publishedAt: z.string().datetime().optional(),
});

export const articleUpdateSchema = articleCreateSchema.partial();

export const articleDeleteSchema = z.object({
  topicId: z.number().int().positive().optional(),
  source: z.string().min(1).max(200).optional(),
  url: z.string().url().optional(),
  ids: z.array(z.number().int().positive()).optional(),
}).refine(
  (data) => data.topicId || data.source || data.url || data.ids,
  { message: 'At least one filter required' }
);
```

### Validation in API Routes

```typescript
export async function POST(req: NextRequest) {
  const authCheck = requireAdminKey(req);
  if (authCheck) return authCheck;

  try {
    const body = await req.json();

    // Validate with Zod
    const validation = articleCreateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({
        error: 'Validation failed',
        details: validation.error.errors,
        status: 400
      }, { status: 400 });
    }

    const article = validation.data; // Type-safe validated data

    // Proceed with database operation
    // ...

  } catch (error) {
    return createErrorResponse(error, 500, req);
  }
}
```

### Query Parameter Validation

**Whitelist allowed values:**
```typescript
const ALLOWED_URGENCY = ['breaking', 'critical', 'moderate', 'informational'];
const ALLOWED_CATEGORY = ['health', 'ecology', 'economy'];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const urgency = searchParams.get('urgency');
  const category = searchParams.get('category');

  if (urgency && !ALLOWED_URGENCY.includes(urgency)) {
    return NextResponse.json({
      error: `Invalid urgency. Must be one of: ${ALLOWED_URGENCY.join(', ')}`,
      status: 400
    }, { status: 400 });
  }

  if (category && !ALLOWED_CATEGORY.includes(category)) {
    return NextResponse.json({
      error: `Invalid category. Must be one of: ${ALLOWED_CATEGORY.join(', ')}`,
      status: 400
    }, { status: 400 });
  }

  // Proceed with validated params
}
```

### Input Sanitization

**Automatic sanitization:**
- **React:** Auto-escapes JSX content (XSS prevention)
- **PostgreSQL:** Parameterized queries prevent SQL injection
- **Zod:** Type coercion and validation

**Manual sanitization (if needed):**
```typescript
function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

---

## SQL Injection Prevention

### Parameterized Queries

**✅ ALWAYS DO THIS:**
```typescript
const query = 'SELECT * FROM topics WHERE slug = $1 AND urgency = $2';
const result = await db.query(query, [slug, urgency]);
```

**❌ NEVER DO THIS:**
```typescript
// SQL INJECTION VULNERABILITY!
const query = `SELECT * FROM topics WHERE slug = '${slug}'`;
const result = await db.query(query);
```

### Dynamic WHERE Clauses

**Safe pattern for multiple filters:**
```typescript
const conditions: string[] = [];
const params: any[] = [];
let paramCount = 1;

if (topicId) {
  conditions.push(`topic_id = $${paramCount++}`);
  params.push(topicId);
}

if (source) {
  conditions.push(`source = $${paramCount++}`);
  params.push(source);
}

if (url) {
  conditions.push(`url = $${paramCount++}`);
  params.push(url);
}

if (conditions.length === 0) {
  throw new Error('At least one filter required');
}

const query = `DELETE FROM articles WHERE ${conditions.join(' AND ')}`;
const result = await db.query(query, params);
```

### LIKE Pattern Safety

**Escape wildcards in user input:**
```typescript
function escapeLike(str: string): string {
  return str.replace(/[%_]/g, '\\$&');
}

const safePattern = `%${escapeLike(userInput)}%`;
const query = 'SELECT * FROM articles WHERE title LIKE $1';
const result = await db.query(query, [safePattern]);
```

**Or use exact match:**
```typescript
// Prefer exact match over LIKE when possible
const query = 'SELECT * FROM articles WHERE source = $1'; // Safe
// vs
const query = "SELECT * FROM articles WHERE source LIKE '%example%'"; // Risky
```

### Array Parameters

**Safe handling of arrays:**
```typescript
const ids = [1, 2, 3];

// ✅ Use ANY() for arrays
const query = 'DELETE FROM articles WHERE id = ANY($1)';
const result = await db.query(query, [ids]);

// ❌ Don't build IN clause manually
const query = `DELETE FROM articles WHERE id IN (${ids.join(',')})`;
```

### Historical Vulnerabilities Fixed

**Issue #1: /api/cleanup (CRITICAL)**

**Before (vulnerable):**
```typescript
const query = `DELETE FROM articles WHERE source LIKE '%seed%'`;
await db.query(query);
```

**After (fixed):**
```typescript
const query = 'DELETE FROM articles WHERE source = $1';
await db.query(query, ['seed']);
```

**Issue #2: /api/articles DELETE (HIGH)**

**Before (vulnerable):**
```typescript
const query = `DELETE FROM articles WHERE source = '${source}'`;
```

**After (fixed):**
```typescript
const conditions: string[] = [];
const params: any[] = [];
if (source) {
  conditions.push(`source = $${params.length + 1}`);
  params.push(source);
}
const query = `DELETE FROM articles WHERE ${conditions.join(' AND ')}`;
await db.query(query, params);
```

---

## Rate Limiting

### In-Memory Rate Limiter

**Implementation:**
```typescript
// src/lib/rate-limit.ts
interface RateLimit {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private limits: Record<string, RateLimit>;
  private requests: Map<string, { count: number; resetAt: number }>;

  constructor(limits: Record<string, RateLimit>) {
    this.limits = limits;
    this.requests = new Map();
  }

  checkLimit(ip: string, type: keyof typeof this.limits): boolean {
    const key = `${ip}:${type}`;
    const now = Date.now();
    const limit = this.limits[type];

    const existing = this.requests.get(key);

    if (!existing || now > existing.resetAt) {
      // New window
      this.requests.set(key, {
        count: 1,
        resetAt: now + limit.windowMs
      });
      return true;
    }

    if (existing.count >= limit.maxRequests) {
      return false; // Rate limit exceeded
    }

    existing.count++;
    return true;
  }
}
```

### Rate Limit Configuration

```typescript
const limiter = new RateLimiter({
  read: { maxRequests: 100, windowMs: 60000 },      // 100/min
  write: { maxRequests: 10, windowMs: 60000 },      // 10/min
  batch: { maxRequests: 2, windowMs: 3600000 },     // 2/hour
});
```

### Usage in API Routes

```typescript
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

  if (!limiter.checkLimit(ip, 'read')) {
    return NextResponse.json({
      error: 'Too many requests. Please try again later.',
      retryAfter: 60
    }, {
      status: 429,
      headers: {
        'Retry-After': '60',
        'X-RateLimit-Reset': String(Date.now() + 60000)
      }
    });
  }

  // Proceed with request
}
```

### Limitations

**In-Memory Limitations:**
- Not shared across multiple instances
- Resets on server restart
- No persistence across deployments

**Production Upgrade (Redis):**
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function checkRateLimit(ip: string, type: string): Promise<boolean> {
  const key = `ratelimit:${type}:${ip}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 60); // 1 minute window
  }

  return count <= limits[type].maxRequests;
}
```

---

## Audit Logging

### Comprehensive Logging

**All write operations are logged:**
```typescript
// src/lib/audit-log.ts
import { getDb } from './db';

interface AuditLogParams {
  ipAddress: string;
  endpoint: string;
  method: string;
  action: string;
  details?: string;
  userAgent?: string;
}

export async function logSuccess(params: AuditLogParams) {
  const db = getDb();

  await db.query(`
    INSERT INTO audit_logs (ip_address, endpoint, method, action, success, details, user_agent)
    VALUES ($1, $2, $3, $4, true, $5, $6)
  `, [
    params.ipAddress,
    params.endpoint,
    params.method,
    params.action,
    params.details || null,
    params.userAgent || null
  ]);
}

export async function logFailure(
  params: AuditLogParams & { errorMessage: string }
) {
  const db = getDb();

  await db.query(`
    INSERT INTO audit_logs (ip_address, endpoint, method, action, success, error_message, details, user_agent)
    VALUES ($1, $2, $3, $4, false, $5, $6, $7)
  `, [
    params.ipAddress,
    params.endpoint,
    params.method,
    params.action,
    params.errorMessage,
    params.details || null,
    params.userAgent || null
  ]);
}
```

### Usage Pattern

```typescript
export async function POST(req: NextRequest) {
  const authCheck = requireAdminKey(req);
  if (authCheck) return authCheck;

  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  try {
    const body = await req.json();
    // ... operation logic

    // Log success
    await logSuccess({
      ipAddress,
      endpoint: '/api/articles',
      method: 'POST',
      action: 'create_article',
      details: JSON.stringify({ articleId: result.id }),
      userAgent
    });

    return NextResponse.json({ article: result });

  } catch (error) {
    // Log failure
    await logFailure({
      ipAddress,
      endpoint: '/api/articles',
      method: 'POST',
      action: 'create_article',
      errorMessage: error.message,
      details: JSON.stringify({ input: body }),
      userAgent
    });

    return createErrorResponse(error, 500, req);
  }
}
```

### Querying Audit Logs

**Recent failures:**
```sql
SELECT * FROM audit_logs
WHERE success = false
ORDER BY timestamp DESC
LIMIT 20;
```

**Top actions:**
```sql
SELECT action, COUNT(*) as count
FROM audit_logs
GROUP BY action
ORDER BY count DESC;
```

**IP-based analysis:**
```sql
SELECT ip_address, COUNT(*) as requests
FROM audit_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY ip_address
ORDER BY requests DESC;
```

**Success rate:**
```sql
SELECT
  COUNT(*) FILTER (WHERE success = true) as successful,
  COUNT(*) FILTER (WHERE success = false) as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success = true) / COUNT(*), 2) as success_rate
FROM audit_logs;
```

---

## Content Security Policy

### CSP Headers

**Set in middleware or nginx:**
```typescript
// middleware.ts (Next.js)
export function middleware(req: NextRequest) {
  const response = NextResponse.next();

  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // Next.js hydration requires unsafe-inline
      "style-src 'self' 'unsafe-inline'",  // Tailwind requires unsafe-inline
      "img-src 'self' data: https:",       // External images allowed
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );

  return response;
}
```

**Nginx configuration:**
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

### CSP Violation Reporting

**Future enhancement:**
```typescript
// Add report-uri directive
"Content-Security-Policy": "... report-uri /api/csp-report"

// API route to collect violations
export async function POST(req: NextRequest) {
  const body = await req.json();
  console.warn('CSP Violation:', body);

  // Store in database or send to monitoring service
  return NextResponse.json({ received: true });
}
```

---

## Error Handling

### Environment-Aware Error Messages

```typescript
// src/lib/errors.ts
export function createErrorResponse(
  error: any,
  statusCode: number,
  req?: NextRequest
) {
  const isDev = process.env.NODE_ENV === 'development';
  const requestId = crypto.randomUUID();

  // Log error server-side (always)
  console.error(`[${requestId}] Error:`, error);

  // Return sanitized error to client
  return NextResponse.json({
    error: isDev ? error.message : 'Internal server error',
    status: statusCode,
    requestId,
    ...(isDev && {
      details: error.stack,
      query: error.query // PostgreSQL query (dev only)
    })
  }, { status: statusCode });
}
```

**Production response:**
```json
{
  "error": "Internal server error",
  "status": 500,
  "requestId": "abc-123-def-456"
}
```

**Development response:**
```json
{
  "error": "invalid input syntax for type integer: \"abc\"",
  "status": 500,
  "requestId": "abc-123-def-456",
  "details": "Error: invalid input syntax...\n at ...",
  "query": "SELECT * FROM topics WHERE id = $1"
}
```

### Error Logging

**Centralized logging:**
```typescript
// Log all errors with context
console.error('[ERROR]', {
  requestId,
  endpoint: req.url,
  method: req.method,
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString()
});
```

**Future: Send to monitoring service (Sentry, DataDog):**
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.captureException(error, {
  extra: {
    requestId,
    endpoint: req.url,
    method: req.method
  }
});
```

---

## Environment Security

### Secret Management

**Never commit secrets:**
```bash
# .gitignore
.env
.env.local
.env.production
```

**.env.example (template only):**
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/ecoticker
NEWSAPI_KEY=your_newsapi_key_here
OPENROUTER_API_KEY=your_openrouter_key_here
ADMIN_API_KEY=generate_with_openssl_rand_base64_32
```

### Railway Environment Variables

**Store all secrets in Railway dashboard:**
1. Project Settings → Variables
2. Add variables (not in .env files)
3. Redeploy after adding/changing

**Best Practices:**
- Use Railway's secret storage (encrypted at rest)
- Never log environment variables
- Rotate keys regularly

### GitHub Actions Secrets

**For CI/CD:**
1. Repository Settings → Secrets and variables → Actions
2. Add secrets: `ADMIN_API_KEY`, `DATABASE_URL` (test database)
3. Reference in workflows: `${{ secrets.ADMIN_API_KEY }}`

---

## Deployment Security

### Docker Security

**Non-root user:**
```dockerfile
# Dockerfile
FROM node:20-alpine
USER node  # Don't run as root
```

**Minimal base image:**
```dockerfile
FROM node:20-alpine  # Alpine = smaller attack surface
```

**Multi-stage builds:**
```dockerfile
# Build stage (dependencies)
FROM node:20-alpine AS builder
# ...

# Production stage (runtime only)
FROM node:20-alpine
COPY --from=builder /app/.next/standalone ./
```

### Nginx Security

**Hide version:**
```nginx
server_tokens off;
```

**Rate limiting (nginx level):**
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

location /api/ {
  limit_req zone=api burst=20 nodelay;
  # ...
}
```

**HTTPS (production):**
```nginx
listen 443 ssl http2;
ssl_certificate /etc/ssl/certs/cert.pem;
ssl_certificate_key /etc/ssl/private/key.pem;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
```

---

## Security Checklist

### Development

- [ ] All API keys in .env (not hardcoded)
- [ ] .env files in .gitignore
- [ ] Parameterized SQL queries (no string interpolation)
- [ ] Input validation with Zod schemas
- [ ] Authentication on all write endpoints
- [ ] Rate limiting enabled
- [ ] Audit logging for write operations
- [ ] Error messages sanitized (production mode)

### Pre-Deployment

- [ ] Environment variables set in Railway/hosting platform
- [ ] API keys rotated from defaults
- [ ] Database connection uses SSL (production)
- [ ] CSP headers configured
- [ ] Security headers enabled (X-Frame-Options, etc.)
- [ ] HTTPS enabled (Railway handles this)
- [ ] Docker images scanned for vulnerabilities

### Post-Deployment

- [ ] Monitor audit logs for anomalies
- [ ] Review rate limit violations
- [ ] Check error logs for attack patterns
- [ ] Regular security updates (npm audit, Docker base images)
- [ ] Quarterly API key rotation

### Ongoing Maintenance

- [ ] Weekly: Review audit logs
- [ ] Monthly: npm audit fix
- [ ] Quarterly: Rotate API keys
- [ ] Annually: Security review and penetration testing

---

**Last Updated:** 2026-02-09
