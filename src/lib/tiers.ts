// What each kind of viewer is allowed to know about a swimmer.
//
// Two tiers, agreed with the club:
//
//   tier1  The competition record. Name, age group, the results of meets that
//          were already published by their organisers, and neutral arithmetic
//          on those results — personal bests, podium counts, "22.7% faster".
//          Visible to anyone in the NextGen community who has been confirmed as
//          the guardian of a NextGen swimmer, the way SwimCloud and Meet Mobile
//          work.
//
//   tier2  The assessment. How NextGen judges a swimmer's development — the
//          Review label, per-stroke bands, consistency, what to work on. This
//          is data the club CREATED about a child; no federation published it
//          and no entry form consented to it. Visible to coaches and to that
//          child's own guardians, and never in bulk.
//
//   coach  Internal. Roster status, and which other clubs a child has raced
//          for — factually public, but socially loaded in a club this size.
//
// THE POINT OF THIS FILE: the tier-1 payload is built by OMITTING tier2 and
// coach fields, never by hand-picking tier-1 ones. Combined with the test in
// tiers.test.ts — which fails if any field in the analytics output is not
// classified here — adding a new metric to analytics.py cannot silently ship it
// to parents. Someone has to come here and decide what it is.

export const SWIMMER_FIELDS = {
  tier1: [
    "name",
    "age",
    "band", // age group, e.g. "15-17" — never a date of birth
    "sex",
    "seasons",
    "swims",
    "pbs",
    "podiums",
    "wins",
    "meets",
    "trend", // improvement rate, %/year: arithmetic on published times
    "trendTotal", // total % change over the window, same arithmetic
    "rateSeries", // how many event-series the rate was taken across
    "rateRaces", //  and how many races those hold. Counts of published swims,
    //               shown so a figure resting on two races reads as one.
    "ageNorm", // the median rate for that age band — a club aggregate, names nobody
    "ageAdj", // their rate minus that norm. Still arithmetic on tier-1 numbers;
    //           what stays tier 2 is `cls`, the verdict NextGen draws from it.
    "joined", // the date they joined NextGen. Marks which part of a chart is
    //           ours — a career baseline is misleading without it.
    "pbRate",
    "pbEligible", // how many swims the PB rate was out of. A percentage with no
    //               denominator was read as wrong, because 13/21 is not 68%.
    "normOwn", //    whether the age-band norm came from that band or from the
    "normN", //      club median, and how many swimmers it rests on.
    "events", // per event: course, first/last time and date, swim count
  ],
  tier2: [
    "cls", // fast / improving / stable / review — the label
    "consBand",
    "consistency",
    "focus", // a coaching recommendation
    "strokes", // per-stroke label, e.g. { Back: "fast" }
    "dists", // per-distance label
    "t3",
    "t6", // recent form
    "nocompare",
  ],
  coach: [
    "status", // current / former on the roster
    "offclub", // other clubs raced for
  ],
} as const;

// Fields inside each entry of a swimmer's `events` array. All tier 1: these are
// published race times and the percentage between two of them.
export const EVENT_FIELDS = [
  "event",
  "course",
  "pct",
  "first",
  "last",
  "firstDate",
  "lastDate",
  "swims",
  "rate", // this event's improvement in %/year
  // The race series behind the trend chart: one {d, t} per swim, plus pb on
  // the fastest. Tier 1 for the same reason first/last are — these are times
  // the organisers published and the entry form consented to. The judgement
  // OF the series (cls, focus, the trend bands) stays tier 2.
  "points",
] as const;

// Year-level blocks. These are club aggregates — medians, counts per age band,
// meet summaries — and name nobody, so the community may see them.
export const YEAR_BLOCKS = {
  tier1: [
    "meets",
    "summary",
    "strokes",
    "dists",
    "ages",
    "ageYears",
    "alerts",
    "comps",
    "sexes",
  ],
  coach: [
    "watch", // lists of named swimmers to look at — assessment, and cross-child
    "bands", // where the band cut-lines sit, and the age-band norms behind them.
    //          Coach-only on purpose: a parent gets the measurements (trend,
    //          ageNorm, ageAdj) but not the machinery that turns them into a
    //          verdict, which is what keeps `cls` genuinely tier 2.
  ],
} as const;

