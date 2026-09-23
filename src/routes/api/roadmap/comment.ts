import { createFileRoute } from "@tanstack/react-router";
import { q, json, fail } from "@/lib/db";
import { viewer } from "@/lib/scope";

// A comment on a roadmap item. Admins only, same as the board itself.
export const Route = createFileRoute("/api/roadmap/comment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const v = await viewer(request);
          if (!v || v.scope !== "coach") return json({ error: "Admins only" }, 403);
          const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const itemId = String(b.itemId ?? "");
          const body = String(b.body ?? "").trim();
          if (!itemId || !body) return json({ error: "Nothing to say" }, 400);
          await q(
            `insert into public.item_comments (item_id, author, body)
             values ($1::uuid, $2, $3)`,
            [itemId, v.email, body],
          );
          return json({ ok: true });
        } catch (err) {
          return fail("POST /api/roadmap/comment", err, "Could not save that comment");
        }
      },
      GET: async ({ request }) => {
        try {
          const v = await viewer(request);
          if (!v || v.scope !== "coach") return json({ error: "Admins only" }, 403);
          const id = new URL(request.url).searchParams.get("itemId") ?? "";
          if (!id) return json({ error: "itemId required" }, 400);
          const rows = await q(
            `select id::text, author, body, created_at
               from public.item_comments where item_id = $1::uuid
              order by created_at`,
            [id],
          );
          return json({ comments: rows });
        } catch (err) {
          return fail("GET /api/roadmap/comment", err, "Could not load comments");
        }
      },
    },
  },
});
