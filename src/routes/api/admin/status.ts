import { createFileRoute } from "@tanstack/react-router";
import { q, json, fail } from "@/lib/db";

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

const TOTAL_KES = 20910;

type SwimmerRow = { id: string; name: string; age: number | null; gender: "Male" | "Female" | null };
type PaymentRow = {
  swimmer_id: string; swimmer_ids: string[] | null; child_count: number | null;
  amount: string | number; reference: string; created_at: string;
};

export const Route = createFileRoute("/api/admin/status")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const [swimmers, registrations, payments] = await Promise.all([
            q<SwimmerRow>(`select id, name, age, gender from public.swimmers order by name`),
            q<{ swimmer_id: string }>(`select swimmer_id from public.registrations`),
            q<PaymentRow>(
              `select swimmer_id, swimmer_ids, child_count, amount, reference, created_at
               from public.payments order by created_at desc`,
            ),
          ]);

          const registeredIds = new Set(registrations.map((r) => r.swimmer_id));

          // A multi-child payment covers every swimmer listed in swimmer_ids,
          // and its amount is split across child_count of them.
          const bySwimmer: Record<string, PaymentRow[]> = {};
          for (const p of payments) {
            const covered =
              Array.isArray(p.swimmer_ids) && p.swimmer_ids.length > 0
                ? p.swimmer_ids
                : [p.swimmer_id];
            for (const sid of covered) (bySwimmer[sid] ??= []).push(p);
          }

          const status: SwimmerStatus[] = swimmers.map((s) => {
            const mine = bySwimmer[s.id] ?? [];
            const paid = mine.reduce((sum, p) => {
              const n = Number.isInteger(p.child_count) && (p.child_count as number) > 0
                ? (p.child_count as number) : 1;
              return sum + Number(p.amount) / n;
            }, 0);
            return {
              id: s.id,
              name: s.name,
              age: s.age ?? undefined,
              gender: s.gender ?? undefined,
              paid,
              balance: Math.max(0, TOTAL_KES - paid),
              status: paid <= 0 ? "Unpaid" : paid >= TOTAL_KES ? "Paid" : "Partial",
              registered: registeredIds.has(s.id),
              payments: mine.map((p) => ({
                reference: p.reference,
                amount: Number(p.amount),
                created_at: p.created_at,
              })),
            };
          });

          return json(status);
        } catch (err) {
          return fail("GET /api/admin/status", err, "Failed to fetch admin status");
        }
      },
    },
  },
});
