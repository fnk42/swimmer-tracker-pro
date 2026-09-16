import { createFileRoute } from "@tanstack/react-router";
import { q, one, json, fail } from "@/lib/db";
import { sessionFromRequest } from "@/lib/session";

// Everything a signed-in parent is allowed to see, in one round trip.
//
// Every query below is filtered by the parent id taken from the SESSION, never
// from anything the caller sent. A parent cannot ask for another parent's data
// because there is no parameter in which to ask for it.
export const Route = createFileRoute("/api/me/data")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.parentId) return json({ error: "Not signed in" }, 401);
          const pid = s.parentId;

          const [parent, swimmers, links, registrations, payments] = await Promise.all([
            one(`select id, full_name, gender, phone, staying_overnight, email,
                        created_at, updated_at
                 from public.parents where id = $1`, [pid]),
            q(`select s.* from public.swimmers s
               join public.swimmer_parents sp on sp.swimmer_id = s.id
               where sp.parent_id = $1 order by s.name`, [pid]),
            q(`select * from public.swimmer_parents where parent_id = $1`, [pid]),
            q(`select r.* from public.registrations r
               join public.swimmer_parents sp on sp.swimmer_id = r.swimmer_id
               where sp.parent_id = $1`, [pid]),
            q(`select p.* from public.payments p
               join public.swimmer_parents sp on sp.swimmer_id = p.swimmer_id
               where sp.parent_id = $1 order by p.created_at desc`, [pid]),
          ]);

          return json({ parent, swimmers, links, registrations, payments });
        } catch (err) {
          return fail("GET /api/me/data", err, "Could not load your details");
        }
      },
    },
  },
});
