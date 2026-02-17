# Railway Deployment Quickstart

**Time:** 15 minutes
**Cost:** $5-7/month

---

## Prerequisites

- [x] GitHub account with `sidtheone/ecoticker` repo
- [x] Railway account (sign up at https://railway.app)
- [x] NewsAPI key (https://newsapi.org)
- [x] OpenRouter API key (https://openrouter.ai)
- [x] PostgreSQL plugin (Railway provides this)

---

## Step 1: Create Railway Project (3 min)

1. **Sign up/login** to Railway with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select **`sidtheone/ecoticker`** repository
4. Railway auto-detects Dockerfile and starts deploying

---

## Step 2: Add PostgreSQL Plugin (2 min)

1. Go to project → **New Service** → **Database**
2. Select **"PostgreSQL"**
3. Railway automatically provisions PostgreSQL 17
4. Note: Railway automatically sets `DATABASE_URL` environment variable

This provides a managed PostgreSQL database for the application.

---

## Step 3: Configure Environment Variables (5 min)

Go to project → **Variables** tab, add these:

```env
# Database (automatically set by Railway PostgreSQL plugin)
# DATABASE_URL=postgresql://... (do not manually set, Railway provides this)

# External APIs
NEWSAPI_KEY=<your_actual_newsapi_key>
OPENROUTER_API_KEY=<your_actual_openrouter_key>
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free

# Batch processing
BATCH_KEYWORDS=climate,pollution,deforestation,wildfire,flood,drought,oil spill,emissions,biodiversity,ocean

# Security
ADMIN_API_KEY=<generate_random_32_char_string>
CRON_SECRET=<generate_random_32_char_string>

# Environment
NODE_ENV=production
```

**Generate secrets:**
```bash
openssl rand -base64 32  # For ADMIN_API_KEY
openssl rand -base64 32  # For CRON_SECRET
# Or use: https://www.random.org/strings/
```

---

## Step 4: Initialize Database Schema (2 min)

After first deployment completes, push Drizzle schema to PostgreSQL:

**Option A: Via Railway CLI**
```bash
# Install CLI
npm i -g @railway/cli

# Login and link project
railway login
railway link

# Push schema to create tables
railway run npx drizzle-kit push

# Then seed data
railway run npx tsx scripts/seed.ts
```

**Option B: Via One-time Command (Railway Dashboard)**
1. Go to project → **Service** → **Settings**
2. Add one-time deployment command: `npx drizzle-kit push && npx tsx scripts/seed.ts`
3. Redeploy to run the command

---

## Step 5: Set Up Cron Job (3 min)

**Option A: Railway Cron Service (Recommended)**

If Railway supports native cron:
1. Add new service to project
2. Type: **Cron Job**
3. Schedule: `0 6 * * *` (daily at 6am UTC)
4. Command: `npx tsx scripts/batch.ts`
5. Use same environment variables and volume

**Option B: External Cron (cron-job.org)**

1. Sign up at https://cron-job.org
2. Create new cron job:
   - **URL:** `https://<your-app>.up.railway.app/api/cron/batch`
   - **Schedule:** Daily at 6:00 AM UTC
   - **Headers:**
     ```
     Authorization: Bearer <your_CRON_SECRET>
     ```
3. Test with "Run now" button

---

## Step 6: Verify Deployment (5 min)

Railway provides auto-generated URL: `https://<project-name>.up.railway.app`

**Test endpoints:**
```bash
# Health check
curl https://your-app.up.railway.app/api/ticker

# Topic list
curl https://your-app.up.railway.app/api/topics

# Verify security headers
curl -I https://your-app.up.railway.app

# Test cron endpoint (if using external cron)
curl -H "Authorization: Bearer <CRON_SECRET>" \
  https://your-app.up.railway.app/api/cron/batch
```

**Check logs:**
- Railway dashboard → **Deployments** → Latest → **View Logs**
- Look for startup messages and any errors

---

## Step 7: Custom Domain (Optional)

1. Go to project → **Settings** → **Domains**
2. Click **"Custom Domain"**
3. Enter: `ecoticker.yourdomain.com`
4. Add DNS record at your domain registrar:
   ```
   Type: CNAME
   Name: ecoticker
   Value: <your-project>.up.railway.app
   ```
5. Railway auto-provisions SSL certificate

---

## Monitoring & Logs

**View logs:**
```bash
railway logs
# Or via dashboard: Deployments → View Logs
```

**Monitor health:**
- Railway shows CPU/RAM usage in dashboard
- Healthcheck endpoint: `/api/ticker` (configured in railway.toml)

**Set up alerts:**
- Railway → Settings → Notifications
- Get notified on deployment failures

---

## Troubleshooting

### Database is empty after deploy
Push schema and seed:
```bash
railway run npx drizzle-kit push
railway run npx tsx scripts/seed.ts
```

### Cron job not running
Check logs for batch endpoint calls:
```bash
railway logs --filter "batch"
```

Verify CRON_SECRET matches in both:
- Railway environment variables
- External cron service headers

### Build fails
Check Dockerfile compatibility:
```bash
# Test locally
docker build -t ecoticker .
docker run -p 3000:3000 ecoticker
```

### Database connection issues
Verify PostgreSQL service:
- Railway dashboard → PostgreSQL service should be healthy
- DATABASE_URL is automatically set by Railway
- Check app logs for connection errors

---

## Cost Breakdown

**Railway Hobby Plan: $5/month**
- 500 execution hours included
- $0.000231/GB-hour for overages

**EcoTicker Usage:**
- Web service: ~720 hours/month (24/7)
- Cron: ~1 hour/month (daily 5min runs)
- Storage: <1GB

**Total: ~$5-7/month** depending on traffic

**Free tier:** Railway has a free trial but requires credit card after trial ends.

---

## Migration from Docker Compose

If migrating from existing Docker setup with SQLite:

1. **Export existing SQLite data to PostgreSQL:**
   ```bash
   # Use a migration tool like pgloader or write custom migration script
   # This is needed because SQLite and PostgreSQL formats differ
   ```

2. **Import to Railway PostgreSQL:**
   ```bash
   # Connect to Railway PostgreSQL and import data
   railway connect postgres
   # Then use psql commands to import
   ```

3. **Keep Docker running** until Railway is verified (48 hours)

4. **Update DNS** to Railway when ready

**Note:** For v2 migrations, you're starting fresh with PostgreSQL, so no data migration needed if coming from v1 SQLite.

---

## Next Steps

- [ ] Monitor logs for 24 hours
- [ ] Verify cron job runs successfully
- [ ] Test all features (filters, detail pages, ticker)
- [ ] Set up custom domain
- [ ] Configure monitoring alerts
- [ ] Update documentation with Railway URL

---

## Support

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **GitHub Issues:** https://github.com/sidtheone/ecoticker/issues

---

**Deployment Status: ✅ Ready to deploy**

Commands to run:
```bash
# 1. Commit Railway configuration
git add .
git commit -m "Add Railway deployment configuration"
git push origin main

# 2. Watch Railway auto-deploy
# (Railway dashboard will show build progress)

# 3. After deploy, initialize database
railway run npx drizzle-kit push
railway run npx tsx scripts/seed.ts

# 4. Set up external cron at cron-job.org
# URL: https://<your-app>.railway.app/api/cron/batch
# Header: Authorization: Bearer <CRON_SECRET>
```
