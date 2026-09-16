import { createFileRoute } from "@tanstack/react-router";
import { q, json, fail } from "@/lib/db";

export const Route = createFileRoute("/api/payments")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return json(
            await q(`select * from public.payments order by created_at desc`),
          );
        } catch (err) {
          return fail("GET /api/payments", err, "Failed to fetch payments");
        }
      },
    },
  },
});
