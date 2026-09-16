import { createFileRoute } from "@tanstack/react-router";
import { one, json, fail, tx } from "@/lib/db";

export const Route = createFileRoute("/api/swimmers/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        try {
          const body = await request.json();
          const name = String(body?.name ?? "").trim();
          if (!name) return json({ error: "name required" }, 400);
          const row = await one(
            `update public.swimmers set name = $1, updated_at = now()
             where id = $2 returning *`,
            [name, params.id],
          );
          if (!row) return json({ error: "Not found" }, 404);
          return json(row);
        } catch (err) {
          return fail("PATCH /api/swimmers/:id", err, "Failed to update swimmer");
        }
      },

      // Payments and registrations cascade from the foreign keys, but doing it
      // explicitly inside one transaction means a partial failure rolls back
      // rather than leaving a swimmer with orphaned money attached.
      DELETE: async ({ params }) => {
        try {
          await tx(async (c) => {
            await c.query(`delete from public.payments where swimmer_id = $1`, [params.id]);
            await c.query(`delete from public.registrations where swimmer_id = $1`, [params.id]);
            await c.query(`delete from public.swimmer_parents where swimmer_id = $1`, [params.id]);
            await c.query(`delete from public.swimmers where id = $1`, [params.id]);
          });
          return json({ ok: true });
        } catch (err) {
          return fail("DELETE /api/swimmers/:id", err, "Failed to delete swimmer");
        }
      },
    },
  },
});
