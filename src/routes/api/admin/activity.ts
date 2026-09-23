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

          // Resolve a name three ways, best first.
          //
          // parent_id is the surest, but most rows have none: a code request
          // happens before anyone is signed in, so nothing links it to a row
          // except the address. Falling back to the address catches those, and
          // catches a parent who has since signed in from a second email,
          // because parent_emails maps every address they use onto one record.
          // Testers keep their names in their own table.
          const rows = await q<Row>(
            `select a.id::text, a.kind, a.email, a.detail, a.ok, a.created_at,
                    coalesce(
                      nullif(p.full_name, ''),
                      nullif(pe.full_name, ''),
                      nullif(t.full_name, '')
                    ) as parent_name
               from public.activity a
               left join public.parents p on p.id = a.parent_id
               left join public.parent_emails pm on pm.email = lower(a.email)
               left join public.parents pe on pe.id = pm.parent_id
               left join public.testers t on lower(t.email) = lower(a.email)
              order by a.created_at desc
              limit 300`,
          );

          return json({ rows });
        } catch (err) {
          return json({ error: String(err) }, 500);
        }
      },
    },
  },
});
