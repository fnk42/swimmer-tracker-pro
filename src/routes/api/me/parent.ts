import { createFileRoute } from "@tanstack/react-router";
import { one, json, fail } from "@/lib/db";
import { sessionFromRequest } from "@/lib/session";

export const Route = createFileRoute("/api/me/parent")({
  server: {
    handlers: {
      // A parent may edit their own row and nothing else. The WHERE clause is
      // bound to the session id, so a crafted body cannot redirect the update.
      PATCH: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.parentId) return json({ error: "Not signed in" }, 401);
          const b = await request.json().catch(() => ({}));

          const row = await one(
            `update public.parents set
               full_name         = coalesce($2, full_name),
               gender            = coalesce($3, gender),
               phone             = coalesce($4, phone),
               staying_overnight = coalesce($5, staying_overnight),
               updated_at        = now()
             where id = $1
             returning id, full_name, gender, phone, staying_overnight, email,
                       created_at, updated_at`,
            [
              s.parentId,
              b.fullName ? String(b.fullName).trim() : null,
              b.gender ?? null,
              b.phone ? String(b.phone).trim() : null,
              b.stayingOvernight ?? null,
            ],
          );
          return json(row);
        } catch (err) {
          return fail("PATCH /api/me/parent", err, "Could not save your details");
        }
      },
    },
  },
});
