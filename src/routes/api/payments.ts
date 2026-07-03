import { createFileRoute } from "@tanstack/react-router";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/api/payments")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { data, error } = await getSupabase()
            .from("payments")
            .select("*")
            .order("created_at", { ascending: false });

          if (error) throw error;

          return new Response(JSON.stringify(data || []), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("GET /api/payments error:", err);
          return new Response(
            JSON.stringify({ error: "Failed to fetch payments" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
