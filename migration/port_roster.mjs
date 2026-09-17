// Apply data/roster_port.json to the portal database.
//
//   node migration/port_roster.mjs            # transaction, rolled back
//   node migration/port_roster.mjs --commit
//
// Reads the payload written by NextGen/tools/port_roster.py.
//
// Idempotent: analytics_name is unique, so re-running links the same rows and
// inserts nothing new. Runs in one transaction — either the whole roster lands
// or none of it does.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";

const NEXTGEN = process.env.NEXTGEN_DIR || path.join(os.homedir(), "Claude Projects/NextGen");
const APP = process.env.APP_DIR || path.join(os.homedir(), "Claude Projects/swimmer-tracker-pro");
const COMMIT = process.argv.includes("--commit");

const url = fs
  .readFileSync(path.join(APP, ".env"), "utf8")
  .match(/^DATABASE_URL=(.*)$/m)[1]
  .trim()
  .replace(/^["']|["']$/g, "");

const payload = JSON.parse(fs.readFileSync(path.join(NEXTGEN, "data/roster_port.json"), "utf8"));

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
await c.connect();

try {
  await c.query("begin");

  // The join column. Unique so one archive athlete cannot end up attached to
  // two portal swimmers, which is the failure that would let a parent claim
  // the wrong child.
  await c.query("alter table public.swimmers add column if not exists analytics_name text");
  await c.query(`create unique index if not exists swimmers_analytics_name_key
                   on public.swimmers (analytics_name) where analytics_name is not null`);

  let linked = 0;
  for (const r of payload.link) {
    const res = await c.query(
      `update public.swimmers
          set analytics_name = $2,
              age            = coalesce(age, $3),
              gender         = coalesce(gender, $4),
              updated_at     = now()
        where id = $1`,
      [r.id, r.analytics_name, r.age, r.gender],
    );
    linked += res.rowCount;
  }

  let inserted = 0;
  for (const r of payload.insert) {
    const res = await c.query(
      `insert into public.swimmers (name, analytics_name, age, gender)
       values ($1, $2, $3, $4)
       on conflict (analytics_name) where analytics_name is not null do nothing`,
      [r.name, r.analytics_name, r.age, r.gender],
    );
    inserted += res.rowCount;
  }

  const total = await c.query("select count(*)::int n from public.swimmers");
  const joined = await c.query(
    "select count(*)::int n from public.swimmers where analytics_name is not null",
  );

  console.log(`  linked   ${linked}`);
  console.log(`  inserted ${inserted}`);
  console.log(`  swimmers now ${total.rows[0].n}, of which ${joined.rows[0].n} join to the archive`);

  if (COMMIT) {
    await c.query("commit");
    console.log("\ncommitted.");
  } else {
    await c.query("rollback");
    console.log("\nrolled back — re-run with --commit to keep it.");
  }
} catch (e) {
  await c.query("rollback").catch(() => {});
  console.error("ERR", e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
