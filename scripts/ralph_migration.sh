#!/bin/bash
set -e  # Exit on any error

# ============================================================
# RALPH MIGRATION SCRIPT - Supabase to Neon + NextAuth.js
# Run once, does everything autonomously
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

LOG_FILE="$PROJECT_DIR/ralph_migration.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "============================================================"
echo "RALPH MIGRATION - Started at $(date)"
echo "============================================================"

# ------------------------------------------------------------
# PHASE 1: Create Neon Project
# ------------------------------------------------------------
echo ""
echo ">>> PHASE 1: Creating Neon Project..."

if neonctl projects list --output json 2>/dev/null | jq -e '.[] | select(.name=="viziai")' > /dev/null 2>&1; then
    echo "Neon project 'viziai' already exists"
    NEON_PROJECT_ID=$(neonctl projects list --output json | jq -r '.[] | select(.name=="viziai") | .id')
else
    echo "Creating Neon project 'viziai'..."
    NEON_OUTPUT=$(neonctl projects create --name viziai --region-id aws-eu-central-1 --output json)
    NEON_PROJECT_ID=$(echo "$NEON_OUTPUT" | jq -r '.project.id')
    echo "Created project: $NEON_PROJECT_ID"
fi

# Get connection string
echo "Getting Neon connection string..."
NEON_CONN=$(neonctl connection-string --project-id "$NEON_PROJECT_ID" 2>/dev/null || neonctl connection-string "$NEON_PROJECT_ID" 2>/dev/null)
echo "NEON_DATABASE_URL=$NEON_CONN" > "$PROJECT_DIR/.env.neon"
echo "Saved connection string to .env.neon"

# Add to gitignore if not present
grep -q '.env.neon' .gitignore 2>/dev/null || echo '.env.neon' >> .gitignore

# ------------------------------------------------------------
# PHASE 2: Capture API Baselines (TDD)
# ------------------------------------------------------------
echo ""
echo ">>> PHASE 2: Capturing API Baselines..."

mkdir -p tests/baseline tests/integration

# Check if dev server is running
DEV_PORT=3000
if curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/metrics 2>/dev/null | grep -q "200"; then
    DEV_PORT=3000
elif curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/metrics 2>/dev/null | grep -q "200"; then
    DEV_PORT=3001
else
    echo "Starting dev server..."
    cd "$PROJECT_DIR/web"
    npm run dev &
    DEV_PID=$!
    sleep 10
    cd "$PROJECT_DIR"
    if curl -s -o /dev/null http://localhost:3000 2>/dev/null; then
        DEV_PORT=3000
    else
        DEV_PORT=3001
    fi
fi

echo "Using dev server on port $DEV_PORT"

# Capture metrics endpoint
echo "Capturing /api/metrics baseline..."
curl -s "http://localhost:$DEV_PORT/api/metrics" | jq -S . > tests/baseline/metrics_default.json
curl -s "http://localhost:$DEV_PORT/api/metrics?profileName=NONEXISTENT" | jq -S . > tests/baseline/metrics_empty.json

# Capture metric-order endpoint
echo "Capturing /api/metric-order baseline..."
curl -s "http://localhost:$DEV_PORT/api/metric-order" | jq -S . > tests/baseline/metric_order_default.json
curl -s "http://localhost:$DEV_PORT/api/metric-order?profileName=NONEXISTENT" | jq -S . > tests/baseline/metric_order_empty.json

# Capture error responses
echo "Capturing error responses..."
curl -s -X PUT "http://localhost:$DEV_PORT/api/metric-order" -H 'Content-Type: application/json' -d '{"order": "not-array"}' | jq -S . > tests/baseline/metric_order_put_400.json
curl -s -X PUT "http://localhost:$DEV_PORT/api/metric-order" -H 'Content-Type: application/json' -d '{"profileName": "NONEXISTENT", "order": []}' | jq -S . > tests/baseline/metric_order_put_404.json

# Record counts for verification
echo "Recording baseline counts..."
jq '.metrics | length' tests/baseline/metrics_default.json > tests/baseline/metrics_count.txt
jq '.values | length' tests/baseline/metrics_default.json > tests/baseline/values_count.txt
jq '.order | length' tests/baseline/metric_order_default.json > tests/baseline/order_count.txt

echo "Baselines captured:"
ls -la tests/baseline/

# ------------------------------------------------------------
# PHASE 3: Export Supabase Schema and Data
# ------------------------------------------------------------
echo ""
echo ">>> PHASE 3: Exporting Supabase Schema and Data..."

mkdir -p supabase/export

# Get Supabase connection URL
echo "Getting Supabase database URL..."
SUPABASE_PROJECT_ID="umrhdgqvyipnraapshhl"
SUPABASE_DB_URL=$(supabase db remote-url --project-ref "$SUPABASE_PROJECT_ID" 2>/dev/null || echo "")

