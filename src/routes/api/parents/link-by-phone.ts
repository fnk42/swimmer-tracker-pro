import { createFileRoute } from "@tanstack/react-router";
import { getSupabase } from "@/lib/supabase";

// First-login flow: a Google-signed-in parent tells us their phone number and
// we (server-side, JWT-verified) claim the matching `parents` row for them if
// it exists and is unclaimed. The endpoint is safe because:
//   * we verify the caller's JWT with Supabase Auth before doing anything;
//   * the partial unique index on parents.user_id (see the RLS migration)
//     prevents a caller from claiming more than one row.

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isValidKePhone(phone: string): boolean {
  return /^254[0-9]{9}$/.test(phone);
}

export const Route = createFileRoute("/api/parents/link-by-phone")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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

          const body = await request.json().catch(() => ({}));
          const phone = String(body?.phone ?? "").trim();
          if (!isValidKePhone(phone)) {
            return jsonResponse(400, {
              error: "Phone must be 254XXXXXXXXX",
            });
          }

          const { data: existing, error: selErr } = await sb
            .from("parents")
            .select("id, user_id, email")
            .eq("phone", phone)
            .maybeSingle();
          if (selErr) throw selErr;

          if (!existing) {
            return jsonResponse(200, { status: "no_match" });
          }

          if (existing.user_id && existing.user_id === user.id) {
            return jsonResponse(200, {
              status: "linked",
              alreadyLinked: true,
            });
          }

          if (existing.user_id && existing.user_id !== user.id) {
            return jsonResponse(409, { status: "owned_by_other" });
          }

          // user_id is null → claim.
          const { data: updated, error: updErr } = await sb
            .from("parents")
            .update({ user_id: user.id, email: user.email ?? null })
            .eq("id", existing.id)
            .is("user_id", null)
            .select("id, user_id")
            .maybeSingle();
          if (updErr) throw updErr;

          if (!updated) {
            // Race: someone else claimed it between our SELECT and UPDATE.
            const { data: refetched } = await sb
              .from("parents")
              .select("user_id")
              .eq("id", existing.id)
              .maybeSingle();
            if (refetched?.user_id === user.id) {
              return jsonResponse(200, {
                status: "linked",
                alreadyLinked: true,
              });
            }
            return jsonResponse(409, { status: "owned_by_other" });
          }

          return jsonResponse(200, { status: "linked" });
        } catch (err) {
          console.error("POST /api/parents/link-by-phone error:", err);
          return jsonResponse(500, { error: "Failed to link phone" });
        }
      },
    },
  },
});
