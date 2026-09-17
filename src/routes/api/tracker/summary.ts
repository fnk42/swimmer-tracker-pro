import { createFileRoute } from "@tanstack/react-router";
import data from "../../../tracker/data.json";
import progress from "../../../tracker/progress.json";

// What the signed-out landing page is allowed to know.
//
// Two kinds of thing, both safe for a visitor with no account:
//
//   counts     meets, swims, swimmers, podiums, PBs, per-season totals. No
//              individual anything, and already public on the club's SwimCloud
//              page.
//   progress   six athletes' times in one event, named "Sophia S." — first name
//              and surname initial only, built by tools/progress.py. Enough to
//              show the programme works; not enough to identify a child to a
//              stranger who has the link.
//
// Ages, full names, development labels and every other swimmer stay behind
// /api/tracker/data and a session.
const all = data.years.all.summary;
const seasons = Object.keys(data.years)
  .filter((y) => y !== "all")
  .sort();

const summary = {
  // Progression series for the landing page. Named "Sophia S.", never in full:
  // this is served to signed-out visitors, so no child is fully identified to
  // someone who has not signed in. Full names live behind /api/tracker/data.
  progress,
  perSeason: seasons.map((y) => ({
    year: y,
    meets: data.years[y as keyof typeof data.years].summary.meets,
    swims: data.years[y as keyof typeof data.years].summary.swims,
  })),
  meets: all.meets,
  swimmers: all.swimmers,
  swims: all.swims,
  podiums: all.podiums,
  wins: all.wins,
  pbs: all.pbs,
  series: data.thresholds.n,
  seasons: seasons.length,
  from: seasons[0],
  to: seasons[seasons.length - 1],
  generated: data.generated,
};

export const Route = createFileRoute("/api/tracker/summary")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify(summary), {
          headers: {
            "content-type": "application/json",
            "cache-control": "public, max-age=3600",
          },
        }),
    },
  },
});
