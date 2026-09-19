// Bring the board up to date with what has actually shipped, and record the
// things still outstanding. Shipped rows carry the commit they went out in.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const url = readFileSync(join(root, '.env'), 'utf8').split('\n')
  .find(l => l.startsWith('DATABASE_URL=')).slice(13).trim();

// [status, title, detail, raised_by, commit, shipped_on]
const ITEMS = [
  ['shipped', 'Sticky filters that follow you down the page',
   'The age and search filters stay on screen as you scroll a long list, and inside a meet the event heading stays put while you read its results. Both sit below the portal bar rather than under it.',
   'Felix', '5088a6b', '2026-09-18'],
  ['shipped', 'Contact details in the footer',
   'Njenga, 0726 178 216, info@goldenpipitrecruiting.com, Fractional CTO services — the number and address are tap-to-call and tap-to-email.',
   'Felix', '5088a6b', '2026-09-18'],
  ['shipped', 'A chart for each distance',
   'Every stroke a swimmer races at one distance and pool length now shares a set of axes — all their 50s on one chart — with the single-event view a tap away.',
   'Felix', 'bf66f88', '2026-09-18'],
  ['shipped', 'Method page: how every number is made',
   'Ten sections explaining the rules behind the other pages, including that the groups are relative by construction and the bottom one can never be empty. Figures on it are computed live so it cannot drift from the code.',
   'Felix', '33d7d8a', '2026-09-18'],
  ['shipped', 'Clearer names for the development groups',
   'Every group now begins with the word "Improving" and names what it is measured against. "Review — slower than they were" was false for swimmers who were getting faster.',
   'Dr Boit', '1b48dcf', '2026-09-18'],
  ['shipped', 'Improvement measured per year and judged against age',
   'Rates are now %/year so a season and a career compare, and each swimmer is scored against the median for their own age band rather than against the whole club.',
   'Dr Boit', '9b71680', '2026-09-18'],
  ['shipped', 'Stats agree across pages, and the top ten follows the timeframe',
   'Selecting 2026 used to give 13 rated on one page and 93 on another. One scope now, stated on every figure, and the leaderboards change with the period.',
   'Dr Boit', '31a2bd8', '2026-09-18'],
  ['shipped', 'A departed swimmer keeps her records and leaves the analytics',
   'Wakhu, Emunah confirmed departed. All 17 of her races stay in the archive; she is out of the club figures, the groups and the meet drill-downs.',
   'Dr Boit', '31a2bd8', '2026-09-18'],
  ['shipped', 'Plausibility guard on every published number',
   'A check that refuses to publish data containing an impossible value. It found a PB rate of 429%, two galas loaded twice, age bands that did not total the roster, and meet cards disagreeing with their own drill-downs.',
   'Felix', 'a96c999', '2026-09-18'],
  ['shipped', 'This board, and notes from any page',
   'Somewhere to see what has shipped and what is coming, and a note button on every page that sends feedback with the page attached.',
   'Dr Boit', 'e85941a', '2026-09-18'],
];

const OUTSTANDING = [
  ['building', 'Filters on every page — age, stroke, event, gender',
   'Boit asked for this twice: the filters should not be confined to the Swimmers page, and should include stroke and event as well as age and gender. Needs the per-swim table, which ships all 5,578 swims at about 31 KB — smaller than the current payload, so this makes the app lighter rather than heavier.',
   'Dr Boit', null, null],
  ['planned', 'Coaching assistant',
   'Ask questions of the data in plain English. Blocked on the consent drive: the document now discloses that this sends data to OpenAI outside Kenya, and a child whose guardians have not accepted is never included. 0 of 189 cleared so far.',
   'Dr Boit', null, null],
  ['planned', 'Consent drive',
   '189 swimmers, 24 with a guardian attached. Until that closes most families cannot see their own child, and the assistant has almost nobody it may look at.',
   'Felix', null, null],
  ['idea', 'Confirm the reconstructed meet titles',
   'The timing software cuts meet names at 30 characters. 34 titles are reconstructions; data/meet_names.csv is one pass to confirm or correct them.',
   'Felix', null, null],
];

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
await c.connect();

// Replace the stale seed rather than duplicating it.
const { rows: existing } = await c.query('select id::text, title from public.roadmap_items');
const byTitle = new Map(existing.map(r => [r.title, r.id]));

let added = 0, updated = 0, order = 0;
for (const [status, title, detail, raised, sha, on] of [...OUTSTANDING, ...ITEMS]) {
  const id = byTitle.get(title);
  if (id) {
    await c.query(
      `update public.roadmap_items
          set detail=$2, status=$3::roadmap_status, raised_by=$4, commit_sha=$5,
              shipped_at=$6::timestamptz, sort_order=$7, updated_at=now()
        where id=$1::uuid`,
      [id, detail, status, raised, sha, on, order++]);
    updated++;
  } else {
    await c.query(
      `insert into public.roadmap_items
         (title, detail, status, raised_by, created_by, commit_sha, shipped_at, sort_order)
       values ($1,$2,$3::roadmap_status,$4,'Felix',$5,$6::timestamptz,$7)`,
      [title, detail, status, raised, sha, on, order++]);
    added++;
  }
}

// Anything from the first seed we have superseded, out of the way.
const keep = new Set([...OUTSTANDING, ...ITEMS].map(x => x[1]));
const stale = existing.filter(r => !keep.has(r.title));
for (const r of stale) {
  await c.query(`delete from public.roadmap_items where id=$1::uuid`, [r.id]);
}
console.log(`roadmap: ${added} added, ${updated} updated, ${stale.length} superseded rows removed`);
await c.end();
