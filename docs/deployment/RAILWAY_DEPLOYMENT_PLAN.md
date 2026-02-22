# Railway Deployment Plan — EcoTicker

**Status:** Implementation Plan
**Target Platform:** Railway.app
**Migration From:** Docker Compose (app + nginx + cron)

---

## Executive Summary

Railway is a modern PaaS that simplifies deployment with:
- **Auto-deploy from GitHub** with zero config
- **Managed PostgreSQL** database plugin
- **Built-in HTTPS** and edge network (no nginx needed)
- **Cron jobs** via Railway's native cron service
- **Environment variables** managed in dashboard
- **$5/month Hobby plan** includes everything needed

**Key Changes:**
1. Remove nginx (Railway handles HTTPS/routing)
2. Single Dockerfile deployment (Railway auto-detects)
3. Managed PostgreSQL database (Railway plugin)
4. Cron job via separate Railway service
5. Environment variables via Railway dashboard

---

## Architecture Comparison

### Current (Docker Compose)
```
┌─────────────────────────────────────┐
│  nginx:80 (reverse proxy + headers) │
│         ↓                            │
│  app:3000 (Next.js)                  │
│         ↓                            │
│  cron (batch script 6am UTC)         │
│         ↓                            │
│  PostgreSQL (Docker service)         │
└─────────────────────────────────────┘
```

### Railway (Simplified)
```
┌─────────────────────────────────────┐
│  Railway Edge (HTTPS + routing)      │
│         ↓                            │
│  web service (Next.js on port 3000)  │
│         ↓                            │
│  cron service (batch.ts daily)       │
│         ↓                            │
│  Railway PostgreSQL (managed)        │
└─────────────────────────────────────┘
```

**Benefits:**
- No nginx maintenance
- Automatic SSL certificates
- Built-in DDoS protection
- Health checks and auto-restart
- Zero-downtime deploys

---

## Implementation Steps

### Phase 1: Railway Project Setup (10 min)

**1.1 Create Railway Account**
```bash
# Visit https://railway.app and sign up with GitHub
# Install Railway CLI (optional)
npm i -g @railway/cli
railway login
```

**1.2 Create New Project**
- Click "New Project" in Railway dashboard
- Select "Deploy from GitHub repo"
- Authorize Railway to access `sidtheone/ecoticker` repo
- Railway will auto-detect Dockerfile

**1.3 Configure Environment Variables**

In Railway dashboard → Variables tab, add:
```env
GNEWS_API_KEY=<your_actual_gnews_key>
OPENROUTER_API_KEY=<your_actual_openrouter_key>
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
ADMIN_API_KEY=<generated_secret>
BATCH_KEYWORDS=climate,pollution,deforestation,wildfire,flood,drought,oil spill,emissions,biodiversity,ocean
NODE_ENV=production
```

**Note:** `DATABASE_URL` is automatically set by the Railway PostgreSQL plugin.

**1.4 Add PostgreSQL Plugin**
- Go to Railway project → New Service → Database → PostgreSQL
- Railway automatically provisions PostgreSQL 17 and injects `DATABASE_URL`

---

### Phase 2: Code Modifications (15 min)

**2.1 Update Dockerfile for Railway**

Railway expects Dockerfile to work standalone (no docker-compose). Current Dockerfile already works! No changes needed.

**Optional optimization:**
```dockerfile
# Add healthcheck for Railway monitoring
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "require('http').get('http://localhost:3000/api/ticker', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"
```

**2.2 Create Railway Configuration File**

Railway supports `railway.toml` for advanced configuration:

```toml
# railway.toml (optional - Railway auto-detects without this)
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "node server.js"
healthcheckPath = "/api/ticker"
healthcheckTimeout = 10
restartPolicyType = "on-failure"
restartPolicyMaxRetries = 3
```

**2.3 Update Next.js Config (Already Done)**

Your `next.config.ts` already has `output: "standalone"` ✅

**2.4 Remove nginx Dependency**

Railway provides HTTPS and routing automatically. We can remove nginx from the stack.

Security headers that were in `nginx.conf` can be moved to Next.js middleware.

**Create:** `src/middleware.ts`
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers (previously in nginx.conf)
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
  );

  return response;
}

export const config = {
  matcher: '/:path*',
};
```

---

### Phase 3: Cron Job Setup (10 min)

Railway supports cron jobs as separate services.

**3.1 Create Cron Service**

Option A: **Railway Cron (Recommended)**
- In Railway dashboard, add new service to project
- Select "Cron Job" service type
- Schedule: `0 6 * * *` (daily at 6am UTC)
- Command: `npx tsx scripts/batch.ts`
- Use same Dockerfile and environment variables
- Mount same `/data` volume

Option B: **External Cron Service**
- Use cron-job.org or EasyCron
- Call Railway endpoint to trigger batch script
- Less ideal (external dependency)

**3.2 Create Cron Endpoint (Alternative Approach)**

If Railway doesn't support cron services directly, create an API endpoint:

```typescript
// src/app/api/cron/batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized runs
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Starting batch job via cron endpoint...');
    const { stdout, stderr } = await execAsync('npx tsx scripts/batch.ts');

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stdout: stdout.substring(0, 1000), // Truncate for response
      stderr: stderr ? stderr.substring(0, 500) : null
    });
  } catch (error) {
    console.error('Batch job failed:', error);
    return NextResponse.json(
      { error: 'Batch job failed', details: String(error) },
      { status: 500 }
    );
  }
}
```

Then use cron-job.org to call:
```
https://ecoticker.up.railway.app/api/cron/batch
Authorization: Bearer <CRON_SECRET>
```

---

### Phase 4: Database Migration (5 min)

**4.1 Seed Initial Data**

Railway volume starts empty. You need to seed the database on first deploy.

**Option A: Automatic Seeding**

Add to `package.json`:
```json
{
  "scripts": {
    "railway:seed": "npx tsx scripts/seed.ts && echo 'Database seeded'"
  }
}
```

In Railway → Settings → Deploy → Build Command:
```bash
npm run build && npm run railway:seed
```

**Option B: Manual Seeding via Railway CLI**

After first deployment:
```bash
railway run npx tsx scripts/seed.ts
```

**4.2 Push Database Schema**

After first deployment, push Drizzle schema to Railway PostgreSQL:
```bash
railway run npx drizzle-kit push
```

---

### Phase 5: Deploy & Verify (10 min)

**5.1 Push to GitHub**

Railway auto-deploys on git push:
```bash
git add .
git commit -m "Configure for Railway deployment"
git push origin main
```

**5.2 Monitor Deploy**

Railway dashboard shows:
- Build logs (Dockerfile build)
- Deploy logs (container startup)
- Runtime logs (app output)

**5.3 Verify Deployment**

Railway provides auto-generated URL: `https://<project-name>.up.railway.app`

