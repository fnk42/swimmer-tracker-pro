import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import type { Payment } from "@/lib/supabase";

export const Route = createFileRoute("/api/payment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();

          if (!body.swimmerId || !body.amount || !body.reference) {
            return new Response(
              JSON.stringify({
                error: "Missing required fields: swimmerId, amount, reference",
              }),
              { status: 400, headers: { "content-type": "application/json" } },
            );
          }

          if (body.amount <= 0) {
            return new Response(
              JSON.stringify({ error: "Amount must be positive" }),
              { status: 400, headers: { "content-type": "application/json" } },
            );
          }

          const swimmerIds: string[] =
            Array.isArray(body.swimmerIds) && body.swimmerIds.length > 0
              ? body.swimmerIds
              : [body.swimmerId];
          const childCount: number =
            Number.isInteger(body.childCount) && body.childCount > 0
              ? body.childCount
              : swimmerIds.length;

          const payment: Omit<Payment, "id"> = {
            swimmer_id: body.swimmerId,
            swimmer_ids: swimmerIds,
            child_count: childCount,
            amount: body.amount,
            reference: body.reference.trim(),
            type: body.type || "Partial",
            created_at: new Date().toISOString(),
          };

          const { data, error } = await supabase
            .from("payments")
            .insert([payment])
            .select()
            .single();

          if (error) throw error;

          return new Response(JSON.stringify(data), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("POST /api/payment error:", err);
          return new Response(
            JSON.stringify({ error: "Failed to record payment" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
