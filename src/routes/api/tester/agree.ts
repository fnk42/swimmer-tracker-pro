import { createFileRoute } from "@tanstack/react-router";
import { one, q, json, fail } from "@/lib/db";
import { sessionFromRequest } from "@/lib/session";
import { CONSENT_VERSION, CONSENT_DOCUMENT } from "@/lib/consent-version";
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

          // The second tick on that screen IS the club's consent document, at
          // the current version. A tester who is also a parent has therefore
          // accepted it as a parent too, and their parent record should say
          // so — otherwise they tick it, and the app still holds them at the
          // consent gate for a document they just accepted. Gladys hit exactly
          // that: her parent consent was two versions old.
          if (s.parentId) {
            await q(
              `insert into public.consents (parent_id, document, version)
               values ($1, $2, $3)
               on conflict (parent_id, document, version) where withdrawn_at is null
               do nothing`,
              [s.parentId, CONSENT_DOCUMENT, CONSENT_VERSION],
            );
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
