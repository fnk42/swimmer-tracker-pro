import { createFileRoute } from "@tanstack/react-router";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/api/swimmers/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        try {
          const { id } = params;
          const body = await request.json();
          const name = String(body?.name ?? "").trim();
          if (!name) {
            return new Response(
              JSON.stringify({ error: "name required" }),
              { status: 400, headers: { "content-type": "application/json" } },
            );
          }
          const { data, error } = await getSupabase()
            .from("swimmers")
            .update({ name })
            .eq("id", id)
            .select()
            .single();
          if (error) throw error;
          return new Response(JSON.stringify(data), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("PATCH /api/swimmers/:id error:", err);
          return new Response(
            JSON.stringify({ error: "Failed to update swimmer" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
      // Best-effort cascade: payments + registrations + swimmer itself. If
      // multi-child payments cover other swimmers in swimmer_ids, they
      // remain (still covers the remaining kids). Data-integrity cleanup
      // for the multi-child case is a follow-up.
      DELETE: async ({ params }) => {
        try {
          const { id } = params;
          const sb = getSupabase();
          const p = await sb.from("payments").delete().eq("swimmer_id", id);
          if (p.error) throw p.error;
          const r = await sb.from("registrations").delete().eq("swimmer_id", id);
          if (r.error) throw r.error;
          const s = await sb.from("swimmers").delete().eq("id", id);
          if (s.error) throw s.error;
          return new Response(JSON.stringify({ ok: true }), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("DELETE /api/swimmers/:id error:", err);
          return new Response(
            JSON.stringify({ error: "Failed to delete swimmer" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
