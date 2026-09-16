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
          if (s.role === "admin") return json({ signedIn: true, role: "admin" });
          const p = await one<{ id: string; full_name: string; email: string; phone: string }>(
            `select id, full_name, email, phone from public.parents where id = $1`,
            [s.parentId],
          );
          if (!p) return json({ signedIn: false });
          return json({
            signedIn: true,
            role: "parent",
            parent: { id: p.id, fullName: p.full_name, email: p.email, phone: p.phone },
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
