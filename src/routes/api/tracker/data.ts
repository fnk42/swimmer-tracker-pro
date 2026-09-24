import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/db";
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

        // Registration is not finished; the client sends them back to finish it
        // rather than showing a half-entitled dashboard.
        if (v.needsProfile || v.needsConsent) {
          return json(
            {
              error: "Registration incomplete",
              needsProfile: v.needsProfile,
              needsConsent: v.needsConsent,
            },
            428, // Precondition Required
          );
        }

        // The page checks this too, but a check in a page is a suggestion.
        if (!(await maySeeAnalytics(request))) {
          return json({ error: "The analytics are in preview", preview: true }, 403);
        }

        const body = shapeAnalytics(data as unknown as Record<string, unknown>, v.scope);
        return new Response(JSON.stringify({ ...body, myAthletes: v.myAthletes }), {
          headers: {
            "content-type": "application/json",
            "cache-control": "private, max-age=300",
          },
        });
      },
    },
  },
});
