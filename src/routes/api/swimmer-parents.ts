import { createFileRoute } from "@tanstack/react-router";
import { q, json, fail } from "@/lib/db";

export const Route = createFileRoute("/api/swimmer-parents")({
  server: {
    handlers: {
      GET: async () => {
        try {
          return json(
            await q(`select * from public.swimmer_parents order by sort_order`),
          );
        } catch (err) {
          return fail("GET /api/swimmer-parents", err, "Failed to fetch links");
        }
      },
    },
  },
});
