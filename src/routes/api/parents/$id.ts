import { createFileRoute } from "@tanstack/react-router";
import { getSupabase } from "@/lib/supabase";

// PATCH single parents row. JWT-verified. A signed-in parent can:
//   * update their own row (user_id already matches them), or
//   * claim an unlinked row (user_id is null) by setting user_id to themselves
//     — the partial unique index on parents.user_id caps this at one row.
// Any attempt to modify a row owned by a different user is rejected.

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/parents/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        try {
          const auth = request.headers.get("authorization") ?? "";
          const match = auth.match(/^Bearer\s+(.+)$/i);
          if (!match) {
            return jsonResponse(401, { error: "Missing bearer token" });
          }
          const token = match[1].trim();

          const sb = getSupabase();
          const { data: userData, error: userErr } = await sb.auth.getUser(token);
          if (userErr || !userData?.user) {
            return jsonResponse(401, { error: "Invalid session" });
          }
          const user = userData.user;

          const { id } = params;
          const body = await request.json().catch(() => ({}));
          const update: Record<string, unknown> = {};
          if (typeof body?.userId === "string") {
            if (body.userId !== user.id) {
              return jsonResponse(403, {
                error: "userId must match authenticated user",
              });
            }
            update.user_id = body.userId;
          }
          if (typeof body?.email === "string" || body?.email === null) {
            update.email = body.email;
          }
          if (Object.keys(update).length === 0) {
            return jsonResponse(400, {
              error: "No updatable fields (userId, email) provided",
            });
          }

          const { data: current, error: selErr } = await sb
            .from("parents")
            .select("user_id")
            .eq("id", id)
            .maybeSingle();
          if (selErr) throw selErr;
          if (!current) {
            return jsonResponse(404, { error: "Not found" });
          }
          if (current.user_id && current.user_id !== user.id) {
            return jsonResponse(403, { error: "Row owned by another user" });
          }

          const { data, error } = await sb
            .from("parents")
            .update(update)
            .eq("id", id)
            .select()
            .single();
          if (error) throw error;
          return jsonResponse(200, data);
        } catch (err) {
          console.error("PATCH /api/parents/:id error:", err);
          return jsonResponse(500, { error: "Failed to update parent" });
        }
      },
    },
  },
});
