import { createFileRoute } from "@tanstack/react-router";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/api/parents")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { data, error } = await getSupabase()
            .from("parents")
            .select("*")
            .order("created_at", { ascending: false });

          if (error) throw error;

          return new Response(JSON.stringify(data || []), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("GET /api/parents error:", err);
          return new Response(
            JSON.stringify({ error: "Failed to fetch parents" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
      POST: async ({ request }) => {
        try {
          const body = await request.json();

          if (!body.fullName || !body.phone) {
            return new Response(
              JSON.stringify({ error: "Missing required fields: fullName, phone" }),
              { status: 400, headers: { "content-type": "application/json" } },
            );
          }

          const row = {
            full_name: String(body.fullName).trim(),
            gender: body.gender ?? null,
            phone: String(body.phone).trim(),
            staying_overnight: body.stayingOvernight ?? "Yet to decide",
            user_id: body.userId ?? null,
            email: body.email ?? null,
            backfill_note: body.backfillNote ?? null,
          };

          const { data, error } = await getSupabase()
            .from("parents")
            .insert([row])
            .select()
            .single();

          if (error) throw error;

          return new Response(JSON.stringify(data), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("POST /api/parents error:", err);
          return new Response(
            JSON.stringify({ error: "Failed to create parent" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
