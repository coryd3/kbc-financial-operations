#!/bin/bash
set -e

cd app
npm install --no-audit --no-fund
# pg_trgm must exist before db:push — the members trigram GIN indexes in
# shared/schema.ts use the gin_trgm_ops operator class from this extension.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE EXTENSION IF NOT EXISTS pg_trgm"
npm run db:push -- --force
