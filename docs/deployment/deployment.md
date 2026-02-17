# EcoTicker — Deployment Guide

## Prerequisites

- A Linux VM (2-core, 4GB RAM minimum)
- Docker and Docker Compose installed
- SSH access to the server
- API keys for NewsAPI and OpenRouter
- PostgreSQL 17 (via Docker)

## Step 1: Clone and Configure

```bash
# Clone the repository
git clone <your-repo-url> ecoticker
cd ecoticker

# Create environment file from template
cp .env.example .env
```

Edit `.env` with your API keys:

```env
# Database
DATABASE_URL=postgresql://ecoticker:your_secure_password@postgres:5432/ecoticker

# External APIs
NEWSAPI_KEY=your_newsapi_key        # https://newsapi.org
OPENROUTER_API_KEY=your_openrouter_key  # https://openrouter.ai
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free

# Security
ADMIN_API_KEY=your_secure_admin_key  # Generate with: openssl rand -base64 32

# Batch processing
BATCH_KEYWORDS=climate,pollution,deforestation,wildfire,flood,drought,oil spill,emissions,biodiversity,ocean

# Environment
NODE_ENV=production
```

**Security Note:** Generate a strong `ADMIN_API_KEY`:
```bash
openssl rand -base64 32
```
This key is required for all write operations (POST/PUT/DELETE endpoints). Never commit this key to version control.

## Step 2: Build and Start

```bash
# Build all Docker images
docker compose build

# Start all services in detached mode
docker compose up -d
```

This starts four services:

| Service | Role | Details |
|---------|------|---------|
| **postgres** | PostgreSQL database | Port 5432 (internal), pgdata volume for persistence |
| **app** | Next.js server | Port 3000 (internal), 1GB memory limit, connects to postgres |
| **nginx** | Reverse proxy | Port 80 (public), gzip, static caching |
| **cron** | Batch pipeline | Runs daily at 6AM UTC, connects to postgres |

## Step 3: Initialize Database Schema

On first deploy, push the Drizzle schema to PostgreSQL:

```bash
# Push schema to create tables
docker compose exec app npx drizzle-kit push
```

Then seed initial data:

```bash
# Run batch pipeline to fetch real news data
docker compose exec app npx tsx scripts/batch.ts

# OR use seed script for demo data
docker compose exec app npx tsx scripts/seed.ts
```

## Step 4: Verify

```bash
# Check all services are running
docker compose ps

# Check app logs
docker compose logs app

# Check cron logs
docker compose logs cron

# Test the API
curl http://localhost/api/topics
curl http://localhost/api/ticker
```

Visit `http://<your-server-ip>` in a browser to see the dashboard.

## Security Configuration

The application includes comprehensive security features:

### Authentication
All write operations (POST/PUT/DELETE) require the `X-API-Key` header:

```bash
# Seed database (requires authentication)
curl -X POST http://localhost/api/seed \
  -H "X-API-Key: your_admin_key_here"

# Run batch processing (requires authentication)
curl -X POST http://localhost/api/batch \
  -H "X-API-Key: your_admin_key_here"
```

### Rate Limiting
- **Read operations (GET):** 100 requests/minute per IP
- **Write operations (POST/PUT/DELETE):** 10 requests/minute per IP
- **Batch/Seed operations:** 2 requests/hour per IP

Rate-limited requests return `429 Too Many Requests` with a `Retry-After` header.

### Audit Logging
All write operations are logged to the `audit_logs` table. View audit logs:

```bash
# View recent audit logs
curl http://localhost/api/audit-logs \
  -H "X-API-Key: your_admin_key_here"

# View audit statistics
curl "http://localhost/api/audit-logs?stats=true" \
  -H "X-API-Key: your_admin_key_here"
```

### Content-Security-Policy
CSP headers are enabled in production to prevent XSS attacks. The middleware sets strict CSP directives while allowing Next.js hydration.

## Architecture

```
Internet → :80 → Nginx → :3000 → Next.js App
                                      ↕
                              PostgreSQL :5432 (pgdata volume)
                                      ↕
                              Cron → batch.ts (daily 6AM)
```

- **Named volume** `pgdata` persists the PostgreSQL database across container restarts and rebuilds
- Both `app` and `cron` containers connect to the `postgres` service via DATABASE_URL
- Database connection pooling managed by Drizzle ORM (pg library)

## HTTPS Setup (Optional)

To enable HTTPS with Let's Encrypt:

1. Install Certbot on the host
2. Obtain certificates:
   ```bash
   certbot certonly --standalone -d yourdomain.com
   ```
3. Update `nginx.conf` to add SSL:
   ```nginx
   server {
       listen 443 ssl;
       server_name yourdomain.com;
       ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
       # ... existing proxy config ...
   }
   server {
       listen 80;
       return 301 https://$host$request_uri;
   }
   ```
4. Mount the certs into the nginx container by adding to `docker-compose.yml`:
   ```yaml
   nginx:
     volumes:
       - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
       - /etc/letsencrypt:/etc/letsencrypt:ro
     ports:
       - "80:80"
       - "443:443"
   ```
5. Restart: `docker compose restart nginx`

## Common Operations

```bash
# Restart all services
docker compose restart

# Rebuild after code changes
docker compose build && docker compose up -d

# View real-time logs
docker compose logs -f

# Run batch manually
docker compose exec app npx tsx scripts/batch.ts

# Stop everything
docker compose down

# Stop and remove data volume (destructive)
docker compose down -v

# Check database size
docker compose exec postgres psql -U ecoticker -c "SELECT pg_size_pretty(pg_database_size('ecoticker'));"

# Access PostgreSQL directly
docker compose exec postgres psql -U ecoticker -d ecoticker
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| App not reachable on :80 | Check `docker compose ps` — nginx must be running |
| Empty dashboard | First run `drizzle-kit push`, then `scripts/batch.ts` |
| Cron not running | Check logs: `docker compose logs cron` |
| Database connection errors | Verify DATABASE_URL env var, ensure postgres service is healthy |
| PostgreSQL not starting | Check logs: `docker compose logs postgres` |
| Out of memory | Increase `mem_limit` in `docker-compose.yml` |
| Port 80 in use | Change nginx port mapping: `"8080:80"` in `docker-compose.yml` |
