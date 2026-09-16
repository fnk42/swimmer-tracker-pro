import { createFileRoute } from "@tanstack/react-router";
import { q, one, json, fail } from "@/lib/db";

export const Route = createFileRoute("/api/parents")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return json(await q(`select * from public.parents order by created_at desc`));
        } catch (err) {
          return fail("GET /api/parents", err, "Failed to fetch parents");
        }
      },
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          if (!body.fullName || !body.phone) {
            return json({ error: "Missing required fields: fullName, phone" }, 400);
          }
          const row = await one(
            `insert into public.parents
               (full_name, gender, phone, staying_overnight, user_id, email, backfill_note)
             values ($1, $2, $3, $4, $5, $6, $7)
             returning *`,
            [
              String(body.fullName).trim(),
              body.gender ?? null,
              String(body.phone).trim(),
              body.stayingOvernight ?? "Yet to decide",
              body.userId ?? null,
              body.email ?? null,
              body.backfillNote ?? null,
            ],
          );
          return json(row);
        } catch (err) {
          return fail("POST /api/parents", err, "Failed to create parent");
        }
      },
    },
  },
});
