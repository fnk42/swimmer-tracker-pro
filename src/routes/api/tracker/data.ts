import { createFileRoute } from "@tanstack/react-router";
import { json, q } from "@/lib/db";
import { viewer, maySeeAnalytics } from "@/lib/scope";
import { shapeAnalytics } from "@/lib/tiers";
import data from "../../../tracker/data.json";

// Swim performance for every NextGen athlete, 2022–2026.
//
// Three shapes, decided from the session and the database, never from anything
// the browser sends. src/lib/tiers.ts holds the field manifest and explains the
// two tiers; this route's only job is to pick a scope and hand the payload to
// it.
//
//   coach      coordinators and coaches — the whole record
//   community  a confirmed guardian of a NextGen swimmer — every athlete by
//              name with their competition record, and nobody's assessment
//   pending    signed in, claim not yet approved — club aggregates, no names
//
// A guardian reads their own child's assessment from
// /api/athlete/assessment, one child per request, so no bulk route can carry
// an assessment even if the check above it were wrong.
export const Route = createFileRoute("/api/tracker/data")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const v = await viewer(request);
        if (!v) return json({ error: "Not signed in" }, 401);

        // The page checks this too, but a check in a page is a suggestion.
        if (!(await maySeeAnalytics(request))) {
          return json({ error: "The analytics are in preview", preview: true }, 403);
        }

        // What used to stand here was a 428 for anyone whose Machakos profile
        // was unfinished. Wycliffe signed the confidentiality agreement, was
        // shown the analytics, and then met "Could not load the data" — because
        // he had not filled in a form about a swimming trip. The preview turns
        // on the agreement; the trip is a different question, asked in a
        // different place.

        // "See it as a parent" (Felix, 19 Oct 2026): an admin may ask for
        // exactly what a parent receives, shaped by the same tiers, so what
        // they check is the real parent page and not an imitation of it.
        const asParent = v.isAdmin && new URL(request.url).searchParams.get("as") === "parent";
        const body = shapeAnalytics(
          data as unknown as Record<string, unknown>,
          asParent ? "community" : v.scope,
        );
        // Every child on the account, raced or not, for the Your swimmers
        // row: one added today with no results yet still belongs there, with
        // its × (Felix, Zoey Makena, 19 Oct 2026). Names and ids only, and
        // only the viewer's own children.
        const myChildren = v.parentId
          ? await q<{ id: string; name: string; analytics_name: string | null }>(
              `select sw.id, sw.name, sw.analytics_name
                 from public.swimmer_parents sp
                 join public.swimmers sw on sw.id = sp.swimmer_id
                where sp.parent_id = $1 and sp.status = 'approved'
                order by sw.name`,
              [v.parentId],
            )
          : [];
        return new Response(JSON.stringify({ ...body, myAthletes: v.myAthletes, myChildren }), {
          headers: {
            "content-type": "application/json",
            // Not kept by the browser: the payload carries the viewer's own
            // children, and a page reloaded after adding or removing one was
            // served the copy from before (Felix, Zoey Makena, 19 Oct 2026).
            "cache-control": "private, no-store",
          },
        });
      },
    },
  },
});
