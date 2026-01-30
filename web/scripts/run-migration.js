/**
 * Database Migration Runner
 *
 * Usage:
 *   node scripts/run-migration.js                    # Uses .env.test DB
 *   node scripts/run-migration.js --prod             # Uses .env.local (production) DB
 *   node scripts/run-migration.js <db_url>           # Uses custom DB URL
 *   node scripts/run-migration.js <db_url> <file>    # Custom DB and migration file
 */

const { neon } = require("@neondatabase/serverless");
const fs = require("fs");
const path = require("path");

// Load environment variables
const envTestPath = path.join(__dirname, "../.env.test");
const envLocalPath = path.join(__dirname, "../.env.local");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const env = {};
  content.split("\n").forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      env[match[1].trim()] = match[2].trim();
    }
  });
  return env;
}

// Determine which database to use
let dbUrl;
let migrationFile;
const args = process.argv.slice(2);

if (args.includes("--prod")) {
  // Use production database
  const envLocal = loadEnvFile(envLocalPath);
  dbUrl = envLocal.NEON_DATABASE_URL || process.env.NEON_DATABASE_URL;
  console.log("🔴 Using PRODUCTION database (.env.local)\n");
} else if (
  args[0] &&
  !args[0].startsWith("--") &&
  args[0].startsWith("postgres")
) {
  // Custom URL provided
  dbUrl = args[0];
  migrationFile = args[1];
  console.log("🔵 Using custom database URL\n");
} else {
  // Default: use test database
  const envTest = loadEnvFile(envTestPath);
  dbUrl = envTest.NEON_DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ No test database configured!");
    console.error(
      "   Create .env.test with NEON_DATABASE_URL=<your-branch-url>",
    );
    console.error(
      "   Or run with: node scripts/run-migration.js <database_url>",
    );
    process.exit(1);
  }
  console.log("🟢 Using TEST database (.env.test)\n");
}

// Default migration file
if (!migrationFile) {
  const migrationsDir = path.join(__dirname, "../../supabase/migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  migrationFile = path.join(migrationsDir, files[files.length - 1]); // Latest migration
}

async function runMigration() {
  const sql = neon(dbUrl);

  console.log("📄 Migration file:", path.basename(migrationFile));
  const migrationSQL = fs.readFileSync(migrationFile, "utf8");

  // Split SQL into individual statements
  // Handles $$ dollar quoting for function bodies
  const statements = [];
  let current = "";
  let inDollarQuote = false;

  for (let i = 0; i < migrationSQL.length; i++) {
    const char = migrationSQL[i];
    const nextChar = migrationSQL[i + 1];

    // Check for $$ dollar quoting (used in function bodies)
    if (char === "$" && nextChar === "$") {
      inDollarQuote = !inDollarQuote;
      current += char;
      continue;
    }

    // If we hit a semicolon and we're not in a dollar-quoted block
    if (char === ";" && !inDollarQuote) {
      current += char;
      const trimmed = current.trim();
      // Only skip if it's ENTIRELY comments (no actual SQL)
      const hasSQL = trimmed.split("\n").some((line) => {
        const l = line.trim();
        return l && !l.startsWith("--");
      });
      if (hasSQL) {
        statements.push(trimmed);
      }
      current = "";
      continue;
    }

    current += char;
  }

  // Add any remaining content
  if (current.trim()) {
    const hasSQL = current
      .trim()
      .split("\n")
      .some((line) => {
        const l = line.trim();
        return l && !l.startsWith("--");
      });
    if (hasSQL) {
      statements.push(current.trim());
    }
  }

  console.log(`📊 Found ${statements.length} statements to execute\n`);

  let successCount = 0;
  let skipCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];

    // Skip comments-only statements
    if (
      stmt
        .split("\n")
        .every((line) => line.trim().startsWith("--") || line.trim() === "")
    ) {
      skipCount++;
      continue;
    }

    // Get first meaningful line for logging
    const firstLine =
      stmt
        .split("\n")
        .find((l) => l.trim() && !l.trim().startsWith("--"))
        ?.trim() || stmt.substring(0, 60);
    const preview =
      firstLine.substring(0, 60) + (firstLine.length > 60 ? "..." : "");

    try {
      await sql.query(stmt);
      console.log(`✓ [${i + 1}/${statements.length}] ${preview}`);
      successCount++;
    } catch (err) {
      console.error(`✗ [${i + 1}/${statements.length}] ${preview}`);
      console.error(`  Error: ${err.message}\n`);

      // Check if it's a "already exists" error - those are OK to continue
      if (
        err.message.includes("already exists") ||
        err.message.includes("duplicate key")
      ) {
        console.log("  (Continuing - object already exists)\n");
        skipCount++;
        continue;
      }

      throw err;
    }
  }

  console.log(`\n✅ Migration completed!`);
  console.log(`   - ${successCount} statements executed`);
  console.log(`   - ${skipCount} statements skipped`);
}

runMigration().catch((err) => {
  console.error("\n❌ Migration failed:", err.message);
  process.exit(1);
});