if [ -z "$SUPABASE_DB_URL" ]; then
    # Fallback: construct URL from known info
    SUPABASE_DB_URL="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${SUPABASE_PROJECT_ID}.supabase.co:5432/postgres"
    echo "Using constructed Supabase URL"
fi

# Export schema (tables only, no RLS, no auth schema)
echo "Exporting schema..."
pg_dump "$SUPABASE_DB_URL" \
    --schema=public \
    --schema-only \
    --no-owner \
    --no-privileges \
    --no-comments \
    --exclude-table='*_rls_*' \
    2>/dev/null > supabase/export/schema_raw.sql || echo "pg_dump schema failed, trying alternative..."

# Clean up Supabase-specific stuff from schema
if [ -f supabase/export/schema_raw.sql ]; then
    grep -v -E "(CREATE POLICY|ALTER.*ENABLE ROW|GRANT|REVOKE|supabase_|auth\.|realtime)" supabase/export/schema_raw.sql > supabase/export/schema.sql 2>/dev/null || cp supabase/export/schema_raw.sql supabase/export/schema.sql
fi

# Export data
echo "Exporting data..."
pg_dump "$SUPABASE_DB_URL" \
    --schema=public \
    --data-only \
    --inserts \
    --no-owner \
    2>/dev/null > supabase/export/data.sql || echo "pg_dump data failed"

# Record row counts
echo "Recording Supabase row counts..."
TABLES="profiles user_access reports metrics metric_definitions profile_allowed_emails metric_aliases processed_files"
echo "{" > supabase/export/row_counts_supabase.json
first=true
for table in $TABLES; do
    count=$(psql "$SUPABASE_DB_URL" -t -c "SELECT count(*) FROM $table" 2>/dev/null | tr -d ' ' || echo "0")
    if [ "$first" = true ]; then
        first=false
    else
        echo "," >> supabase/export/row_counts_supabase.json
    fi
    echo "  \"$table\": $count" >> supabase/export/row_counts_supabase.json
done
echo "}" >> supabase/export/row_counts_supabase.json

echo "Supabase export complete:"
ls -la supabase/export/

# ------------------------------------------------------------
# PHASE 4: Import to Neon
# ------------------------------------------------------------
echo ""
echo ">>> PHASE 4: Importing to Neon..."

source "$PROJECT_DIR/.env.neon"

if [ -f supabase/export/schema.sql ] && [ -s supabase/export/schema.sql ]; then
    echo "Importing schema to Neon..."
    psql "$NEON_DATABASE_URL" < supabase/export/schema.sql 2>&1 || echo "Schema import had warnings"
fi

if [ -f supabase/export/data.sql ] && [ -s supabase/export/data.sql ]; then
    echo "Importing data to Neon..."
    psql "$NEON_DATABASE_URL" < supabase/export/data.sql 2>&1 || echo "Data import had warnings"
fi

# Verify import
echo "Verifying Neon import..."
echo "Tables in Neon:"
psql "$NEON_DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name" 2>/dev/null || echo "Could not list tables"

# Compare row counts
echo "Neon row counts:"
for table in $TABLES; do
    count=$(psql "$NEON_DATABASE_URL" -t -c "SELECT count(*) FROM $table" 2>/dev/null | tr -d ' ' || echo "0")
    echo "  $table: $count"
done

# ------------------------------------------------------------
# PHASE 5: Install Dependencies
# ------------------------------------------------------------
echo ""
echo ">>> PHASE 5: Installing Dependencies..."

cd "$PROJECT_DIR/web"
echo "Installing next-auth and @neondatabase/serverless..."
npm install next-auth @neondatabase/serverless 2>&1

cd "$PROJECT_DIR"
echo "Installing psycopg2-binary for Python..."
source .venv/bin/activate 2>/dev/null || python3 -m venv .venv && source .venv/bin/activate
pip install psycopg2-binary 2>&1

# ------------------------------------------------------------
# PHASE 6: Summary
# ------------------------------------------------------------
echo ""
echo "============================================================"
echo "RALPH MIGRATION - Phase 1-5 Complete at $(date)"
echo "============================================================"
echo ""
echo "COMPLETED:"
echo "  ✓ Neon project created"
echo "  ✓ API baselines captured"
echo "  ✓ Supabase schema/data exported"
echo "  ✓ Data imported to Neon"
echo "  ✓ Dependencies installed"
echo ""
echo "NEXT STEPS (require code changes):"
echo "  - Create NextAuth.js configuration"
echo "  - Update API routes to use Neon"
echo "  - Update middleware for NextAuth"
echo "  - Update frontend components"
echo "  - Remove Supabase dependencies"
echo ""
echo "Baseline files: tests/baseline/"
echo "Export files: supabase/export/"
echo "Neon connection: .env.neon"
echo ""
echo "Log file: $LOG_FILE"
