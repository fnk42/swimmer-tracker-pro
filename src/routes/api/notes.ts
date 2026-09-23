import { createFileRoute } from "@tanstack/react-router";
import { q, json, fail } from "@/lib/db";
import { viewer } from "@/lib/scope";

// Notes left while using the app.
//
// Anyone signed in can leave one — this is the only part of the roadmap a
// parent touches, and it is write-only for them. The route they were on is
// captured with the note, because "the filter is confusing" is worth very
// little and the same words against /tracker#/swimmers are actionable.
export const Route = createFileRoute("/api/notes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const v = await viewer(request);
          if (!v) return json({ error: "Not signed in" }, 401);
          const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const body = String(b.body ?? "").trim();
          if (!body) return json({ error: "Write something first" }, 400);
          if (body.length > 4000) return json({ error: "That is too long" }, 400);
          await q(
            `insert into public.page_notes (route, body, author, is_coach)
             values ($1, $2, $3, $4)`,
            [String(b.route ?? "").slice(0, 300), body, v.email, v.scope === "coach"],
          );
          return json({ ok: true });
        } catch (err) {
          return fail("POST /api/notes", err, "Could not send that note");
        }
      },

      PATCH: async ({ request }) => {
        try {
          const v = await viewer(request);
          if (!v || v.scope !== "coach") return json({ error: "Admins only" }, 403);
          const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const id = String(b.id ?? "");
          if (!id) return json({ error: "id required" }, 400);
          await q(`update public.page_notes set resolved_at = now() where id = $1::uuid`, [id]);
          return json({ ok: true });
        } catch (err) {
          return fail("PATCH /api/notes", err, "Could not update that note");
        }
      },
    },
  },
});
