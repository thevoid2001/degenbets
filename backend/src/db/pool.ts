/**
 * PostgreSQL connection pool
 * @author anon
 */

import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("[db] Unexpected pool error:", err.message);
});

pool.on("connect", () => {
  console.log("[db] New client connected to pool");
});

/**
 * Execute a parameterized query against the pool.
 */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 500) {
    console.warn(`[db] Slow query (${duration}ms): ${text.slice(0, 120)}`);
  }
  return result.rows as T[];
}

/**
 * Get a dedicated client from the pool (for transactions).
 */
export async function getClient() {
  const client = await pool.connect();
  return client;
}

export default pool;
