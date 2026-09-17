import { createFileRoute } from "@tanstack/react-router";
import { sessionFromRequest } from "@/lib/session";
import { json } from "@/lib/db";
import data from "../../../tracker/data.json";

// Swim performance for every NextGen athlete, 2022–2026.
//
// Two scopes, decided from the session and never from anything the browser
// sends:
//
//   club    coordinators — the whole record, every swimmer named.
//   family  parents — the club-wide picture, which is aggregate throughout
//           (percentages, medians, counts per age band, meet-level form), with
//           every field that names an individual removed.
//
// The fields that name people are `swimmers` (all 191, each with age, times and
// a development label) and `watch` (the "swimmers to look at" lists).
// Everything else — summary, strokes, dists, ages, ageYears, alerts, comps,
// sexes, meets — carries no name and is safe for a parent to see.
//
// A parent seeing another family's child flagged "Review" is the thing this
// guards against, so the filtering happens here: the restricted data never
// reaches the browser at all, rather than being hidden by the page.

type YearBlock = Record<string, unknown>;

const familyYears = Object.fromEntries(
  Object.entries(data.years as Record<string, YearBlock>).map(([year, block]) => {
    const { swimmers: _named, watch: _lists, ...aggregate } = block;
    return [year, { ...aggregate, swimmers: [], watch: {} }];
  }),
);

const clubData = JSON.stringify({ ...data, scope: "club" });
const familyData = JSON.stringify({ ...data, scope: "family", years: familyYears });

export const Route = createFileRoute("/api/tracker/data")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const s = sessionFromRequest(request);
        if (!s) return json({ error: "Not signed in" }, 401);

        return new Response(s.isAdmin ? clubData : familyData, {
          headers: {
            "content-type": "application/json",
            "cache-control": "private, max-age=300",
          },
        });
      },
    },
  },
});
