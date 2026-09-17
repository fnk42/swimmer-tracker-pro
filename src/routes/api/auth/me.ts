import { createFileRoute } from "@tanstack/react-router";
import { one, json, fail } from "@/lib/db";
import { sessionFromRequest, cookieHeader } from "@/lib/session";
import { viewer } from "@/lib/scope";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      // Who am I? Used on page load to rehydrate the signed-in state.
      GET: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s) return json({ signedIn: false });
          const p = s.parentId
            ? await one<{ id: string; full_name: string; email: string; phone: string }>(
                `select id, full_name, email, phone from public.parents where id = $1`,
                [s.parentId],
              )
            : null;
          // Someone can be both — a coordinator who also has a child swimming.
          if (!p && !s.isAdmin) return json({ signedIn: false });
          return json({
            signedIn: true,
            email: s.email,
            isAdmin: s.isAdmin,
            // Which sections of the portal this person gets. Everyone signed in
            // sees Performance; Events is for the people actually involved in
            // the meet. Today the database only holds Machakos registrants, so
            // every parent has both — the distinction matters once parents of
            // non-registered swimmers can sign in too.
            sections: { performance: true, events: s.isAdmin || !!s.parentId },
            // Registration state, from the same place every route reads it.
            // Coordinators are never flagged — see the note in scope.ts.
            ...(await (async () => {
              const v = await viewer(request);
              return v
                ? {
                    scope: v.scope,
                    needsRegistration: v.needsProfile || v.needsConsent,
                    needsProfile: v.needsProfile,
                    needsConsent: v.needsConsent,
                    pendingClaims: v.pendingClaims,
                    myAthletes: v.myAthletes.length,
                  }
                : {};
            })()),
            parent: p
              ? { id: p.id, fullName: p.full_name, email: p.email, phone: p.phone }
              : null,
          });
        } catch (err) {
          return fail("GET /api/auth/me", err, "Could not read session");
        }
      },
      // Sign out.
      DELETE: async () =>
        new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json", "set-cookie": cookieHeader(null) },
        }),
    },
  },
});
