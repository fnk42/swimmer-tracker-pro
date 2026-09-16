import { createFileRoute } from "@tanstack/react-router";
import { one, json, fail } from "@/lib/db";
import { sessionFromRequest, cookieHeader } from "@/lib/session";

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
