import { createFileRoute } from "@tanstack/react-router";
import { one, json, fail } from "@/lib/db";

export const Route = createFileRoute("/api/payment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          if (!body.swimmerId || !body.amount || !body.reference) {
            return json(
              { error: "Missing required fields: swimmerId, amount, reference" },
              400,
            );
          }
          if (body.amount <= 0) {
            return json({ error: "Amount must be positive" }, 400);
          }
          const swimmerIds: string[] =
            Array.isArray(body.swimmerIds) && body.swimmerIds.length > 0
              ? body.swimmerIds
              : [body.swimmerId];
          const childCount: number =
            Number.isInteger(body.childCount) && body.childCount > 0
              ? body.childCount
              : swimmerIds.length;

          const row = await one(
            `insert into public.payments
               (swimmer_id, swimmer_ids, child_count, amount, reference, type)
             values ($1, $2::jsonb, $3, $4, $5, $6)
             returning *`,
            [
              body.swimmerId,
              JSON.stringify(swimmerIds),
              childCount,
              body.amount,
              String(body.reference).trim(),
              body.type || "Partial",
            ],
          );
          return json(row);
        } catch (err) {
          return fail("POST /api/payment", err, "Failed to record payment");
        }
      },
    },
  },
});
