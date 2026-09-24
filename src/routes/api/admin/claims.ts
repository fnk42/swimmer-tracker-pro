import { createFileRoute } from "@tanstack/react-router";
import { q, one, json, fail } from "@/lib/db";
import { requireAdmin, sessionFromRequest } from "@/lib/session";
import { normalizeKePhone } from "@/lib/phone";

// The coordinator's approval queue.
//
// A parent claiming a child proves nothing by claiming, so every self-made
// claim arrives pending and a coordinator decides. This route lists what is
// waiting, with the evidence needed to decide without ringing anyone:
//
//   match      does the claiming parent's phone or email appear on that
//              swimmer's own Machakos registration? If so the club already had
//              them down as the contact, and approving is a formality.
//   conflict   is another family already approved on this child? Two approved
//              adults is a household; a third, or a second household, is the
//              thing this queue exists to catch.
//
// Decisions are recorded with who made them and when, so "why does this parent
// have access" is answerable later.

type Row = {
  swimmer_id: string;
  parent_id: string;
  swimmer: string;
  age: number | null;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  relationship: string | null;
  claimed_at: string;
  reg_phones: string[] | null;
  reg_parents: string[] | null;
  other_approved: string[] | null;
};

const digits = (s: string) => (s || "").replace(/\D/g, "").slice(-9);

