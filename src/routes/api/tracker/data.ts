import { createFileRoute } from "@tanstack/react-router";
import { requireAdmin } from "@/lib/session";
import data from "../../../tracker/data.json";

// Swim performance for every NextGen athlete, 2024–2026. Coordinator only:
// it carries children's names, ages and results, so it must never be a public
// static asset.
export const Route = createFileRoute("/api/tracker/data")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = requireAdmin(request);
        if (denied) return denied;
        return new Response(JSON.stringify(data), {
          headers: {
            "content-type": "application/json",
            "cache-control": "private, max-age=300",
          },
        });
      },
    },
  },
});
