import { createFileRoute } from "@tanstack/react-router";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/api/swimmers")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { data, error } = await getSupabase()
            .from("swimmers")
            .select("*")
            .order("created_at", { ascending: false });

          if (error) throw error;

          return new Response(JSON.stringify(data || []), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("GET /api/swimmers error:", err);
          return new Response(
            JSON.stringify({ error: "Failed to fetch swimmers" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
