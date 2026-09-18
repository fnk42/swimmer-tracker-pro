import { createFileRoute } from "@tanstack/react-router";
import { q, json, fail } from "@/lib/db";
import { viewer } from "@/lib/scope";
import { CONSENT_VERSION, CONSENT_DOCUMENT } from "@/lib/consent-version";

// The roadmap board.
//
// Coaches and coordinators only. Parents never see it — half-formed ideas and
// internal ordering are not something to publish to families — but they can
// still send a note from any page, which lands in page_notes.
//
// A shipped item carries the commit it went out in. That is deliberate: a board
// that can claim "shipped" without a commit behind it drifts from what is
// actually deployed, and then nobody trusts it.

type Item = {
  id: string; title: string; detail: string | null; status: string;
  raised_by: string | null; created_at: string; shipped_at: string | null;
  commit_sha: string | null; sort_order: number; comments: number;
};

const STATUSES = ["idea", "planned", "building", "shipped", "parked"] as const;

export const Route = createFileRoute("/api/roadmap")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const v = await viewer(request);
          if (!v) return json({ error: "Not signed in" }, 401);
          if (v.scope !== "coach") return json({ error: "Coordinators only" }, 403);

          const items = await q<Item>(
            `select i.id::text, i.title, i.detail, i.status::text, i.raised_by,
                    i.created_at, i.shipped_at, i.commit_sha, i.sort_order,
                    (select count(*)::int from public.item_comments c where c.item_id = i.id) comments
               from public.roadmap_items i
              order by array_position($1::text[], i.status::text), i.sort_order, i.created_at`,
            [["building", "planned", "idea", "shipped", "parked"]],
          );
          const notes = await q(
            `select id::text, route, body, author, is_coach, created_at
               from public.page_notes
              where resolved_at is null
              order by created_at desc limit 50`,
          );
          // How far the consent drive has got, which is exactly how much the
          // coaching assistant would be allowed to see.
          //
          // A child counts only when EVERY approved guardian has accepted the
          // current document and none has opted out. Strict on purpose: this
          // is children's data going to a third party outside Kenya, and one
          // guardian's agreement does not speak for the other's.
          const [cov] = await q<{ total: number; with_guardian: number; eligible: number }>(
            `with g as (
               select sp.swimmer_id,
                      count(*) filter (where sp.status = 'approved') guardians,
                      count(*) filter (where sp.status = 'approved' and c.id is not null) consented,
                      count(*) filter (where sp.status = 'approved' and c.ai_opt_out) opted_out
                 from public.swimmer_parents sp
                 left join public.consents c
                        on c.parent_id = sp.parent_id
                       and c.document = $2 and c.version = $1
                       and c.withdrawn_at is null
                group by sp.swimmer_id
             )
             select (select count(*)::int from public.swimmers) total,
                    (select count(*)::int from g where guardians > 0) with_guardian,
                    (select count(*)::int from g
                      where guardians > 0 and consented = guardians and opted_out = 0) eligible`,
            [CONSENT_VERSION, CONSENT_DOCUMENT],
          );

          return json({ items, notes, aiCoverage: { ...cov, version: CONSENT_VERSION } });
        } catch (err) {
          return fail("GET /api/roadmap", err, "Could not load the roadmap");
        }
      },

      POST: async ({ request }) => {
        try {
          const v = await viewer(request);
          if (!v || v.scope !== "coach") return json({ error: "Coordinators only" }, 403);
          const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const title = String(b.title ?? "").trim();
          if (!title) return json({ error: "An idea needs a title" }, 400);
          const status = STATUSES.includes(String(b.status) as typeof STATUSES[number])
            ? String(b.status) : "idea";
          const rows = await q<{ id: string }>(
            `insert into public.roadmap_items (title, detail, status, raised_by, created_by, sort_order)
             values ($1, nullif($2,''), $3::roadmap_status, $4, $5,
                     coalesce((select max(sort_order)+1 from public.roadmap_items), 0))
             returning id::text`,
            [title, String(b.detail ?? "").trim(), status,
             String(b.raised_by ?? "").trim() || v.email, v.email],
          );
          return json({ ok: true, id: rows[0].id });
        } catch (err) {
          return fail("POST /api/roadmap", err, "Could not add that");
        }
      },

      PATCH: async ({ request }) => {
        try {
          const v = await viewer(request);
          if (!v || v.scope !== "coach") return json({ error: "Coordinators only" }, 403);
          const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const id = String(b.id ?? "");
          const status = String(b.status ?? "");
          if (!id || !STATUSES.includes(status as typeof STATUSES[number])) {
            return json({ error: "Unknown item or status" }, 400);
          }
          // Ticking something off here records the moment, not a commit: only
          // the seed script and a deploy can attach a real sha.
          await q(
            `update public.roadmap_items
                set status = $2::roadmap_status,
                    shipped_at = case when $2 = 'shipped' then coalesce(shipped_at, now()) else null end,
                    updated_at = now()
              where id = $1::uuid`,
            [id, status],
          );
          return json({ ok: true });
        } catch (err) {
          return fail("PATCH /api/roadmap", err, "Could not update that");
        }
      },
    },
  },
});
