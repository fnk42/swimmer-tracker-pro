import { createFileRoute } from "@tanstack/react-router";
import { one, q, json, fail } from "@/lib/db";
import { sessionFromRequest } from "@/lib/session";
import { note } from "@/lib/activity";

export const Route = createFileRoute("/api/me/payment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.parentId) return json({ error: "Not signed in" }, 401);
          const b = await request.json().catch(() => ({}));
          if (!b.swimmerId || !b.amount || !b.reference) {
            return json({ error: "Missing swimmerId, amount or reference" }, 400);
          }
          if (Number(b.amount) <= 0) return json({ error: "Amount must be positive" }, 400);

          const ids: string[] =
            Array.isArray(b.swimmerIds) && b.swimmerIds.length > 0
              ? b.swimmerIds.map(String)
              : [String(b.swimmerId)];

          // Every swimmer the payment claims to cover must be one of mine,
          // otherwise a parent could credit someone else's child.
          const owned = await q<{ swimmer_id: string }>(
            `select swimmer_id from public.swimmer_parents
             where parent_id = $1 and swimmer_id = any($2::uuid[])`,
            [s.parentId, ids],
          );
          if (owned.length !== ids.length) {
            return json({ error: "One of those swimmers is not linked to you" }, 403);
          }

          const childCount =
            Number.isInteger(b.childCount) && b.childCount > 0 ? b.childCount : ids.length;

          const row = await one(
            `insert into public.payments
               (swimmer_id, swimmer_ids, child_count, amount, reference, type)
             values ($1, $2::jsonb, $3, $4, $5, $6) returning *`,
            [
              b.swimmerId,
              JSON.stringify(ids),
              childCount,
              b.amount,
              String(b.reference).trim(),
              b.type || "Partial",
            ],
          );
          // Money was the one thing this log did not carry, which made it the
          // one thing a coordinator could not answer from the page: did their
          // payment go through, and when.
          const who = await one<{ name: string }>(
            `select name from public.swimmers where id = $1`,
            [b.swimmerId],
          );
          await note("payment_recorded", {
            email: s.email,
            parentId: s.parentId,
            detail:
              `KES ${Number(b.amount).toLocaleString("en-KE")} · ${who?.name ?? "a swimmer"}` +
              ` · ref ${String(b.reference).trim()}` +
              (childCount > 1 ? ` · covers ${childCount} children` : ""),
          });
          return json(row);
        } catch (err) {
          return fail("POST /api/me/payment", err, "Could not record that payment");
        }
      },
    },
  },
});
