// Carry the club's reinstatements back into the pipeline.
//
//   node migration/pull_reinstatements.mjs [path/to/nextgen]
//
// The twelve-month rule in tools/roster.py decides who is dormant. A
// coordinator can overrule it on /dormant, which records the decision in
// roster_decisions. This writes those decisions into data/roster_overrides.csv,
// which roster.py already treats as winning over the rule.
//
// Run before ./ingest.sh. Decisions that have not been pulled through do
// nothing to the figures, which is why the page says so on every row.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const app = dirname(dirname(fileURLToPath(import.meta.url)));
const root = process.argv[2] || join(dirname(app), 'NextGen');
const csvPath = join(root, 'data/roster_overrides.csv');
if (!existsSync(csvPath)) {
  console.error(`No roster_overrides.csv at ${csvPath} — pass the pipeline path as an argument`);
  process.exit(1);
}

const url = readFileSync(join(app, '.env'), 'utf8').split('\n')
  .find(l => l.startsWith('DATABASE_URL=')).slice(13).trim();
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
await c.connect();
const { rows } = await c.query(
  `select swimmer, decision, reason, decided_by, created_at
     from public.roster_decision_current order by swimmer`);
await c.end();

// Parse what is there, keeping every column and every row we did not write.
const text = readFileSync(csvPath, 'utf8').trim();
const [head, ...body] = text.split('\n');
const cols = head.split(',');
const split = l => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).slice(0, cols.length)
  .map(x => x.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));
const existing = body.filter(Boolean).map(l => Object.fromEntries(
  split(l).map((v, i) => [cols[i], v])));

const MARK = 'reinstated by the club on ';
// Ours are the rows we previously wrote; anything else is a club confirmation
// entered by hand and is left exactly as it is.
const theirs = existing.filter(r => !(r.note || '').startsWith(MARK));
const mine = rows
  .filter(r => r.decision === 'active')
  .map(r => ({
    swimmer: r.swimmer,
    roster_status: 'current',
    confirmed_by: 'club',
    note: `${MARK}${r.created_at.toISOString().slice(0, 10)} by ${r.decided_by}` +
          (r.reason ? ` — ${r.reason.replace(/[\r\n]+/g, ' ')}` : ''),
  }));

const clash = mine.filter(m => theirs.some(t => t.swimmer === m.swimmer));
for (const x of clash) {
  console.error(`REFUSING: ${x.swimmer} already has a hand-entered status; ` +
                `resolve that row before reinstating them`);
}
if (clash.length) process.exit(1);

const quote = v => /[",\n]/.test(v ?? '') ? `"${String(v).replace(/"/g, '""')}"` : (v ?? '');
const out = [head, ...[...theirs, ...mine].map(r => cols.map(k => quote(r[k])).join(','))];
writeFileSync(csvPath, out.join('\n') + '\n');
console.log(`roster_overrides.csv: ${theirs.length} kept, ${mine.length} reinstated by the club`);
for (const m of mine) console.log(`  active again: ${m.swimmer}`);
