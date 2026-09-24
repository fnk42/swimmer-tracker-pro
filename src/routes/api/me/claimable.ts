import { createFileRoute } from "@tanstack/react-router";
import { q, json, fail } from "@/lib/db";
import { sessionFromRequest } from "@/lib/session";
import { inSquadSql } from "@/lib/squad";

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
      // A child who already has one adult still appears, because the second
      // adult is a real person who must be able to reach their own child. What
      // stops that being a hole is the phone number: claiming a swimmer
      // somebody else holds requires one, and it has to differ from theirs —
      // see api/me/link. A swimmer already at two adults is left out rather
      // than refused, so nobody learns who is registered by being turned away.
      GET: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.parentId) return json({ error: "Not signed in" }, 401);

          const term = new URL(request.url).searchParams.get("q")?.trim() ?? "";
          if (term.length < MIN_QUERY) return json({ swimmers: [], needsQuery: true });

          const rows = await q<{
            id: string;
            name: string;
            adults: number;
            mine: boolean;
            in_squad: boolean;
          }>(
            `select s.id,
                    s.name,
                    count(sp.parent_id)::int as adults,
                    bool_or(sp.parent_id = $2) as mine,
                    ${inSquadSql("s")} as in_squad
               from public.swimmers s
               left join public.swimmer_parents sp on sp.swimmer_id = s.id
              where s.name ilike '%' || $1 || '%'
              group by s.id, s.name, s.event_squad
             having count(sp.parent_id) < $3 or bool_or(sp.parent_id = $2)
              order by s.name
              limit $4`,
            [term, s.parentId, MAX_ADULTS, LIMIT],
          );

          return json({
            swimmers: rows.map((r) => ({
              id: r.id,
              name: r.name,
              adults: r.adults,
              mine: !!r.mine,
              inSquad: !!r.in_squad,
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
