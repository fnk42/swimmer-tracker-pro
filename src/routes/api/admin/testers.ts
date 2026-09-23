import { createFileRoute } from "@tanstack/react-router";
import { q, json, fail } from "@/lib/db";
import { sessionFromRequest, requireAdmin } from "@/lib/session";

// Who is in the preview, and the power to end it.
export const Route = createFileRoute("/api/admin/testers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = requireAdmin(request);
        if (denied) return denied;
        try {
          const rows = await q(
            `select t.id::text, t.email, t.full_name, t.how_known,
                    t.agreed_at, t.expires_at, t.revoked_at, t.last_seen_at, t.created_at,
                    (select count(*)::int from public.tester_feedback f
                      where f.tester_id = t.id) as feedback,
                    (select count(*)::int from public.activity a
                      where lower(a.email) = lower(t.email) and a.kind = 'signed_in') as sign_ins
               from public.testers t
              order by t.created_at desc`,
          );
          return json({ rows });
        } catch (err) {
          return fail("GET /api/admin/testers", err, "Could not load testers");
        }
      },

      // Withdraw access, or hand it back. Never a delete: the feedback they
      // left is still the club's, and the record of who saw what should not
      // vanish because the preview ended.
      PATCH: async ({ request }) => {
        const denied = requireAdmin(request);
        if (denied) return denied;
        try {
          const s = sessionFromRequest(request);
          const b = await request.json().catch(() => ({}));
          const id = String(b?.id ?? "");
          if (!id) return json({ error: "id required" }, 400);

          if (b?.revoke === true) {
            await q(
              `update public.testers set revoked_at = now(), revoked_by = $2 where id = $1::uuid`,
              [id, s?.email ?? ""],
            );
          } else if (b?.revoke === false) {
            await q(
              `update public.testers set revoked_at = null, revoked_by = null where id = $1::uuid`,
              [id],
            );
          } else if (b?.expiresAt) {
            await q(`update public.testers set expires_at = $2 where id = $1::uuid`,
              [id, String(b.expiresAt)]);
          }
          return json({ ok: true });
        } catch (err) {
          return fail("PATCH /api/admin/testers", err, "Could not update that tester");
        }
      },
    },
  },
});
