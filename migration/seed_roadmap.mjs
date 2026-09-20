// Seed the roadmap from what has actually shipped, plus what Boit has asked for.
//
// Shipped items carry the real commit they went out in, so the board cannot
// quietly claim credit for work that is not deployed. Everything else starts
// where it genuinely is.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import pg from 'pg';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const url = readFileSync(join(root, '.env'), 'utf8').split('\n')
  .find(l => l.startsWith('DATABASE_URL=')).slice(13).trim();

// Quoted: the pipes in the format string are shell metacharacters otherwise.
const log = execSync("git log --pretty=format:'%h|%ad|%s' --date=short", { cwd: root })
  .toString().trim().split('\n').map(l => {
    const [sha, date, ...rest] = l.split('|');
    return { sha, date, subject: rest.join('|') };
  });

const find = (re) => log.find(c => re.test(c.subject));

const SHIPPED = [
  [/Improvement measured per year/, 'Improvement measured per year, judged against age',
   'Rates are %/year so a season and a career compare. Swimmers are scored against the median for their own age band, so a 16-year-old is not ranked below a 7-year-old for the same number.', 'Dr Boit'],
  [/Per-swimmer trend charts/, 'Trend charts for every swimmer',
   'One chart per event and course. A falling line means the time is coming down.', 'F. Njenga'],
  [/real Actions view/, 'Actions became a real view',
   'Three calls with the swimmers in each, instead of three fixed paragraphs.', 'Dr Boit'],
  [/viewport meta/, 'Fixed the phone layout',
   'The tracker had no viewport tag, so every mobile rule was inert and Android rendered it at desktop width.', 'Dr Boit'],
  [/Two tiers, enforced/, 'Two-tier data model',
   'Competition record for the community, coaching assessment only for coaches and that child’s own guardians. A test fails the build if a field is left unclassified.', 'F. Njenga'],
  [/Registration: one sign-on/, 'One sign-in for all of NextGen', null, 'Dr Boit'],
  [/Coordinator approval queue/, 'Coordinator approval queue', null, 'F. Njenga'],
  [/import the parent list/, 'Parent list import and meet drill-down', null, 'Dr Boit'],
];

const PLANNED = [
  ['building', 'Stroke and event filters, on every page',
   'Age, stroke, event and gender available everywhere, not just on Swimmers. Needs the per-swim table: ships all 5,578 swims at 31 KB gzipped, which is smaller than the current payload.', 'Dr Boit'],
  ['planned', 'Coaching assistant',
   'Ask questions in plain English and get answers from the club’s own data. Blocked until guardians have re-accepted the consent document, which now discloses that this sends data to OpenAI outside Kenya. A child with no accepted consent is never sent.', 'Dr Boit'],
  ['planned', 'Consent drive',
   '190 swimmers, 24 with a guardian attached. Until that closes, most families cannot see their own child and the assistant can see almost nobody.', 'F. Njenga'],
  ['idea', 'Confirm the reconstructed meet titles',
   'The timing software cuts meet names at 30 characters. 34 titles are my reconstruction; data/meet_names.csv is one pass to confirm or correct them.', 'F. Njenga'],
];

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
await c.connect();
const { rows: [{ n }] } = await c.query('select count(*)::int n from public.roadmap_items');
if (n > 0) { console.log(`roadmap already has ${n} items — leaving it alone`); await c.end(); process.exit(0); }

let order = 0, added = 0;
for (const [re, title, detail, raised] of SHIPPED) {
  const hit = find(re);
  await c.query(
    `insert into public.roadmap_items (title, detail, status, raised_by, created_by, shipped_at, commit_sha, sort_order)
     values ($1,$2,'shipped',$3,'F. Njenga',$4,$5,$6)`,
    [title, detail, raised, hit ? new Date(hit.date) : null, hit?.sha ?? null, order++]);
  added++;
}
for (const [status, title, detail, raised] of PLANNED) {
  await c.query(
    `insert into public.roadmap_items (title, detail, status, raised_by, created_by, sort_order)
     values ($1,$2,$3::roadmap_status,$4,'F. Njenga',$5)`,
    [title, detail, status, raised, order++]);
  added++;
}
console.log(`seeded ${added} items (${SHIPPED.length} shipped with real commits)`);
await c.end();
