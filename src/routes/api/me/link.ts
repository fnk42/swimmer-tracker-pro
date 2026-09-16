import { createFileRoute } from "@tanstack/react-router";
import { one, json, fail } from "@/lib/db";
import { sessionFromRequest } from "@/lib/session";

export const Route = createFileRoute("/api/me/link")({
  server: {
    handlers: {
      // Claim a swimmer as mine. Refused if another parent already holds them,
      // which is what stops one family seeing another family's child.
      POST: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s || s.role !== "parent") return json({ error: "Not signed in" }, 401);
          const b = await request.json().catch(() => ({}));
          const swimmerId = String(b?.swimmerId ?? "");
          if (!swimmerId) return json({ error: "swimmerId required" }, 400);

          const taken = await one<{ parent_id: string }>(
            `select parent_id from public.swimmer_parents
             where swimmer_id = $1 and parent_id <> $2 limit 1`,
            [swimmerId, s.parentId],
          );
          if (taken) {
            return json(
              { error: "That swimmer is already registered by another parent. " +
                       "Contact the coordinator if this is wrong." },
              409,
            );
          }

          const row = await one(
            `insert into public.swimmer_parents (swimmer_id, parent_id, sort_order)
             values ($1, $2, 1)
             on conflict (swimmer_id, parent_id) do update set sort_order = 1
             returning *`,
            [swimmerId, s.parentId],
          );
          return json(row);
        } catch (err) {
          return fail("POST /api/me/link", err, "Could not link that swimmer");
        }
      },
    },
  },
});
