import { createFileRoute } from "@tanstack/react-router";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/api/swimmer-parents")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { data, error } = await getSupabase()
            .from("swimmer_parents")
            .select("*");

          if (error) throw error;

          return new Response(JSON.stringify(data || []), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("GET /api/swimmer-parents error:", err);
          return new Response(
            JSON.stringify({ error: "Failed to fetch swimmer-parent links" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
