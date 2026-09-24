import { createFileRoute } from "@tanstack/react-router";
import { one, q, json, fail } from "@/lib/db";
import { sessionFromRequest, adminEmails } from "@/lib/session";
import { sendSquadRequest } from "@/lib/mailer";
import { note } from "@/lib/activity";

// "My child is not in the Nationals team, but they should be."
//
// The club picks the team, so a parent cannot put a child in it. What they
// were getting instead was an amber line saying no, with nothing to do next —
// Nyawira signed in five times and would have hit exactly that. A parent who
// has done everything they can should be able to hand the question to a
// person, and be told that is what has happened.
export const Route = createFileRoute("/api/me/squad-request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.parentId) return json({ error: "Not signed in" }, 401);
          const b = await request.json().catch(() => ({}));
          const swimmerId = String(b?.swimmerId ?? "");
          const noteText = String(b?.note ?? "").trim().slice(0, 500);
          if (!swimmerId) return json({ error: "swimmerId required" }, 400);

          // Theirs, and only theirs.
          const ctx = await one<{
            swimmer: string; age: number | null; in_squad: boolean;
            parent_name: string; parent_phone: string;
          }>(
            `select sw.name as swimmer, sw.age,
                    (sw.event_squad or sw.id in (select swimmer_id from public.registrations))
                      as in_squad,
                    coalesce(nullif(p.full_name,''), p.email, 'A parent') as parent_name,
                    coalesce(p.phone,'') as parent_phone
               from public.swimmers sw
               join public.swimmer_parents sp
                 on sp.swimmer_id = sw.id and sp.parent_id = $2
               join public.parents p on p.id = $2
              where sw.id = $1`,
            [swimmerId, s.parentId],
          );
          if (!ctx) return json({ error: "That swimmer is not on your account" }, 403);
          if (ctx.in_squad) return json({ ok: true, alreadyIn: true });

          // One open request per child per parent — asking twice is the same ask.
          const already = await one<{ id: string }>(
            `select id from public.athlete_claim_requests
              where parent_id = $1 and swimmer_id = $2 and status = 'pending'`,
            [s.parentId, swimmerId],
          );
          if (!already) {
            await q(
              `insert into public.athlete_claim_requests
                 (parent_id, child_name, child_age, note, status, swimmer_id)
               values ($1, $2, $3, $4, 'pending', $5)`,
              [s.parentId, ctx.swimmer, ctx.age,
               noteText || "Asked to be added to the Nationals team", swimmerId],
            );
          }

          await note("swimmer_claimed", {
            email: s.email, parentId: s.parentId,
            detail: `${ctx.swimmer} — asked to join the Nationals team`,
          });

          // Tell the coordinators. A mail failure must not lose the request.
          try {
            await sendSquadRequest(adminEmails(), {
              parentName: ctx.parent_name, parentEmail: s.email,
              parentPhone: ctx.parent_phone, swimmer: ctx.swimmer, note: noteText,
            });
          } catch { /* the request stands either way */ }

          return json({ ok: true, swimmer: ctx.swimmer });
        } catch (err) {
          return fail("POST /api/me/squad-request", err, "Could not send that request");
        }
      },
    },
  },
});
