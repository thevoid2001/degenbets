/**
 * Database migration runner - reads and executes schema.sql
 * @author anon
 *
 * Usage: npx ts-node src/db/migrate.ts
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import pool from "./pool";

dotenv.config();

async function migrate(): Promise<void> {
  const schemaPath = path.join(__dirname, "schema.sql");

  if (!fs.existsSync(schemaPath)) {
    console.error("[migrate] schema.sql not found at", schemaPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(schemaPath, "utf-8");

  console.log("[migrate] Connecting to database...");

  const client = await pool.connect();
  try {
    console.log("[migrate] Running schema migrations...");
    await client.query(sql);
    console.log("[migrate] Schema migration completed successfully.");
  } catch (err) {
    console.error("[migrate] Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
