import { createFileRoute } from "@tanstack/react-router";
import { q, one, json, fail } from "@/lib/db";
import { sessionFromRequest } from "@/lib/session";

const MAX_ADULTS = 2;

export const Route = createFileRoute("/api/me/link")({
  server: {
    handlers: {
      // Claim a swimmer as mine.
      //
      // A child normally has two adults who both need to see the registration,
      // the balance and the swimming, so two may hold the same swimmer. The
      // third is refused: past two it stops being a household and starts being
      // someone seeing a child who is not theirs.
      //
      // Every claim made here starts PENDING and is confirmed by a coordinator.
      // Claiming is not proof of anything.
      //
      // The database enforces the same cap (migration/04_two_parents.sql), so a
      // race between two adults claiming the last slot at the same moment fails
      // on the unique index rather than quietly adding a third.
      POST: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.parentId) return json({ error: "Not signed in" }, 401);
          const b = await request.json().catch(() => ({}));
          const swimmerId = String(b?.swimmerId ?? "");
          if (!swimmerId) return json({ error: "swimmerId required" }, 400);

          // Approved links only count towards the two-adult cap. A pending
          // claim reserves nothing, so two parents can both be waiting on a
          // coordinator without the second being turned away.
          const held = await q<{ parent_id: string; sort_order: number; status: string }>(
            `select parent_id, sort_order, status::text from public.swimmer_parents
             where swimmer_id = $1 order by sort_order`,
            [swimmerId],
          );

          const mine = held.find((h) => h.parent_id === s.parentId);
          if (mine) {
            return json({
              swimmer_id: swimmerId,
              parent_id: s.parentId,
              sort_order: mine.sort_order,
              status: mine.status,
            });
          }

          const approved = held.filter((h) => h.status === "approved");
          if (approved.length >= MAX_ADULTS) {
            return json(
              {
                error:
                  "Two adults are already linked to that swimmer, which is the limit. " +
                  "Ask the coordinator if one of them should be changed.",
              },
              409,
            );
          }

          const slot = held.some((h) => h.sort_order === 1) ? 2 : 1;

          // Pending, always. A parent claiming a child proves nothing by
          // claiming; an unapproved claim grants no access to named data.
          // Auto-approval on a phone or email match against club records is a
          // coordinator-side job, not something the claimer can trigger.
          const row = await one(
            `insert into public.swimmer_parents (swimmer_id, parent_id, sort_order, status)
             values ($1, $2, $3, 'pending')
             returning *`,
            [swimmerId, s.parentId, slot],
          );
          return json(row);
        } catch (err) {
          // The unique index fires when two adults claim the last slot at once.
          if (String((err as { code?: string })?.code) === "23505") {
            return json(
              {
                error:
                  "Someone else was linked to that swimmer a moment ago. " +
                  "Refresh to see who is on the record.",
              },
              409,
            );
          }
          return fail("POST /api/me/link", err, "Could not link that swimmer");
        }
      },
    },
  },
});
