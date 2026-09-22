// SERVER ONLY. Never import this from a component — it holds the database
// credential. The browser talks to /api/* routes; only those touch the database.
//
// This replaces src/lib/supabase.ts. The difference that matters: the old
// client shipped a database key to every visitor and relied on row-level
// security to contain it. Four of those policies granted the public `anon`
// role USING (true) over parents, registrations, payments and swimmer_parents,
// so anyone could read or delete every parent's phone number and every child's
// recorded health conditions. Here the credential never leaves the server, so
// there is nothing to contain.
import pg from "pg";
import { report } from "@/lib/sentry";

let pool: pg.Pool | null = null;

function connectionString(): string {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.NEON_DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env locally and to the Vercel " +
        "project's environment variables.",
    );
  }
  return url;
}

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: connectionString(),
      // Neon serves a publicly trusted certificate, so verify it properly.
      ssl: { rejectUnauthorized: true },
      // Serverless functions are short-lived and Neon's pooler does the real
      // pooling, so keep very few sockets per instance and retire them fast.
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on("error", (err) => console.error("[db] idle client error:", err));
  }
  return pool;
}

/** Run a query, return all rows. Always pass values as $1, $2 — never interpolate. */
export async function q<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query(text, params as never[]);
  return res.rows as T[];
}

/** Run a query expected to return at most one row. */
export async function one<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

/** Run several statements in a transaction. */
export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Log the real error server-side; tell the client only what it needs. */
export function fail(where: string, err: unknown, message: string, status = 500): Response {
  console.error(`${where}:`, err);
  // Every API route already funnels its failures through here, so this is the
  // one place server errors need reporting from. No-op without SENTRY_DSN.
  report(where, err);
  return json({ error: message }, status);
}
