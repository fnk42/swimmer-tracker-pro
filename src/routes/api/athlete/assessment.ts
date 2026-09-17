import { createFileRoute } from "@tanstack/react-router";
import { q, json, fail } from "@/lib/db";
import { maySeeAssessment, viewer } from "@/lib/scope";
import { assessmentFor } from "@/lib/tiers";
import data from "../../../tracker/data.json";

// One swimmer's coaching assessment — tier 2.
//
// This is the data NextGen CREATED about a child: how they are developing, what
// to work on, whether they need review. No federation published it and no meet
// entry consented to it, so it goes only to the coaches and to that child's own
// guardians.
//
// Deliberately one athlete per request. There is no endpoint that returns many
// assessments, so the worst case if the check below were ever wrong is a single
// child rather than the whole club.
//
// Reads are logged. "Who has looked at my child's assessment?" should be a
// question the club can answer.
export const Route = createFileRoute("/api/athlete/assessment")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const v = await viewer(request);
          if (!v) return json({ error: "Not signed in" }, 401);

          const name = new URL(request.url).searchParams.get("name")?.trim() ?? "";
          if (!name) return json({ error: "name required" }, 400);

          if (!maySeeAssessment(v, name)) {
            // The same answer whether or not the athlete exists, so this cannot
            // be used to discover who swims for the club.
            return json(
              {
                error:
                  "Coaching assessments are shown to the coaches and to that " +
                  "swimmer's own parents or guardians.",
              },
              403,
            );
          }

          const body = assessmentFor(data as unknown as Record<string, unknown>, name);
          if (!body) return json({ error: "No assessment on record" }, 404);

          await q(
            `insert into public.assessment_views (viewer_email, analytics_name)
             values ($1, $2)`,
            [v.email, name],
          ).catch(() => {
            // A failed audit write must not deny a guardian their own child's
            // data; it is logged by fail() elsewhere and is not load-bearing.
          });

          return new Response(JSON.stringify(body), {
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        } catch (err) {
          return fail("GET /api/athlete/assessment", err, "Could not load that assessment");
        }
      },
    },
  },
});
