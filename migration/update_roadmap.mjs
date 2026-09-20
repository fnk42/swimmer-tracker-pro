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
   'F. Njenga', '5088a6b', '2026-09-18'],
  ['shipped', 'Contact details in the footer',
   'Njenga, 0726 178 216, info@goldenpipitrecruiting.com, Fractional CTO services — the number and address are tap-to-call and tap-to-email.',
   'F. Njenga', '5088a6b', '2026-09-18'],
  ['shipped', 'A chart for each distance',
   'Every stroke a swimmer races at one distance and pool length now shares a set of axes — all their 50s on one chart — with the single-event view a tap away.',
   'F. Njenga', 'bf66f88', '2026-09-18'],
  ['shipped', 'Method page: how every number is made',
   'Ten sections explaining the rules behind the other pages, including that the groups are relative by construction and the bottom one can never be empty. Figures on it are computed live so it cannot drift from the code.',
   'F. Njenga', '33d7d8a', '2026-09-18'],
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
   'F. Njenga', 'a96c999', '2026-09-18'],
  ['shipped', 'One meet at a time, every race against a baseline you choose',
   'Pick a meet and see every race that day as its own column, measured against the swimmer\u2019s own previous best, their own average, or the median for their age. Sorted quickest-first against the baseline rather than by finishing position, because a swimmer can win a race and still be down on their own average. One badge, Personal best, meaning it is still the quickest they have ever gone in that event.',
   'Dr Boit', '0c1c1db', '2026-09-20'],
  ['shipped', 'Follow one swimmer, or two side by side',
   'A swimmer through their seasons, their meets or their strokes, with a second alongside. Each swimmer\u2019s racing window is drawn as a bar above the chart before any line, because two swimmers rarely start at the same time and a chart that lines up race one against race one hides it.',
   'Dr Boit', '53051d1', '2026-09-20'],
  ['shipped', 'Every line named, with what that swimmer actually did',
   'Names sit down the side of the chart as "W Makena" with their total change beside them, replacing a legend that ran to three lines and still left you matching colours. Strokes are filterable, and each chart states its own window and says in words that a falling line means a swimmer getting faster.',
   'Dr Boit', 'a558fd5', '2026-09-20'],
  ['shipped', 'Warnings as the filters move',
   'A selection can be valid and still not mean what it looks like. Choosing a thin slice, a single stroke or one sex now says so on the chart \u2014 including that filtering to girls changes what the "band median" line is the median of.',
   'F. Njenga', '53051d1', '2026-09-20'],
  ['shipped', 'Age bands held still across the seasons',
   'A race counts toward the band the swimmer was in ON THE DAY, not the band they are in today, so "our 11-12 group" can be compared with last year\u2019s 11-12 group rather than with its own younger self.',
   'F. Njenga', '40905cd', '2026-09-20'],
  ['shipped', 'A dashboard to interrogate, on the way in',
   'The landing page is now a dashboard. Filter by age band, sex and event; read three numbers off the same filtered pool the chart draws from; then ask the chart one of three questions — the club\u2019s shape by age band, up to eight swimmers\u2019 real times in one event, or every picked swimmer rebased to their own first swim so those racing different events still compare. Both line charts fall when a swimmer is getting quicker.',
   'F. Njenga', '3cf655c', '2026-09-20'],
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
   'F. Njenga', null, null],
  ['shipped', 'A swimmer who lapses twelve months goes dormant',
   'Club rule, set 20 September 2026. A swimmer with no NextGen race in twelve months is dormant: every one of their results is kept in full, and they stop counting toward club figures, the age bands and the development groups. It applies automatically from here on, measured against the club\u2019s most recent meet rather than the calendar, so the same data always rebuilds the same roster. A club-confirmed status still overrides it. First application moved 39 swimmers and took the roster from 190 to 151.',
   'Dr Boit', 'PENDING', '2026-09-20'],
  ['idea', 'Confirm the reconstructed meet titles',
   'The timing software cuts meet names at 30 characters. 34 titles are reconstructions; data/meet_names.csv is one pass to confirm or correct them.',
   'F. Njenga', null, null],
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
       values ($1,$2,$3::roadmap_status,$4,'F. Njenga',$5,$6::timestamptz,$7)`,
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
