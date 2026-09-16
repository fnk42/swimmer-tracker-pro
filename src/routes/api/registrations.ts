import { createFileRoute } from "@tanstack/react-router";
import { q, json, fail } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export const Route = createFileRoute("/api/registrations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = requireAdmin(request);
        if (denied) return denied;
        try {
          return json(await q(`select * from public.registrations`));
        } catch (err) {
          return fail("GET /api/registrations", err, "Failed to fetch registrations");
        }
      },
    },
  },
});