Test endpoints:
```bash
# Health check
curl https://ecoticker.up.railway.app/api/ticker

# Topic list
curl https://ecoticker.up.railway.app/api/topics

# Verify HTTPS and headers
curl -I https://ecoticker.up.railway.app
```

**5.4 Custom Domain (Optional)**

Railway supports custom domains:
- Settings → Domains → Add Custom Domain
- Point DNS: `CNAME ecoticker.up.railway.app`
- Auto SSL via Let's Encrypt

---

## Configuration Files to Create/Modify

### Files to CREATE:

1. **`src/middleware.ts`** — Security headers (replaces nginx)
2. **`railway.toml`** — Optional Railway config
3. **`src/app/api/cron/batch/route.ts`** — Optional cron endpoint

### Files to MODIFY:

1. **`.gitignore`** — Ensure `.env` is ignored (already done ✅)
2. **`package.json`** — Add `railway:seed` script
3. **`README.md`** — Update deployment instructions

### Files to REMOVE (after migration):

1. **`docker-compose.yml`** — Not needed on Railway
2. **`nginx.conf`** — Railway handles routing
3. **`crontab`** — Railway cron service handles this

---

## Cost Estimate

**Railway Pricing:**
- Hobby Plan: **$5/month**
  - 500 hours of usage/month
  - $0.000231/GB-hour for usage over 500 hours
  - Includes persistent storage (first 100GB free)

**EcoTicker Usage:**
- 1 web service: ~720 hours/month (always-on)
- 1 cron service: ~1 hour/month (runs once daily)
- Total: **~$5-7/month**

**Comparison to Alternatives:**
- DigitalOcean Droplet: $6/month (requires manual setup)
- AWS Lightsail: $5/month (complex setup)
- Vercel: Free tier (but no cron, requires external DB)
- Heroku: $7/month (deprecated free tier)

**Railway wins on:** Simplicity + Cron + Persistent storage

---

## Migration Checklist

### Pre-Migration
- [ ] Create Railway account
- [ ] Link GitHub repo
- [ ] Export current database (if migrating data)
- [ ] Document current environment variables

### Code Changes
- [ ] Create `src/middleware.ts` for security headers
- [ ] Create `railway.toml` configuration
- [ ] Add `railway:seed` script to `package.json`
- [ ] Create cron endpoint `/api/cron/batch/route.ts` (if using external cron)
- [ ] Test locally with `npm run build && npm start`

### Railway Setup
- [ ] Create new Railway project
- [ ] Connect GitHub repo
- [ ] Add environment variables
- [ ] Add PostgreSQL plugin
- [ ] Configure cron service or external cron
- [ ] Set up custom domain (optional)

### Deployment
- [ ] Push code to GitHub
- [ ] Monitor build logs
- [ ] Verify deployment at Railway URL
- [ ] Test all endpoints (topics, ticker, movers, detail)
- [ ] Run initial seed script (if needed)
- [ ] Trigger cron job manually to test
- [ ] Monitor logs for 24 hours

### Post-Migration
- [ ] Update DNS to custom domain (if using)
- [ ] Archive old Docker setup
- [ ] Update README with Railway instructions
- [ ] Document Railway dashboard access
- [ ] Set up monitoring/alerts (Railway Observability)

---

## Rollback Plan

If Railway deployment fails:

1. **Keep Docker setup intact** until Railway is verified
2. **Database backup:** Export PostgreSQL with `pg_dump` before migration
3. **Quick rollback:**
   ```bash
   docker compose up -d
   ```
4. **DNS rollback:** Point domain back to old server

---

## Next Steps

**Immediate Actions:**

1. **Review this plan** — Understand all changes
2. **Test locally** — Verify middleware approach works
3. **Create Railway account** — Get familiar with dashboard
4. **Implement code changes** — Create middleware, cron endpoint
5. **Deploy to Railway** — Follow Phase 1-5 above

**Would you like me to:**
- ✅ Implement the code changes (middleware, cron endpoint, etc.)?
- ✅ Create a Railway-specific Dockerfile optimization?
- ✅ Set up monitoring and logging configuration?
- ✅ Create a detailed Railway CLI deployment script?

---

## Additional Resources

- **Railway Docs:** https://docs.railway.app
- **Railway CLI:** https://docs.railway.app/develop/cli
- **Next.js on Railway:** https://docs.railway.app/guides/nextjs
- **Railway Volumes:** https://docs.railway.app/reference/volumes
- **Railway Cron:** https://docs.railway.app/reference/cron-jobs

---

**Estimated Total Time:** 1-2 hours
**Difficulty:** Easy (Railway handles most complexity)
**Risk Level:** Low (reversible, no destructive changes)