// Blocks at the top of the payload, outside `years`. These are not filtered
// per-scope, so anything listed here must name nobody and carry no assessment
// of anybody. `bandSeasons` qualifies: medians and head-counts per age band
// per season, the same class of figure as `ages`.
//
// The list is enforced two ways — a test fails when the pipeline emits a key
// that is not here, and shapeAnalytics keeps only these, so a new block has to
// be classified deliberately before any viewer can receive it.
export const TOP_LEVEL = {
  tier1: ["generated", "thresholds", "bandSeasons", "years"],
  // Carries a list of swimmer names, so unlike the rest of the top level it
  // cannot pass through untouched: `pending` gets the block with the names
  // emptied, which leaves the meets and the per-swim columns intact but
  // unattributable.
  named: ["meetSwims"],
} as const;

export type Scope =
  | "coach" // coordinator or coach: everything
  | "community" // guardian of a confirmed NextGen swimmer: tier 1 for everyone
  | "pending"; // signed in, no confirmed child yet: aggregates only, no names

const set = (xs: readonly string[]) => new Set<string>(xs);
const SW_TIER1 = set(SWIMMER_FIELDS.tier1);
const YR_TIER1 = set(YEAR_BLOCKS.tier1);
const TOP_TIER1 = set([...TOP_LEVEL.tier1, ...TOP_LEVEL.named]);

type Rec = Record<string, unknown>;

/** Keep only the listed keys. Omission is the mechanism — see the note above. */
function pick(o: Rec, keep: Set<string>): Rec {
  const out: Rec = {};
  for (const k of Object.keys(o)) if (keep.has(k)) out[k] = o[k];
  return out;
}

/**
 * Shape the analytics payload for a viewer.
 *
 * `community` gets every swimmer by name with their competition record, and no
 * assessment of anyone — including their own child, whose assessment is fetched
 * per-child from its own endpoint so that no bulk route can ever carry it.
 *
 * `pending` gets the club aggregates with the swimmer list emptied, so someone
 * who has signed up but has not yet been confirmed as a guardian sees the shape
 * of the club without a single child's name.
 */
export function shapeAnalytics(data: Rec, scope: Scope): Rec {
  if (scope === "coach") return { ...data, scope };

  const years = data.years as Record<string, Rec>;
  const shaped: Record<string, Rec> = {};

  for (const [year, block] of Object.entries(years)) {
    const kept = pick(block, YR_TIER1);

    if (scope === "community") {
      const swimmers = (block.swimmers as Rec[] | undefined) ?? [];
      kept.swimmers = swimmers.map((s) => pick(s, SW_TIER1));
    } else {
      kept.swimmers = [];
    }
    kept.watch = {}; // coach-only, and cross-child: never leaves the server

    shaped[year] = kept;
  }

  // Picked, not spread: a top-level block nobody has classified is dropped
  // here rather than forwarded to a parent by default.
  const top = pick(data, TOP_TIER1);
  if (scope === "pending") {
    for (const k of TOP_LEVEL.named) {
      const b = top[k] as Rec | undefined;
      if (b && Array.isArray(b.swimmers)) top[k] = { ...b, swimmers: [] };
    }
  }
  return { ...top, scope, years: shaped };
}

/**
 * One swimmer's assessment, for a caller already authorised to see it.
 *
 * Deliberately takes a single analytics name and returns a single record. There
 * is no variant of this that returns many: if the authorisation check above it
 * were ever wrong, the worst case is one child rather than the whole club.
 */
export function assessmentFor(data: Rec, analyticsName: string): Rec | null {
  const all = (data.years as Record<string, Rec>)?.all;
  const swimmers = (all?.swimmers as Rec[] | undefined) ?? [];
  const found = swimmers.find((s) => s.name === analyticsName);
  if (!found) return null;

  const keep = set([...SWIMMER_FIELDS.tier2, "name"]);
  return pick(found, keep);
}
