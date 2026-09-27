import { createFileRoute } from "@tanstack/react-router";
import { q, one, json, fail } from "@/lib/db";
import { sessionFromRequest, requireAdmin } from "@/lib/session";
import { note } from "@/lib/activity";

// Who is on which child, and the power to take a wrong one off.
//
// A claim is live the moment a parent makes it, and the notice email says "if
// this one is wrong, remove it" — which, until now, only the parent who made it
// could do. Any swimmer, not only the Machakos team: a wrong link to a child who
// is not racing in November is just as wrong.
export const Route = createFileRoute("/api/admin/links")({
  server: {
    handlers: {
      // With ?q= (two letters or more): swimmers whose name matches, with their
      // adults. Without: the most recent links, newest first — which is where
      // the one an email just told you about will be.
      GET: async ({ request }) => {
        const denied = requireAdmin(request);
        if (denied) return denied;
        try {
          const term = (new URL(request.url).searchParams.get("q") ?? "").trim();
          const byName = term.length >= 2;
          const rows = await q(
            `select sw.id::text as swimmer_id, sw.name as swimmer,
                    p.id::text as parent_id, coalesce(p.full_name,'') as parent_name,
                    coalesce(p.phone,'') as phone,
                    (select string_agg(pe.email, ', ') from public.parent_emails pe
                      where pe.parent_id = p.id) as emails,
                    sp.status::text as status, sp.decided_note as note, sp.decided_at as linked_at
               from public.swimmer_parents sp
               join public.swimmers sw on sw.id = sp.swimmer_id
               join public.parents p on p.id = sp.parent_id
              where ${byName ? "sw.name ilike '%' || $1 || '%'" : "true"}
              order by ${byName ? "sw.name, sp.sort_order" : "sp.decided_at desc nulls last"}
              limit ${byName ? 60 : 15}`,
            byName ? [term] : [],
          );
          return json({ rows });
        } catch (err) {
          return fail("GET /api/admin/links", err, "Could not load the links");
        }
      },

      // Take one adult off one child. The swimmer, the other adult and the
      // account itself are untouched; the parent can claim again if it was a
      // mistake to remove them.
      DELETE: async ({ request }) => {
        const denied = requireAdmin(request);
        if (denied) return denied;
        try {
          const s = sessionFromRequest(request);
          const b = await request.json().catch(() => ({}));
          const swimmerId = String(b?.swimmerId ?? "");
          const parentId = String(b?.parentId ?? "");
          if (!swimmerId || !parentId) return json({ error: "swimmerId and parentId required" }, 400);
          const gone = await one<{ name: string; email: string }>(
            `with d as (
               delete from public.swimmer_parents
                where swimmer_id = $1::uuid and parent_id = $2::uuid
               returning swimmer_id, parent_id)
             select sw.name, coalesce(p.email,'') as email
               from d join public.swimmers sw on sw.id = d.swimmer_id
                      join public.parents p on p.id = d.parent_id`,
            [swimmerId, parentId],
          );
          if (!gone) return json({ error: "That link is not there any more" }, 404);
          await note("swimmer_unlinked", {
            email: gone.email,
            parentId,
            detail: `${gone.name} removed from this account by ${s?.email ?? "an admin"}`,
          });
          return json({ ok: true, name: gone.name });
        } catch (err) {
          return fail("DELETE /api/admin/links", err, "Could not remove that link");
        }
      },
    },
  },
});
