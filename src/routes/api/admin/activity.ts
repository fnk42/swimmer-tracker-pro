import { createFileRoute } from "@tanstack/react-router";
import { q, json } from "@/lib/db";
import { sessionFromRequest } from "@/lib/session";

// Who is getting in, and who is not. Coordinators only.
//
// This is a list of parents' email addresses and what they tried to do, so it
// is gated on isAdmin rather than on scope — a guardian has no business
// reading it even about themselves, and certainly not about anybody else.

type Row = {
  id: string; kind: string; email: string | null; detail: string | null;
  ok: boolean; created_at: string; parent_name: string | null;
};

export const Route = createFileRoute("/api/admin/activity")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.email) return json({ error: "Not signed in" }, 401);
          if (!s.isAdmin) return json({ error: "Coordinators only" }, 403);

          const url = new URL(request.url);
          const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") ?? 7)));

          const rows = await q<Row>(
            `select a.id::text, a.kind, a.email, a.detail, a.ok, a.created_at,
                    p.full_name as parent_name
               from public.activity a
               left join public.parents p on p.id = a.parent_id
              where a.created_at > now() - ($1 || ' days')::interval
              order by a.created_at desc
              limit 400`,
            [String(days)],
          );

          // Counted server-side so the panel shows the true totals even when
          // the list itself is capped at 400.
          const totals = await q<{ kind: string; ok: boolean; n: number }>(
            `select kind, ok, count(*)::int n
               from public.activity
              where created_at > now() - ($1 || ' days')::interval
              group by kind, ok`,
            [String(days)],
          );
          const people = await q<{ n: number }>(
            `select count(distinct lower(email))::int n
               from public.activity
              where created_at > now() - ($1 || ' days')::interval and email is not null`,
            [String(days)],
          );
          // The gap that matters: asked for a code, never signed in.
          const stuck = await q<{ email: string; asked: string; tries: number }>(
            `select lower(a.email) as email,
                    max(a.created_at)::text as asked,
                    count(*)::int as tries
               from public.activity a
              where a.kind = 'code_requested'
                and a.created_at > now() - ($1 || ' days')::interval
                and a.email is not null
                and not exists (
                  select 1 from public.activity b
                   where b.kind = 'signed_in'
                     and lower(b.email) = lower(a.email)
                     and b.created_at >= a.created_at)
              group by lower(a.email)
              order by max(a.created_at) desc
              limit 40`,
            [String(days)],
          );

          return json({ days, rows, totals, people: people[0]?.n ?? 0, stuck });
        } catch (err) {
          return json({ error: String(err) }, 500);
        }
      },
    },
  },
});
