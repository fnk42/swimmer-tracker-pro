import { createFileRoute } from "@tanstack/react-router";
import data from "../../../tracker/data.json";

// Headline counts for the performance.nextgenkenya.com landing page, which a
// signed-out visitor sees. Deliberately aggregates only — no name, no age, no
// time, no single swimmer's anything. Everything here is already derivable from
// the club's public SwimCloud page; the individual data stays behind
// /api/tracker/data and a coordinator session.
const all = data.years.all.summary;
const seasons = Object.keys(data.years)
  .filter((y) => y !== "all")
  .sort();

const summary = {
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
