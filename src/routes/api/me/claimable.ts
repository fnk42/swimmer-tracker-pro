import { createFileRoute } from "@tanstack/react-router";
import { q, json, fail } from "@/lib/db";
import { sessionFromRequest } from "@/lib/session";

const MAX_ADULTS = 2;
const MIN_QUERY = 2;
const LIMIT = 8;

export const Route = createFileRoute("/api/me/claimable")({
  server: {
    handlers: {
      // Find a swimmer to claim, by name.
      //
      // A parent has to be able to find their own child before they can be
      // linked to them, and the second adult in a household has to be able to
      // find a child the first adult already holds. But the roster is a list of
      // children, so it is searched, never browsed: a query of at least two
      // characters, at most eight results, and no way to page through the club.
      //
      // What comes back is a name and how many adults are already on the
      // record — never who they are.
      //
      // A child who is already on an adult's account does not appear here at
      // all. Two adults may still share a swimmer, but the second is added by a
      // coordinator rather than by claiming: self-claiming a child somebody
      // else has already registered is how a parent ends up looking at another
      // family's entry and balance, and it happened twice in one morning. A
      // swimmer already spoken for is left out rather than refused, so nobody
      // learns who is registered by being turned away.
      GET: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.parentId) return json({ error: "Not signed in" }, 401);

          const term = new URL(request.url).searchParams.get("q")?.trim() ?? "";
          if (term.length < MIN_QUERY) return json({ swimmers: [], needsQuery: true });

          const rows = await q<{ id: string; name: string; adults: number; mine: boolean }>(
            `select s.id,
                    s.name,
                    count(sp.parent_id)::int as adults,
                    bool_or(sp.parent_id = $2) as mine
               from public.swimmers s
               left join public.swimmer_parents sp on sp.swimmer_id = s.id
              where s.name ilike '%' || $1 || '%'
              group by s.id, s.name
             having count(sp.parent_id) = 0 or bool_or(sp.parent_id = $2)
              order by s.name
              limit $3`,
            [term, s.parentId, LIMIT],
          );

          return json({
            swimmers: rows.map((r) => ({
              id: r.id,
              name: r.name,
              adults: r.adults,
              mine: !!r.mine,
              slotsLeft: MAX_ADULTS - r.adults,
            })),
          });
        } catch (err) {
          return fail("GET /api/me/claimable", err, "Could not search the roster");
        }
      },
    },
  },
});
