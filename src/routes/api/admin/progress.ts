import { createFileRoute } from "@tanstack/react-router";
import { q, json, fail } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { inSquadSql } from "@/lib/squad";

// Where everybody has got to, on one request.
//
// The sign-in log answers "did anything happen", and the headcount answers
// "how much has come in". Neither answers the question a coordinator actually
// has on a registration weekend, which is who is stuck and at which step —
// and the worst case is invisible in both, because a parent who never reached
// the app leaves no trace at all. Kevin Kadede had an account, a phone number
// and a son in the team, and nothing in any log, because he never pressed the
// button. That is the case this exists to show.
export const Route = createFileRoute("/api/admin/progress")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = requireAdmin(request);
        if (denied) return denied;
        try {
          const machakos = await q(
            `select s.name,
                    coalesce(p.full_name, '')                        as parent_name,
                    coalesce(nullif(p.email, ''), pe.email, '')      as parent_email,
                    coalesce(p.phone, '')                            as parent_phone,
                    (sp.parent_id is not null)                       as has_parent,
                    (r.swimmer_id is not null)                       as entered,
                    coalesce(pay.total, 0)::float                    as paid,
                    coalesce(seen.n, 0)::int                         as sign_ins
               from public.swimmers s
               left join public.swimmer_parents sp
                      on sp.swimmer_id = s.id and sp.sort_order = 1
               left join public.parents p on p.id = sp.parent_id
               left join lateral (
                      select email from public.parent_emails
                       where parent_id = p.id order by email limit 1) pe on true
               left join public.registrations r on r.swimmer_id = s.id
               left join lateral (
                      select sum(amount) as total from public.payments
                       where swimmer_id = s.id) pay on true
               left join lateral (
                      select count(*) as n from public.activity a
                       where a.kind = 'signed_in'
                         and (a.parent_id = p.id
                              or lower(a.email) = lower(coalesce(p.email, '~')))) seen on true
              where ${inSquadSql("s")}
              order by s.name`,
          );

          const testers = await q(
            `select t.email,
                    t.full_name,
                    t.agreed_at is not null                          as agreed,
                    t.revoked_at is not null                         as revoked,
                    t.expires_at,
                    t.last_seen_at,
                    coalesce(seen.n, 0)::int                         as sign_ins
               from public.testers t
               left join lateral (
                      select count(*) as n from public.activity a
                       where a.kind = 'signed_in'
                         and lower(a.email) = lower(t.email)) seen on true
              order by t.full_name, t.email`,
          );

          return json({ machakos, testers });
        } catch (err) {
          return fail("GET /api/admin/progress", err, "Could not read progress");
        }
      },
    },
  },
});
