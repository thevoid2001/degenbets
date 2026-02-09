/**
 * Dev startup script - launches embedded PostgreSQL, runs migrations, then starts the backend.
 * Usage: npx ts-node --skip-project --compiler-options '{"module":"commonjs","esModuleInterop":true}' start-dev.ts
 */

const EmbeddedPostgres = require("embedded-postgres").default;
const { execSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const DB_DIR = path.join(__dirname, ".pg-data");
const PG_PORT = 5432;
const DB_NAME = "degenbets";

async function main() {
  console.log("[start-dev] Starting embedded PostgreSQL...");

  const pg = new EmbeddedPostgres({
    databaseDir: DB_DIR,
    user: "postgres",
    password: "postgres",
    port: PG_PORT,
    persistent: true,
  });

  // Initialize if first run
  if (!fs.existsSync(path.join(DB_DIR, "data"))) {
    console.log("[start-dev] First run — initializing PostgreSQL cluster...");
    await pg.initialise();
  }

  await pg.start();
  console.log(`[start-dev] PostgreSQL running on port ${PG_PORT}`);

  // Create database (ignore error if it already exists)
  try {
    await pg.createDatabase(DB_NAME);
    console.log(`[start-dev] Database '${DB_NAME}' created`);
  } catch (err: any) {
    if (err.message?.includes("already exists")) {
      console.log(`[start-dev] Database '${DB_NAME}' already exists`);
    } else {
      throw err;
    }
  }

  // Set DATABASE_URL for the backend
  const dbUrl = `postgresql://postgres:postgres@localhost:${PG_PORT}/${DB_NAME}`;
  process.env.DATABASE_URL = dbUrl;

  // Run migrations
  console.log("[start-dev] Running migrations...");
  execSync(`npx ts-node src/db/migrate.ts`, {
    cwd: __dirname,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });

  // Start the backend
  console.log("[start-dev] Starting backend server...");
  const backend = spawn("npx", ["ts-node-dev", "--respawn", "src/index.ts"], {
    cwd: __dirname,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: dbUrl },
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n[start-dev] Shutting down...");
    backend.kill();
    await pg.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  backend.on("exit", async (code: number | null) => {
    console.log(`[start-dev] Backend exited with code ${code}`);
    await pg.stop();
    process.exit(code || 0);
  });
}

main().catch(async (err: any) => {
  console.error("[start-dev] Fatal error:", err);
  process.exit(1);
});
