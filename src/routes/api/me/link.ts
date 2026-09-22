import { createFileRoute } from "@tanstack/react-router";
import { q, one, json, fail } from "@/lib/db";
import { adminEmails } from "@/lib/session";
import { sendClaimNotice } from "@/lib/mailer";
import { normalizeKePhone } from "@/lib/phone";
import { sessionFromRequest } from "@/lib/session";
import { note } from "@/lib/activity";

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
      // A claim takes effect immediately. There is no approval step: the two-
      // adult cap is the control, and a coordinator can still unlink someone
      // who should not be there. Holding every claim for a human meant a parent
      // who had done everything right still could not see their own child until
      // somebody happened to look, which on a registration weekend is the same
      // as being locked out.
      //
      // The database enforces the same cap (migration/04_two_parents.sql), so a
      // race between two adults claiming the last slot at the same moment fails
      // on the unique index rather than quietly adding a third.
      // Take myself off a child's record.
      //
      // A parent can only ever remove THEIR OWN link — the swimmer, the other
      // adult and everything the club holds are untouched. That makes this
      // safe to hand to parents: the worst case is someone removing themselves
      // from their own child, which they can undo by claiming again if nobody
      // else has.
      //
      // It is also the repair for the mistake this app made easy for one
      // morning. A parent who has tagged the wrong child can put it right
      // themselves, immediately, instead of waiting on a coordinator — and the
      // moment they do, the child becomes claimable by the parent it belongs
      // to, because a swimmer nobody holds is the only kind that can be
      // claimed.
      DELETE: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.parentId) return json({ error: "Not signed in" }, 401);
          const b = await request.json().catch(() => ({}));
          const swimmerId = String(b?.swimmerId ?? "");
          if (!swimmerId) return json({ error: "swimmerId required" }, 400);

          const gone = await one<{ name: string }>(
            `delete from public.swimmer_parents sp
              using public.swimmers sw
              where sw.id = sp.swimmer_id
                and sp.swimmer_id = $1
                and sp.parent_id = $2
             returning sw.name`,
            [swimmerId, s.parentId],
          );
          if (!gone) return json({ error: "That swimmer is not on your account" }, 404);

          await note("swimmer_unlinked", {
            email: s.email, parentId: s.parentId,
            detail: `removed ${gone.name} from their own account`,
          });
          return json({ ok: true, name: gone.name });
        } catch (err) {
          return fail("DELETE /api/me/link", err, "Could not remove that swimmer");
        }
      },

      POST: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.parentId) return json({ error: "Not signed in" }, 401);
          const b = await request.json().catch(() => ({}));
          const swimmerId = String(b?.swimmerId ?? "");
          if (!swimmerId) return json({ error: "swimmerId required" }, 400);

          // Every link counts towards the cap now that none of them wait.
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

          // A swimmer anybody else already holds cannot be claimed here, not
          // even up to the two-adult limit. The limit was never the thing being
          // protected — a parent self-claiming a child another family has
          // already registered is, and no check on the claimer's side can tell
          // the household's second adult from a mistake. The second adult is
          // added by a coordinator, who can.
          const others = held.filter((h) => h.status !== "rejected" && h.parent_id !== s.parentId);
          if (others.length > 0) {
            return json(
              {
                error:
                  "That swimmer is already on another parent's account. If you are their " +
                  "other parent or guardian, ask a club coordinator to add you.",
              },
              409,
            );
          }

          const slot = held.some((h) => h.sort_order === 1) ? 2 : 1;

          // Live immediately, and stamped as self-claimed so the record still
          // says where the link came from rather than implying a coordinator
          // looked at it.
          const row = await one(
            `insert into public.swimmer_parents
               (swimmer_id, parent_id, sort_order, status, decided_at, decided_note)
             values ($1, $2, $3, 'approved', now(), 'self-claimed at registration')
             returning *`,
            [swimmerId, s.parentId, slot],
          );

          await note("swimmer_claimed", {
            email: s.email, parentId: s.parentId, detail: `swimmer ${swimmerId}`,
          });

          // Tell the coordinators. A claim nobody looks at is a parent locked
          // out, so this is not optional — but a mail failure must not undo a
          // claim the parent has already made, so it cannot throw.
          try {
            const ctx = await one<{
              swimmer: string;
              parent_name: string;
              parent_phone: string;
              reg_phones: string[] | null;
            }>(
              `select sw.name as swimmer,
                      coalesce(p.full_name, p.email, 'A parent') as parent_name,
                      coalesce(p.phone,'') as parent_phone,
                      array_remove(array[r.primary_phone, r.secondary_phone], null) as reg_phones
                 from public.swimmers sw
                 join public.parents p on p.id = $2
                 left join public.registrations r on r.swimmer_id = sw.id
                where sw.id = $1`,
              [swimmerId, s.parentId],
            );
            if (ctx) {
              const d = (x: string) => (normalizeKePhone(x) || x || "").replace(/\D/g, "").slice(-9);
              const mine = d(ctx.parent_phone);
              await sendClaimNotice(adminEmails(), {
                parentName: ctx.parent_name,
                parentEmail: s.email,
                swimmer: ctx.swimmer,
                phoneMatch: !!mine && (ctx.reg_phones ?? []).some((p) => d(p) === mine),
              });
            }
          } catch {
            /* the claim stands whether or not the notice went out */
          }

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
