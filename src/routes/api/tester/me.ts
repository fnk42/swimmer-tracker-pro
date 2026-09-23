import { createFileRoute } from "@tanstack/react-router";
import { one, json, fail } from "@/lib/db";
import { sessionFromRequest } from "@/lib/session";

// Where a signed-in tester stands: have they agreed, and is the preview still
// open? The registration screens read this to decide which step to show.
export const Route = createFileRoute("/api/tester/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.testerId) return json({ isTester: false });
          const t = await one<{
            full_name: string; email: string; agreed_at: string | null;
            expires_at: string; revoked_at: string | null;
          }>(
            `select full_name, email, agreed_at, expires_at, revoked_at
               from public.testers where id = $1`,
            [s.testerId],
          );
          if (!t) return json({ isTester: false });
          return json({
            isTester: true,
            fullName: t.full_name,
            email: t.email,
            agreed: !!t.agreed_at,
            revoked: !!t.revoked_at,
            expiresAt: t.expires_at,
            expired: new Date(t.expires_at).getTime() < Date.now(),
          });
        } catch (err) {
          return fail("GET /api/tester/me", err, "Could not read your tester status");
        }
      },
    },
  },
});