export const Route = createFileRoute("/api/admin/claims")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const denied = requireAdmin(request);
          if (denied) return denied;

          const rows = await q<Row>(
            `select sp.swimmer_id::text,
                    sp.parent_id::text,
                    sw.name              as swimmer,
                    sw.age,
                    coalesce(p.full_name,'')    as parent_name,
                    coalesce(p.email,'')        as parent_email,
                    coalesce(p.phone,'')        as parent_phone,
                    p.relationship,
                    sp.claimed_at,
                    array_remove(array[r.primary_phone, r.secondary_phone], null) as reg_phones,
                    array_remove(array[r.parent1_name, r.parent2_name], null)     as reg_parents,
                    (select array_agg(p2.full_name)
                       from public.swimmer_parents sp2
                       join public.parents p2 on p2.id = sp2.parent_id
                      where sp2.swimmer_id = sp.swimmer_id
                        and sp2.status = 'approved')                             as other_approved
               from public.swimmer_parents sp
               join public.swimmers sw on sw.id = sp.swimmer_id
               join public.parents  p  on p.id  = sp.parent_id
               left join public.registrations r on r.swimmer_id = sp.swimmer_id
              where sp.status = 'pending'
              order by sp.claimed_at`,
          );

          const claims = rows.map((r) => {
            const mine = digits(normalizeKePhone(r.parent_phone) || r.parent_phone);
            const phoneMatch =
              !!mine &&
              (r.reg_phones ?? []).some((p) => digits(normalizeKePhone(p) || p) === mine);
            // A loose name check as a second signal: the registration recorded
            // parent names as free text, so it is a hint, not a decision.
            const surname = (r.parent_name.split(/\s+/).pop() ?? "").toLowerCase();
            const nameMatch =
              surname.length > 2 &&
              (r.reg_parents ?? []).some((n) => (n || "").toLowerCase().includes(surname));

            const others = (r.other_approved ?? []).filter(Boolean);

            return {
              swimmerId: r.swimmer_id,
              parentId: r.parent_id,
              swimmer: r.swimmer,
              age: r.age,
              parentName: r.parent_name,
              parentEmail: r.parent_email,
              parentPhone: r.parent_phone,
              relationship: r.relationship,
              claimedAt: r.claimed_at,
              phoneMatch,
              nameMatch,
              approvedAlready: others,
              // Two approved adults is the limit, so a third claim needs a
              // human to decide who comes off.
              conflict: others.length >= 2,
            };
          });

          const unlisted = await q(
            `select acr.id::text, acr.child_name, acr.child_age, acr.note, acr.created_at,
                    coalesce(p.full_name,'') as parent_name,
                    coalesce(p.email,'')     as parent_email,
                    coalesce(p.phone,'')     as parent_phone
               from public.athlete_claim_requests acr
               join public.parents p on p.id = acr.parent_id
              where acr.status = 'pending'
              order by acr.created_at`,
          );

          return json({ claims, unlisted });
        } catch (err) {
          return fail("GET /api/admin/claims", err, "Could not load the queue");
        }
      },

      // Add a swimmer the roster did not have, and hand them to the parent
      // who asked for them.
      //
      // The queue could show these and do nothing about them, so a request
      // sat pending for ever and the parent was told to wait for something
      // nobody could action. One button now creates the swimmer, links the
      // parent who asked, and closes the request.
      PUT: async ({ request }) => {
        const denied = requireAdmin(request);
        if (denied) return denied;
        try {
          const s = sessionFromRequest(request);
          const b = await request.json().catch(() => ({}));
          const id = String(b?.id ?? "");
          if (!id) return json({ error: "id required" }, 400);

          if (b?.dismiss === true) {
            await q(
              `update public.athlete_claim_requests
                  set status = 'rejected', decided_at = now(), decided_by = $2
                where id = $1::uuid and status = 'pending'`,
              [id, s?.email ?? ""],
            );
            return json({ ok: true, dismissed: true });
          }

          const req = await one<{ parent_id: string; child_name: string; child_age: number | null }>(
            `select parent_id, child_name, child_age from public.athlete_claim_requests
              where id = $1::uuid and status = 'pending'`,
            [id],
          );
          if (!req) return json({ error: "That request is no longer waiting" }, 404);

          const name = String(b?.name ?? req.child_name).trim();
          if (name.length < 2) return json({ error: "Enter the swimmer's name" }, 400);

          // An existing swimmer of that name is used rather than duplicated —
          // the request usually means "not on the list", but sometimes it
          // means "I could not find them".
          const existing = await one<{ id: string }>(
            `select id from public.swimmers where lower(name) = lower($1) limit 1`,
            [name],
          );
          const sw = existing ?? await one<{ id: string }>(
            `insert into public.swimmers (name, age, event_squad)
             values ($1, $2, false) returning id`,
            [name, req.child_age],
          );
          if (!sw) return json({ error: "Could not add that swimmer" }, 500);

          await q(
            `insert into public.swimmer_parents
               (swimmer_id, parent_id, sort_order, status, decided_at, decided_by, decided_note)
             values ($1, $2, 1, 'approved', now(), $3, 'added from a parent request')
             on conflict do nothing`,
            [sw.id, req.parent_id, s?.email ?? ""],
          );
          await q(
            `update public.athlete_claim_requests
                set status = 'approved', decided_at = now(), decided_by = $2, swimmer_id = $3
              where id = $1::uuid`,
            [id, s?.email ?? "", sw.id],
          );
          return json({ ok: true, swimmerId: sw.id, created: !existing });
        } catch (err) {
          return fail("PUT /api/admin/claims", err, "Could not add that swimmer");
        }
      },

      // Approve or reject one claim.
      POST: async ({ request }) => {
        try {
          const denied = requireAdmin(request);
          if (denied) return denied;
          const s = sessionFromRequest(request);

          const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const swimmerId = String(b.swimmerId ?? "");
          const parentId = String(b.parentId ?? "");
          const decision = String(b.decision ?? "");
          const note = String(b.note ?? "").slice(0, 400) || null;

          if (!swimmerId || !parentId) return json({ error: "swimmerId and parentId required" }, 400);
          if (!["approved", "rejected"].includes(decision)) {
            return json({ error: "decision must be approved or rejected" }, 400);
          }

          if (decision === "approved") {
            const approved = await one<{ n: number }>(
              `select count(*)::int n from public.swimmer_parents
                where swimmer_id = $1 and status = 'approved' and parent_id <> $2`,
              [swimmerId, parentId],
            );
            if ((approved?.n ?? 0) >= 2) {
              return json(
                {
                  error:
                    "Two adults are already approved on that swimmer. Remove one before " +
                    "approving a third.",
                },
                409,
              );
            }
          }

          const row = await one(
            `update public.swimmer_parents
                set status = $3::claim_status,
                    decided_at = now(),
                    decided_by = $4,
                    decided_note = $5
              where swimmer_id = $1 and parent_id = $2 and status = 'pending'
              returning swimmer_id::text, parent_id::text, status::text`,
            [swimmerId, parentId, decision, s?.email ?? "unknown", note],
          );

          if (!row) return json({ error: "That claim is no longer pending" }, 409);
          return json(row);
        } catch (err) {
          return fail("POST /api/admin/claims", err, "Could not record that decision");
        }
      },
    },
  },
});
