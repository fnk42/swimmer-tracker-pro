import { createFileRoute } from "@tanstack/react-router";
import { getSupabase } from "@/lib/supabase";

interface SwimmerStatus {
  id: string;
  name: string;
  age?: number;
  gender?: "Male" | "Female";
  paid: number;
  balance: number;
  status: "Unpaid" | "Partial" | "Paid";
  registered: boolean;
  payments: Array<{ reference: string; amount: number; created_at: string }>;
}

export const Route = createFileRoute("/api/admin/status")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const sb = getSupabase();
          const { data: swimmers, error: swimmersError } = await sb
            .from("swimmers")
            .select("*");

          if (swimmersError) throw swimmersError;

          const { data: registrations, error: regsError } = await sb
            .from("registrations")
            .select("swimmer_id");

          if (regsError) throw regsError;

          const { data: payments, error: paymentsError } = await sb
            .from("payments")
            .select("swimmer_id, swimmer_ids, child_count, amount, reference, created_at");

          if (paymentsError) throw paymentsError;

          const TOTAL_KES = 20000;
          const registeredIds = new Set(
            registrations?.map((r: any) => r.swimmer_id) || [],
          );
          const paymentsBySwimmer: Record<string, any[]> = {};

          payments?.forEach((p: any) => {
            const covered: string[] =
              Array.isArray(p.swimmer_ids) && p.swimmer_ids.length > 0
                ? p.swimmer_ids
                : [p.swimmer_id];
            covered.forEach((sid) => {
              if (!paymentsBySwimmer[sid]) paymentsBySwimmer[sid] = [];
              paymentsBySwimmer[sid].push(p);
            });
          });

          const status: SwimmerStatus[] = (swimmers || []).map((s: any) => {
            const payments_for_swimmer = paymentsBySwimmer[s.id] || [];
            const paid = payments_for_swimmer.reduce((sum: number, p: any) => {
              const n =
                Number.isInteger(p.child_count) && p.child_count > 0
                  ? p.child_count
                  : 1;
              return sum + p.amount / n;
            }, 0);
            const balance = Math.max(0, TOTAL_KES - paid);
            const statusValue =
              paid <= 0 ? "Unpaid" : paid >= TOTAL_KES ? "Paid" : "Partial";

            return {
              id: s.id,
              name: s.name,
              age: s.age,
              gender: s.gender,
              paid,
              balance,
              status: statusValue,
              registered: registeredIds.has(s.id),
              payments: payments_for_swimmer.map((p: any) => ({
                reference: p.reference,
                amount: p.amount,
                created_at: p.created_at,
              })),
            };
          });

          return new Response(JSON.stringify(status), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("GET /api/admin/status error:", err);
          return new Response(
            JSON.stringify({ error: "Failed to fetch admin status" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
