import { createFileRoute } from "@tanstack/react-router";
import { json, fail, q } from "@/lib/db";
import { sessionFromRequest } from "@/lib/session";
import { CONSENT_DOCUMENT, CONSENT_VERSION } from "@/lib/scope";
import { note } from "@/lib/activity";

// Accepting a new version of the consent, for someone already registered
// (Felix, 20 Oct 2026). The notice was rewritten for launch; everyone agrees to
// it once, without going through registration again. The older acceptance
// stays on record.
export const Route = createFileRoute("/api/me/consent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.parentId) return json({ error: "Not signed in" }, 401);
          const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          if (b.consentData !== true || b.consentCommunity !== true) {
            return json({ error: "Both boxes need to be ticked to carry on" }, 400);
          }
          await q(
            `insert into public.consents (parent_id, document, version)
             values ($1, $2, $3)
             on conflict (parent_id, document, version) where withdrawn_at is null
             do nothing`,
            [s.parentId, CONSENT_DOCUMENT, CONSENT_VERSION],
          );
          await note("consent_given", {
            email: s.email, parentId: s.parentId, detail: `version ${CONSENT_VERSION}`,
          });
          return json({ ok: true });
        } catch (err) {
          return fail("POST /api/me/consent", err, "Could not record your agreement");
        }
      },
    },
  },
});
