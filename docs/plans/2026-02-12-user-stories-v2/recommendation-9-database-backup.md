# Recommendation #9: Database Backup

> Taleb: "Single-file SQLite database with no backup mechanism. A corrupt file = total data loss."

## US-9.1: Automatic daily database backup
**As a** site operator, **I want** the database backed up daily before the batch run, **so that** I can recover from corruption, bad batch runs, or accidental deletion.

**Why BEFORE the batch run:** If the batch corrupts the DB (unlikely with SQLite WAL but possible with disk full, power loss, etc.), you want a backup from BEFORE the corruption. Backup at 5:55 AM, batch at 6:00 AM.

**Acceptance Criteria:**
- New script: `scripts/backup.ts`
  - Uses `better-sqlite3`'s `.backup()` API (not shell commands — native, atomic, handles WAL correctly)
  - Destination: `/backups/ecoticker-YYYY-MM-DD.db`
  - After backup: scan `/backups/`, delete files older than 7 days
  - On success: log "Backup complete: ecoticker-2026-02-12.db (2.4 MB)"
  - On failure: log error with details. Exit code 0 (don't block the cron pipeline)
- Crontab updated: `55 5 * * * /app/scripts/backup.sh` (before the 6 AM batch)
- Docker: backup directory mapped to the named volume (persists across container restarts)

**Complexity:** S (10-line script + crontab entry)
**Dependencies:** None

---
