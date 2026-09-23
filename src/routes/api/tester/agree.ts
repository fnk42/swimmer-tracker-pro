import { createFileRoute } from "@tanstack/react-router";
import { one, json, fail } from "@/lib/db";
import { sessionFromRequest } from "@/lib/session";
import { CONSENT_VERSION } from "@/lib/consent-version";
import { note } from "@/lib/activity";

// The gate. Until this row has agreed_at, lib/scope refuses the tester
// everything, so the agreement is a condition of access rather than a page
// somebody scrolled past.
export const Route = createFileRoute("/api/tester/agree")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.testerId) return json({ error: "Not signed in as a tester" }, 401);
          const b = await request.json().catch(() => ({}));
          if (b?.confidentiality !== true || b?.consent !== true) {
            return json({ error: "Both boxes need to be ticked" }, 400);
          }

          const row = await one<{ id: string; expires_at: string }>(
            `update public.testers
                set agreed_at = coalesce(agreed_at, now()), agreed_version = $2
              where id = $1 and revoked_at is null
             returning id, expires_at`,
            [s.testerId, CONSENT_VERSION],
          );
          if (!row) return json({ error: "That tester access has been withdrawn" }, 403);

          await note("tester_agreed", {
            email: s.email, detail: `confidentiality + consent ${CONSENT_VERSION}`,
          });
          return json({ ok: true, expiresAt: row.expires_at });
        } catch (err) {
          return fail("POST /api/tester/agree", err, "Could not record your agreement");
        }
      },
    },
  },
});
