# Railway Deployment Checklist

Use this checklist to ensure smooth deployment to Railway.

---

## Pre-Deployment Checks

### Code Ready
- [x] `src/middleware.ts` created (security headers)
- [x] `src/app/api/cron/batch/route.ts` created (cron endpoint)
- [x] `railway.toml` configured
- [x] `package.json` has `railway:seed` script
- [x] `.env.railway.example` documented
- [x] Dockerfile has healthcheck
- [ ] All tests pass locally (`npx jest`)
- [ ] Build succeeds locally (`npm run build`)
- [ ] Production mode works (`npm start`)

### Secrets Ready
- [ ] GNEWS_API_KEY obtained from https://gnews.io
- [ ] OPENROUTER_API_KEY obtained from https://openrouter.ai
- [ ] CRON_SECRET generated (`openssl rand -base64 32`)
- [ ] All secrets documented securely (password manager)

### GitHub Ready
- [ ] All changes committed to main branch
- [ ] Repository is public or Railway has access
- [ ] GitHub Actions CI passing (if configured)

---

## Railway Setup

### Project Creation
- [ ] Railway account created/logged in
- [ ] New project created
- [ ] GitHub repo connected (`sidtheone/ecoticker`)
- [ ] Dockerfile detected by Railway

### Volume Configuration
- [ ] Persistent volume created
- [ ] Mount path: `/data`
- [ ] Volume name: `ecoticker-data`

### Environment Variables
Copy from `.env.railway.example` to Railway dashboard:

- [ ] `GNEWS_API_KEY` = `<your_key>`
- [ ] `OPENROUTER_API_KEY` = `<your_key>`
- [ ] `OPENROUTER_MODEL` = `meta-llama/llama-3.1-8b-instruct:free`
- [ ] `DATABASE_PATH` = `/data/ecoticker.db`
- [ ] `BATCH_KEYWORDS` = `climate,pollution,deforestation,...`
- [ ] `CRON_SECRET` = `<generated_secret>`
- [ ] `NODE_ENV` = `production`

### Cron Setup (Choose One)

**Option A: Railway Cron (if available)**
- [ ] Cron service added to project
- [ ] Schedule: `0 6 * * *`
- [ ] Command: `npx tsx scripts/batch.ts`
- [ ] Same env vars and volume mounted

**Option B: External Cron (cron-job.org)**
- [ ] Account created at cron-job.org
- [ ] Cron job configured:
  - URL: `https://<app>.railway.app/api/cron/batch`
  - Schedule: `0 6 * * *`
  - Header: `Authorization: Bearer <CRON_SECRET>`
- [ ] Test run successful

---

## Deployment

### Initial Deploy
- [ ] Code pushed to GitHub
- [ ] Railway auto-deploy triggered
- [ ] Build logs reviewed (no errors)
- [ ] Deploy logs reviewed (container started)
- [ ] Railway URL accessible: `https://<project>.up.railway.app`

### Database Setup
- [ ] Database seeded: `railway run npm run railway:seed`
- [ ] OR existing database uploaded to volume
- [ ] Seed data visible at `/api/topics`

### Verification Tests

**Endpoint Tests:**
- [ ] `/api/ticker` returns 200
- [ ] `/api/topics` returns topic list
- [ ] `/api/movers` returns movers
- [ ] `/topic/<slug>` shows detail page
- [ ] Homepage renders correctly

**Security Headers:**
```bash
curl -I https://<your-app>.railway.app
```
- [ ] `X-Frame-Options: SAMEORIGIN`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Content-Security-Policy` present
- [ ] `Referrer-Policy` present

**Cron Endpoint:**
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" \
  https://<your-app>.railway.app/api/cron/batch
```
- [ ] Returns 200 and `{"success": true}`
- [ ] Batch job runs successfully
- [ ] Database updated with new data
- [ ] Logs show batch execution

**Performance:**
- [ ] Initial load < 2s
- [ ] API responses < 100ms (after cache warmup)
- [ ] No memory leaks (monitor RAM usage)
- [ ] Healthcheck passing (Railway dashboard)

---

## Post-Deployment

### Monitoring
- [ ] Railway logs reviewed (24 hour period)
- [ ] No errors in application logs
- [ ] Cron job ran successfully at scheduled time
- [ ] Database growing appropriately
- [ ] RAM/CPU usage within limits (<512MB, <50% CPU)

### Custom Domain (Optional)
- [ ] Custom domain configured in Railway
- [ ] DNS CNAME record added
- [ ] SSL certificate provisioned (auto)
- [ ] Domain accessible via HTTPS
- [ ] Security headers still present on custom domain

### Documentation
- [ ] README.md updated with Railway URL
- [ ] Deployment instructions added
- [ ] Team access configured (if applicable)
- [ ] Monitoring/alert documentation
- [ ] Rollback procedure documented

### Cleanup
- [ ] Old Docker Compose setup archived (if migrating)
- [ ] Local `.env` not committed (verify .gitignore)
- [ ] Test database cleaned up
- [ ] Unused Railway projects deleted

---

## Rollback Plan (If Needed)

### Quick Rollback
- [ ] Previous deployment available in Railway history
- [ ] Click "Redeploy" on last working deployment
- [ ] OR revert git commit and push

### Full Rollback to Docker
- [ ] Docker Compose files still available
- [ ] Database backup exists
- [ ] `docker compose up -d` restores service
- [ ] DNS reverted to old server

---

## Cost Monitoring

### First Month
- [ ] Railway usage dashboard reviewed weekly
- [ ] Costs within budget ($5-7/month expected)
- [ ] No unexpected overage charges
- [ ] Execution hours within 720 hours/month

### Ongoing
- [ ] Set up billing alerts in Railway
- [ ] Monitor storage growth (<1GB expected)
- [ ] Review monthly invoice
- [ ] Optimize if costs exceed $10/month

---

## Troubleshooting Guide

### Build Fails
1. Check Dockerfile syntax
2. Verify `npm run build` works locally
3. Check Railway build logs for error
4. Ensure all dependencies in package.json

### Deploy Succeeds but App Crashes
1. Check Railway runtime logs
2. Verify environment variables set correctly
3. Ensure DATABASE_PATH points to volume
4. Check healthcheck endpoint works

### Database Empty/Resets
1. Verify volume mounted at `/data`
2. Check DATABASE_PATH = `/data/ecoticker.db`
3. Ensure volume not recreated on deploy
4. Re-run seed script if needed

### Cron Not Running
1. Check cron service logs (if Railway cron)
2. Verify external cron hitting endpoint
3. Test `/api/cron/batch` manually
4. Check CRON_SECRET matches
5. Review batch.ts logs for errors

### Slow Performance
1. Check Railway region (should be closest to users)
2. Review API cache headers (300s)
3. Monitor database query times
4. Check memory limits (increase if needed)

---

## Success Criteria

Deployment is **COMPLETE** when:
- ✅ All endpoints return 200 status
- ✅ Database populated with topics
- ✅ Cron job runs successfully (manual test)
- ✅ Security headers present
- ✅ No errors in 24-hour log review
- ✅ Custom domain configured (if desired)
- ✅ Team has access and documentation

**Estimated Total Time:** 30-60 minutes
**Status:** ⏳ Ready to begin deployment

---

## Next Steps After Success

1. **Monitor for 48 hours** — Watch logs, performance, cron execution
2. **Set up alerts** — Railway notifications for failures
3. **Document learnings** — Update this checklist with any issues
4. **Share with team** — Provide Railway access and docs
5. **Plan improvements** — CDN, monitoring, backups

**Railway Dashboard:** https://railway.app/project/<your-project-id>
