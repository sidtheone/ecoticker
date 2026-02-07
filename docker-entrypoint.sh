#!/bin/sh
set -e

# Fix permissions on /data directory if running as root
if [ "$(id -u)" = "0" ]; then
  echo "Running as root, fixing /data permissions..."
  chown -R nextjs:nodejs /data 2>/dev/null || true
  echo "Switching to nextjs user..."
  exec su-exec nextjs "$@"
else
  echo "Running as user $(id -u), attempting to access /data..."
  # Try to create directory if it doesn't exist
  mkdir -p /data 2>/dev/null || true
  exec "$@"
fi
