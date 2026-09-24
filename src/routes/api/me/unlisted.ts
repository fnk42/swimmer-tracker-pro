import { createFileRoute } from "@tanstack/react-router";
import { one, q, json, fail } from "@/lib/db";
import { sessionFromRequest } from "@/lib/session";
import { note } from "@/lib/activity";

// "My child is not on the list."
//
// The roster is built from meet results, so a swimmer who has never raced for
// the club is genuinely absent from it. Making the children step compulsory
// without this would strand exactly the newest family — the one most likely to
// be registering for the first time.
//
// So the step cannot be left empty, but it can be answered two ways: pick the
// child, or tell us who they are. Either way the club learns the name, which
// is the whole point of asking.
export const Route = createFileRoute("/api/me/unlisted")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.parentId) return json({ error: "Not signed in" }, 401);
          const rows = await q<{ child_name: string; child_age: number | null; status: string }>(
            `select child_name, child_age, status from public.athlete_claim_requests
              where parent_id = $1 order by created_at desc`,
            [s.parentId],
          );
          return json({ rows });
        } catch (err) {
          return fail("GET /api/me/unlisted", err, "Could not read that");
        }
      },

      POST: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.parentId) return json({ error: "Not signed in" }, 401);
          const b = await request.json().catch(() => ({}));
          const name = String(b?.childName ?? "").trim();
          const ageRaw = Number(b?.childAge);
          const age = Number.isInteger(ageRaw) && ageRaw > 2 && ageRaw < 100 ? ageRaw : null;
          const noteText = String(b?.note ?? "").trim().slice(0, 500);

          if (name.length < 2) return json({ error: "Enter your child's name" }, 400);

          const row = await one<{ id: string }>(
            `insert into public.athlete_claim_requests
               (parent_id, child_name, child_age, note, status)
             values ($1, $2, $3, $4, 'pending')
             returning id::text`,
            [s.parentId, name, age, noteText],
          );
          await note("swimmer_claimed", {
            email: s.email, parentId: s.parentId,
            detail: `${name} — not on the roster, needs adding`,
          });
          return json({ ok: true, id: row?.id });
        } catch (err) {
          return fail("POST /api/me/unlisted", err, "Could not record that");
        }
      },
    },
  },
});
