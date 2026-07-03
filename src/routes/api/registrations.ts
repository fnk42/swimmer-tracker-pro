import { createFileRoute } from "@tanstack/react-router";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/api/registrations")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { data, error } = await getSupabase()
            .from("registrations")
            .select("*");

          if (error) throw error;

          return new Response(JSON.stringify(data || []), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("GET /api/registrations error:", err);
          return new Response(
            JSON.stringify({ error: "Failed to fetch registrations" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
