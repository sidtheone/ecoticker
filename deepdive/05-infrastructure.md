# 5. Infrastructure

## Docker

### Multi-Stage Dockerfile (3 stages)

**Stage 1 — deps** (`node:20-alpine`):
- `npm ci --omit=dev` — production node_modules only

**Stage 2 — builder** (`node:20-alpine`):
- `npm ci` (full deps) + `npm run build`
- Next.js build with `output: "standalone"`

**Stage 3 — runner** (`node:20-alpine`):
- Installs `su-exec` for user switching
- Creates `nodejs` group (gid 1001) + `nextjs` user (uid 1001)
- Copies: `public/`, `.next/standalone/`, `.next/static/`
- Runtime deps: `scripts/`, node_modules for slugify/pg/drizzle-orm/tsx/esbuild, `src/db/`
- `ENV HOSTNAME=0.0.0.0 PORT=3000`
- Healthcheck: `GET /api/ticker` every 30s, 5s timeout, 10s start, 3 retries
- Default user: `nextjs`
- CMD: `node server.js`

**Entrypoint** (`docker-entrypoint.sh`):
- If root: chown `/data` → `su-exec nextjs "$@"`
- Otherwise: mkdir `/data`, exec directly

---

### docker-compose.yml (4 services)

| Service | Image | Port | Notes |
|---|---|---|---|
| `postgres` | `postgres:17-alpine` | 5433:5432 | Named volume `pgdata`, healthcheck `pg_isready`, 512MB |
| `app` | Custom build | 3000 (internal) | `.env` file, `DATABASE_URL` overridden for internal postgres, 1GB |
| `nginx` | `nginx:alpine` | 80:80 | Mounts `nginx.conf` read-only, depends on `app` |
| `cron` | Same as app | — | Overrides entrypoint: `crond -f -l 2`, mounts `crontab`, runs as root, 512MB |

**Volume:** `pgdata` for PostgreSQL data persistence.

---

### nginx.conf

**Compression:**
- gzip enabled for text/plain, text/css, application/json, application/javascript, text/xml
- Min 1000 bytes

**Security headers:**
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: geolocation=(), microphone=(), camera=()
- CSP: default-src 'self', img-src 'self' data: https:

**Static assets:** `/_next/static` → 1-year `expires`, `Cache-Control: public, immutable`

**Proxy:** `/` → `app:3000` with HTTP/1.1, WebSocket upgrade, forwarded headers

---

### crontab

```
0 6 * * * cd /app && node node_modules/tsx/dist/esm/cli.mjs scripts/batch.ts >> /proc/1/fd/1 2>&1
```

Daily at 6:00 AM UTC. Logs to Docker stdout (`/proc/1/fd/1`).

Note: Docker crontab is the self-hosted fallback. GitHub Actions cron is the production trigger.

---

## CI/CD (GitHub Actions)

### `security.yml` — Push/PR to main

**4 jobs:**

| Job | Checks |
|---|---|
| `audit` | `npm audit --omit=dev` — production dependency vulnerabilities |
| `lint-security` | Hardcoded secrets scan, `eval()` usage, `dangerouslySetInnerHTML`, SQL injection patterns, committed `.env` files |
| `docker-security` | `USER` directive present (non-root), no secrets in `ARG`/`ENV` |
| `tests` | `npx jest --ci` — full 685-test suite |

### `cron-batch.yml` — Schedule `0 6,18 * * *` (6AM + 6PM UTC)

**Environment:** `virtuous-transformation / production`

**Action:** `GET ${APP_URL}/api/cron/batch` with `Authorization: Bearer ${CRON_SECRET}`. Fails if HTTP status ≠ 200.

Uses secrets: `CRON_SECRET`, `APP_URL`.

---

## Environment Variables

| Variable | Where Used | Required? | Notes |
|---|---|---|---|
| `DATABASE_URL` | db/index.ts, scripts, drizzle.config.ts | Yes | PostgreSQL connection string |
| `GNEWS_API_KEY` | batch-pipeline.ts, batch route, cron route | Yes (real data) | GNews.io v4 API key |
| `OPENROUTER_API_KEY` | batch-pipeline.ts, batch route, cron route | Yes (real data) | OpenRouter API key |
| `OPENROUTER_MODEL` | batch-pipeline.ts | No | Default: `meta-llama/llama-3.1-8b-instruct:free`. Prod: `mistralai/mistral-small-3.2-24b-instruct` |
| `BATCH_KEYWORDS` | batch-pipeline.ts | No | Default: `"climate change,pollution,deforestation,wildfire,flood"` |
| `RSS_FEEDS` | batch-pipeline.ts | No | Comma-separated URLs. 10 default feeds. |
| `ADMIN_API_KEY` | auth.ts | Yes (writes) | For X-API-Key auth on write endpoints |
| `CRON_SECRET` | cron/batch route | Yes (cron) | Bearer token for GHA cron trigger |
| `NEXT_PUBLIC_BASE_URL` | layout.tsx, OG meta tags | No | Production: `https://ecoticker.sidsinsights.com` |
| `NODE_ENV` | errors.ts | No | Production hides error details |
| `PORT` | Dockerfile | No | Default: 3000 |
| `HOSTNAME` | Dockerfile | No | Default: 0.0.0.0 |

---

## Configuration Files

### `next.config.ts`
- `output: "standalone"` only

### `jest.config.ts`
- Two projects: `node` (.test.ts) + `react` (.test.tsx, jsdom)
- Both use `ts-jest`, `@/` path alias → `src/`

### `tsconfig.json`
- Target ES2017, module esnext, moduleResolution bundler
- Strict mode, noEmit, incremental
- `@/*` → `./src/*`

### `package.json`
- `postinstall` auto-installs git hooks
- `overrides.esbuild: ">=0.25.0"` (vulnerability fix)
- Key deps: drizzle-orm ^0.45.1, next 16.1.6, pg ^8.18.0, rss-parser ^3.13.0, recharts ^3.7.0, zod ^4.3.6
