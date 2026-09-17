import { createFileRoute } from "@tanstack/react-router";
import { json, fail } from "@/lib/db";
import { viewer } from "@/lib/scope";
import meets from "../../../tracker/meets_detail.json";

// One meet's results, event by event.
//
// Served one meet per request rather than bundled: all 61 together is about
// 600 KB, which is not something to hand every browser on a Nairobi mobile
// connection when they only ever want the meet they clicked.
//
// Meet results are tier 1 — the organisers published them, and the entry
// consented to it — so a confirmed guardian sees every swimmer by name. Two
// things are still withheld:
//
//   pending scope   names are stripped entirely. Someone who has signed up but
//                   has not been confirmed as a guardian gets the shape of the
//                   meet and none of the children in it.
//   `off`           which other club a swim was recorded under. Factually
//                   public, but "this child also races elsewhere" is loaded in
//                   a club this size, so it stays coach-only — the same call
//                   made for offclub in src/lib/tiers.ts.

type Row = Record<string, unknown>;
const ALL = meets as unknown as Record<string, Row>;

export const Route = createFileRoute("/api/meet/detail")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const v = await viewer(request);
          if (!v) return json({ error: "Not signed in" }, 401);
          if (v.needsProfile || v.needsConsent) {
            return json({ error: "Registration incomplete" }, 428);
          }

          const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
          if (!id) return json({ error: "id required" }, 400);

          const meet = ALL[id];
          if (!meet) return json({ error: "No such meet" }, 404);

          const events = (meet.events as Row[]).map((e) => ({
            ...e,
            rows: (e.rows as Row[]).map((r) => {
              const out: Row = { ...r };
              if (!v.isAdmin) delete out.off;
              if (v.scope === "pending") out.n = "A NextGen swimmer";
              return out;
            }),
          }));

          return new Response(JSON.stringify({ ...meet, events, scope: v.scope }), {
            headers: {
              "content-type": "application/json",
              "cache-control": "private, max-age=600",
            },
          });
        } catch (err) {
          return fail("GET /api/meet/detail", err, "Could not load that meet");
        }
      },
    },
  },
});
