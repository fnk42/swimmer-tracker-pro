import { createFileRoute } from "@tanstack/react-router";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/api/parents/link")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();

          if (!body.swimmerId || !body.parentId) {
            return new Response(
              JSON.stringify({ error: "Missing required fields: swimmerId, parentId" }),
              { status: 400, headers: { "content-type": "application/json" } },
            );
          }

          const row = {
            swimmer_id: body.swimmerId,
            parent_id: body.parentId,
            sort_order:
              Number.isInteger(body.sortOrder) && body.sortOrder > 0
                ? body.sortOrder
                : 1,
          };

          const { data, error } = await getSupabase()
            .from("swimmer_parents")
            .upsert([row], { onConflict: "swimmer_id,parent_id" })
            .select()
            .single();

          if (error) throw error;

          return new Response(JSON.stringify(data), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("POST /api/parents/link error:", err);
          return new Response(
            JSON.stringify({ error: "Failed to link parent to swimmer" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
