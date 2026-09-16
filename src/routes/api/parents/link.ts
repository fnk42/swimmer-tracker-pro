import { createFileRoute } from "@tanstack/react-router";
import { one, json, fail } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const Route = createFileRoute("/api/parents/link")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = requireAdmin(request);
        if (denied) return denied;
        try {
          const body = await request.json();
          if (!body.swimmerId || !body.parentId) {
            return json({ error: "Missing required fields: swimmerId, parentId" }, 400);
          }
          const sortOrder =
            Number.isInteger(body.sortOrder) && body.sortOrder > 0 ? body.sortOrder : 1;
          const row = await one(
            `insert into public.swimmer_parents (swimmer_id, parent_id, sort_order)
             values ($1, $2, $3)
             on conflict (swimmer_id, parent_id)
               do update set sort_order = excluded.sort_order
             returning *`,
            [body.swimmerId, body.parentId, sortOrder],
          );
          return json(row);
        } catch (err) {
          return fail("POST /api/parents/link", err, "Failed to link parent to swimmer");
        }
      },
    },
  },
});
