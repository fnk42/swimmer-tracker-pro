// Load schema + data into Neon, then verify.
//   node migration/load.mjs           -- schema + data, then verify
//   node migration/load.mjs --verify  -- verify only, writes nothing
//
// Reads DATABASE_URL from .env. Refuses to load data into a database that
// already has rows, so a re-run can never silently double-insert.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);

function env(name) {
  if (process.env[name]) return process.env[name];
  const f = join(root, '.env');
  if (!existsSync(f)) return undefined;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, '');
  }
}

const TABLES = ['swimmers', 'parents', 'swimmer_parents', 'registrations', 'payments'];
const EXPECTED = { swimmers: 46, parents: 20, swimmer_parents: 24, registrations: 24, payments: 15 };

const url = env('DATABASE_URL');
if (!url) {
  console.error('DATABASE_URL not found in .env or environment.');
  process.exit(1);
}

const verifyOnly = process.argv.includes('--verify');
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function counts() {
  const out = {};
  for (const t of TABLES) {
    try {
      const r = await client.query(`select count(*)::int n from public.${t}`);
      out[t] = r.rows[0].n;
    } catch { out[t] = null; }
  }
  return out;
}

try {
  await client.connect();
  const who = await client.query('select current_database() db, version() v');
  console.log(`connected: ${who.rows[0].db}`);
  console.log(`server:    ${who.rows[0].v.split(',')[0]}\n`);

  if (!verifyOnly) {
    const before = await counts();
    const existing = Object.values(before).filter(n => n > 0).length;
    if (existing) {
      console.error('Refusing to load: the database already has rows.');
      console.table(before);
      console.error('Use --verify to check, or drop the tables first.');
      process.exit(1);
    }
    for (const f of ['01_schema.sql', '02_data.sql']) {
      const sql = readFileSync(join(here, f), 'utf8');
      process.stdout.write(`applying ${f} ... `);
      await client.query(sql);
      console.log('ok');
    }
    console.log('');
  }

  const after = await counts();
  let bad = 0;
  console.log('table               loaded  expected');
  for (const t of TABLES) {
    const ok = after[t] === EXPECTED[t];
    if (!ok) bad++;
    console.log(`  ${t.padEnd(18)}${String(after[t]).padStart(5)}${String(EXPECTED[t]).padStart(10)}  ${ok ? '' : '<-- MISMATCH'}`);
  }
  // spot-check the money, since that is the number that matters
  const pay = await client.query('select coalesce(sum(amount),0)::float t from public.payments');
  const expect = 170460;
  const okMoney = Math.abs(pay.rows[0].t - expect) < 0.01;
  console.log(`\n  payments total    KES ${pay.rows[0].t.toLocaleString()}  (expected ${expect.toLocaleString()})  ${okMoney ? 'ok' : '<-- MISMATCH'}`);
  if (!okMoney) bad++;
  // referential integrity
  const orphan = await client.query(`
    select (select count(*) from public.swimmer_parents sp left join public.swimmers s on s.id=sp.swimmer_id where s.id is null)::int a,
           (select count(*) from public.swimmer_parents sp left join public.parents p on p.id=sp.parent_id where p.id is null)::int b,
           (select count(*) from public.payments pm left join public.swimmers s on s.id=pm.swimmer_id where s.id is null)::int c`);
  const { a, b, c } = orphan.rows[0];
  console.log(`  orphaned rows     ${a + b + c}  ${a + b + c === 0 ? 'ok' : '<-- PROBLEM'}`);
  if (a + b + c) bad++;
  console.log(bad ? `\n${bad} CHECK(S) FAILED` : '\nAll checks passed.');
  process.exit(bad ? 1 : 0);
} catch (e) {
  console.error('\nERROR:', e.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
