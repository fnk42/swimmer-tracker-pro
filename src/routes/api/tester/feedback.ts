import { createFileRoute } from "@tanstack/react-router";
import { one, q, json, fail } from "@/lib/db";
import { sessionFromRequest } from "@/lib/session";
import { note } from "@/lib/activity";

// The shared board.
//
// Separate from item_comments and page_notes, which are the coordinators' own
// roadmap: testers have no business in Boit's working notes and he should not
// have to wade through theirs.
//
// Everyone testing reads every item, with names on it. That is deliberate — it
// stops five people filing the same bug, and a name against a comment keeps it
// civil. Coordinators read it too, and are the only ones who can set a status
// or reply.

type Row = {
  id: string; author: string; kind: string; body: string; route: string;
  context: string; status: string; reply: string | null; replied_by: string | null;
  created_at: string; agrees: number; mine: boolean;
};

const KINDS = ["broken", "confusing", "idea"];
const STATUSES = ["open", "seen", "fixed", "wontfix"];

export const Route = createFileRoute("/api/tester/feedback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.testerId && !s?.isAdmin) return json({ error: "Not signed in" }, 401);
          const rows = await q<Row>(
            `select f.id::text, f.author, f.kind, f.body, f.route, f.context,
                    f.status, f.reply, f.replied_by, f.created_at,
                    (select count(*)::int from public.tester_feedback_agrees a
                      where a.feedback_id = f.id) as agrees,
                    exists (select 1 from public.tester_feedback_agrees a
                             where a.feedback_id = f.id and a.tester_id = $1) as mine
               from public.tester_feedback f
              order by f.created_at desc
              limit 200`,
            [s.testerId ?? null],
          );
          return json({ rows, canModerate: !!s.isAdmin });
        } catch (err) {
          return fail("GET /api/tester/feedback", err, "Could not load the feedback board");
        }
      },

      POST: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.testerId) return json({ error: "Testers only" }, 403);
          const b = await request.json().catch(() => ({}));
          const body = String(b?.body ?? "").trim();
          const kind = String(b?.kind ?? "broken");
          if (body.length < 4) return json({ error: "Tell us a little more" }, 400);
          if (!KINDS.includes(kind)) return json({ error: "Unknown kind" }, 400);

          const who = await one<{ full_name: string }>(
            `select full_name from public.testers where id = $1`,
            [s.testerId],
          );
          const row = await one<{ id: string }>(
            `insert into public.tester_feedback
               (tester_id, author, kind, body, route, context)
             values ($1, $2, $3, $4, $5, $6) returning id::text`,
            [
              s.testerId,
              who?.full_name || s.email,
              kind,
              body.slice(0, 4000),
              String(b?.route ?? "").slice(0, 200),
              String(b?.context ?? "").slice(0, 500),
            ],
          );
          await note("tester_feedback", { email: s.email, detail: `${kind} — ${body.slice(0, 80)}` });
          return json({ ok: true, id: row?.id });
        } catch (err) {
          return fail("POST /api/tester/feedback", err, "Could not post that");
        }
      },

      // "Me too" from a tester; a status or a reply from a coordinator.
      PATCH: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.testerId && !s?.isAdmin) return json({ error: "Not signed in" }, 401);
          const b = await request.json().catch(() => ({}));
          const id = String(b?.id ?? "");
          if (!id) return json({ error: "id required" }, 400);

          if (b?.agree !== undefined && s.testerId) {
            if (b.agree) {
              await q(
                `insert into public.tester_feedback_agrees (feedback_id, tester_id)
                 values ($1::uuid, $2) on conflict do nothing`,
                [id, s.testerId],
              );
            } else {
              await q(
                `delete from public.tester_feedback_agrees
                  where feedback_id = $1::uuid and tester_id = $2`,
                [id, s.testerId],
              );
            }
            return json({ ok: true });
          }

          if (!s.isAdmin) return json({ error: "Admins only" }, 403);
          const status = String(b?.status ?? "");
          const raw = b?.reply === undefined ? null : String(b.reply).trim().slice(0, 2000);
          // An empty string clears a reply; undefined leaves it alone.
          const reply = raw === null ? null : raw;
          if (status && !STATUSES.includes(status)) return json({ error: "Unknown status" }, 400);

          // Signed with the name the testers know, not the address. The reply
          // is shown to every tester on the board, so it should read as a
          // person answering rather than a mailbox.
          const me = await one<{ full_name: string }>(
            `select coalesce(nullif(p.full_name, ''), '') as full_name
               from public.parent_emails pm
               join public.parents p on p.id = pm.parent_id
              where pm.email = lower($1)`,
            [s.email],
          );
          const signedAs = me?.full_name || s.email;

          await q(
            `update public.tester_feedback
                set status = coalesce(nullif($2::text,''), status),
                    -- Cast explicitly: $3 appears only inside CASE branches
                    -- beside NULL, so Postgres has nothing to infer a type
                    -- from and refuses the statement outright.
                    reply = case when $3::text is null then reply
                                 when $3::text = '' then null else $3::text end,
                    replied_by = case when $3::text is null then replied_by
                                      when $3::text = '' then null else $4::text end,
                    replied_at = case when $3::text is null then replied_at
                                      when $3::text = '' then null else now() end
              where id = $1::uuid`,
            [id, status, reply, signedAs],
          );
          // A reply without a status set is an answer, which is at least "seen".
          if (reply && !status) {
            await q(
              `update public.tester_feedback set status = 'seen'
                where id = $1::uuid and status = 'open'`,
              [id],
            );
          }
          return json({ ok: true });
        } catch (err) {
          return fail("PATCH /api/tester/feedback", err, "Could not update that");
        }
      },
    },
  },
});
