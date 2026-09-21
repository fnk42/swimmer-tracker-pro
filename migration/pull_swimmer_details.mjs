// Carry the club's swimmer corrections back into the pipeline.
//
//   node migration/pull_swimmer_details.mjs [path/to/nextgen]
//
// A date typed on /database lands in swimmer_details. This writes the latest
// per swimmer into data/dob_overrides.csv, which tools/roster.py already
// treats as beating both the meet export's own field and the athlete ID.
//
// Run before ./ingest.sh. Until it runs, an edit changes nothing in the
// figures — which is why the page says so on every edited row.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const app = dirname(dirname(fileURLToPath(import.meta.url)));
const root = process.argv[2] || join(dirname(app), 'NextGen');
const csvPath = join(root, 'data/dob_overrides.csv');
if (!existsSync(csvPath)) {
  console.error(`No dob_overrides.csv at ${csvPath} — pass the pipeline path as an argument`);
  process.exit(1);
}

const url = readFileSync(join(app, '.env'), 'utf8').split('\n')
  .find(l => l.startsWith('DATABASE_URL=')).slice(13).trim();
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
await c.connect();
const { rows } = await c.query(
  `select swimmer, dob::text, note, edited_by, created_at
     from public.swimmer_details_current where dob is not null order by swimmer`);
await c.end();

const text = readFileSync(csvPath, 'utf8').trim();
const [head, ...body] = text.split('\n');
const cols = head.split(',');
const split = l => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).slice(0, cols.length)
  .map(x => x.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));
const existing = body.filter(Boolean).map(l => Object.fromEntries(
  split(l).map((v, i) => [cols[i], v])));

const MARK = 'typed on the database page ';
// Rows we wrote before are replaced; anything else — a disputed row, a
// hand-edited note — is left exactly as it is.
const theirs = existing.filter(r => !(r.note || '').startsWith(MARK));
const mine = rows.map(r => ({
  swimmer: r.swimmer,
  dob: r.dob,
  status: 'confirmed',
  confirmed_by: 'club',
  note: `${MARK}${r.created_at.toISOString().slice(0, 10)} by ${r.edited_by}` +
        (r.note ? ` — ${r.note.replace(/[\r\n]+/g, ' ')}` : ''),
}));

// A swimmer the club has ALREADY ruled on by hand is not quietly overwritten
// by a later edit on the page; that conflict is a person's decision to make.
const clash = mine.filter(m => theirs.some(t => t.swimmer === m.swimmer));
for (const x of clash) {
  console.error(`REFUSING: ${x.swimmer} already has a hand-entered row in ` +
                `dob_overrides.csv; resolve that before the page's edit can apply`);
}
if (clash.length) process.exit(1);

const quote = v => /[",\n]/.test(v ?? '') ? `"${String(v).replace(/"/g, '""')}"` : (v ?? '');
const out = [head, ...[...theirs, ...mine].map(r => cols.map(k => quote(r[k])).join(','))];
writeFileSync(csvPath, out.join('\n') + '\n');
console.log(`dob_overrides.csv: ${theirs.length} kept, ${mine.length} from the database page`);
for (const m of mine) console.log(`  ${m.swimmer} -> ${m.dob}`);
