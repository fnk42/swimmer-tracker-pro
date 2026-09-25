import { createFileRoute } from "@tanstack/react-router";
import { one, json, fail } from "@/lib/db";
import { sessionFromRequest, cookieHeader } from "@/lib/session";
import { viewer, testerIdFor } from "@/lib/scope";
import { inSquadSql } from "@/lib/squad";

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
          // Deleted out from under a live cookie: answer signed-out rather
          // than half-signed-in, which is what let writes carry on.
          // Same reason as the agreement route: somebody added to the preview
          // after their last sign-in has no testerId in the cookie.
          const testerId = await testerIdFor(s);
          if (s.parentId && !p && !testerId && !s.isAdmin) {
            return json({ signedIn: false });
          }
          // Does this session hold live preview access? Its own question,
          // separate from being a parent: a parent-tester keeps Events either
          // way, and only the analytics wait on the agreement.
          const preview = testerId
            ? await one<{ ok: boolean }>(
                `select (agreed_at is not null
                         and revoked_at is null
                         and expires_at > now()) as ok
                   from public.testers where id = $1`,
                [testerId],
              )
            : null;
          const previewAccess = !!preview?.ok;

          // A tester has no parent row by design, so answer for them here
          // before the parent check turns them away. They get Performance and
          // nothing else: Events belongs to families.
          if (s.testerId && !p && !s.isAdmin) {
            // viewer() is null until the agreement is signed and while the
            // preview is open, which is the access answer. It is NOT the
            // answer to "are you signed in": a tester who has not signed yet
            // very much is, and needs to be sent to the agreement rather than
            // treated as a stranger. Reporting them signed out sent them to
            // the Events page with an empty account.
            const v = await viewer(request);
            const t = await one<{
              agreed_at: string | null;
              expires_at: string;
              revoked_at: string | null;
            }>(`select agreed_at, expires_at, revoked_at from public.testers where id = $1`, [
              s.testerId,
            ]);
            return json({
              signedIn: true,
              email: s.email,
              isAdmin: false,
              isTester: true,
              previewAccess,
              needsAgreement: !!t && !t.agreed_at && !t.revoked_at,
              testerClosed: !!t && (!!t.revoked_at || new Date(t.expires_at) < new Date()),
              via: s.via,
              sections: { performance: !!v, analytics: previewAccess, events: false },
              scope: v?.scope,
              needsRegistration: false,
              parent: null,
            });
          }

          // Does this parent have anybody in the Machakos team?
          const squad = s.parentId
            ? await one<{ n: number }>(
                `select count(*)::int n
                   from public.swimmer_parents sp
                   join public.swimmers sw on sw.id = sp.swimmer_id
                  where sp.parent_id = $1
                    and ${inSquadSql("sw")}`,
                [s.parentId],
              )
            : null;
          const inSquad = (squad?.n ?? 0) > 0;
          const v = await viewer(request);

          // Someone can be both — a coordinator who also has a child swimming.
          if (!p && !s.isAdmin) return json({ signedIn: false });
          return json({
            signedIn: true,
            email: s.email,
            isAdmin: s.isAdmin,
            // A parent who also tests. Events is theirs as a parent; the
            // analytics open only once the agreement is signed.
            isTester: !!testerId,
            previewAccess,
            // Which sections of the portal this person gets. Everyone signed in
            // sees Performance; Events is for the people actually involved in
            // the meet. Today the database only holds Machakos registrants, so
            // every parent has both — the distinction matters once parents of
            // non-registered swimmers can sign in too.
            // Analytics is for every confirmed guardian — which is what the
            // consent document has promised all along: "anyone in the NextGen
            // community who has been confirmed as a parent or guardian can see
            // race results for all NextGen swimmers". The "coming soon" hold
            // was for the consent drive, and that is done.
            //
            // Events is narrower. A parent with nobody in the Machakos team
            // has nothing to register and no balance to pay, so the tab is not
            // theirs — and without it there is no "your child is not in the
            // team" line to write, because they never reach the page.
            via: s.via,
            sections: {
              performance: true,
              // Registration is not the key to this. The preview is.
              analytics: s.isAdmin || previewAccess,
              events: s.isAdmin || inSquad,
            },
            // An account that has never been filled in. /welcome greets these
            // people as first-time registrants rather than asking them to
            // confirm details they have never given.
            firstTime: !s.isAdmin && !!p && !p.full_name,
            // Registration state, from the same place every route reads it.
            // Coordinators are never flagged — see the note in scope.ts.
            ...(await (async () => {
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
            parent: p ? { id: p.id, fullName: p.full_name, email: p.email, phone: p.phone } : null,
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
