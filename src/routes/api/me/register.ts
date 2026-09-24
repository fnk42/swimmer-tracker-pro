import { createFileRoute } from "@tanstack/react-router";
import { one, json, fail, tx } from "@/lib/db";
import { sessionFromRequest } from "@/lib/session";
import { CONSENT_DOCUMENT, CONSENT_VERSION } from "@/lib/scope";
import { sendParentInvite } from "@/lib/mailer";
import { normalizeKePhone } from "@/lib/phone";
import { adoptPhone } from "@/lib/identity";
import { createSession, cookieHeader } from "@/lib/session";
import { note } from "@/lib/activity";

// Finish registration: profile, an optional second guardian, and consent.
//
// One POST rather than three, because a half-registered account is a support
// problem — a guardian who accepted the consent but whose phone did not save,
// or an invite sent for a profile that was abandoned. It all lands or none of
// it does.
//
// The children a guardian claims are handled by /api/me/link, which is
// separate on purpose: claims carry a status and can be approved or rejected
// later, while this is a one-off.
export const Route = createFileRoute("/api/me/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const s = sessionFromRequest(request);
          if (!s?.parentId) return json({ error: "Not signed in" }, 401);
          let pid = s.parentId;
          let refreshed: string | null = null;

          const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
          const fullName = String(b.fullName ?? "").trim();
          const phone = String(b.phone ?? "").trim();
          const relationship = String(b.relationship ?? "").trim().toLowerCase();
          const consentData = b.consentData === true;
          const consentCommunity = b.consentCommunity === true;
          const second = (b.secondParent ?? null) as { name?: string; email?: string } | null;

          if (fullName.length < 2) return json({ error: "Enter your full name" }, 400);

          // Normalised here, not merely counted. The column insists on the
          // canonical 254XXXXXXXXX form, and a parent types 0712 345 678 — so
          // a digit count that passed validation still failed the constraint,
          // and the guardian was told only "could not finish setting up your
          // account". Returning families never saw it: their number arrives
          // prefilled from a record that is already canonical.
          const phoneOk = normalizeKePhone(phone);
          if (!phoneOk) {
            return json(
              { error: "Enter a Kenyan mobile number we can reach you on, like 0712 345 678" },
              400,
            );
          }
          if (!["mother", "father", "guardian"].includes(relationship)) {
            return json({ error: "Tell us whether you are the mother, father or guardian" }, 400);
          }

          // Both ticks are required and neither is pre-ticked in the UI.
          // Registration cannot finish without them — a brief requirement, and
          // consent that was not actively given is not consent.
          if (!consentData || !consentCommunity) {
            return json(
              { error: "Both boxes need to be ticked before we can finish setting you up" },
              400,
            );
          }

          // A parent must have told us about at least one child. Either they
          // picked one off the roster, or they said who is missing from it —
          // an account with neither is a registration that registers nobody,
          // and that is how four sign-ins produced an empty record.
          const hasChild = await one<{ n: number }>(
            `select (
               (select count(*) from public.swimmer_parents where parent_id = $1) +
               (select count(*) from public.athlete_claim_requests where parent_id = $1)
             )::int as n`,
            [pid],
          );
          if ((hasChild?.n ?? 0) === 0) {
            return json(
              { error: "Add your swimmer, or tell us their name if they are not on the list" },
              400,
            );
          }

          // The number decides which account this is. Signing in from a second
          // address opened a second, empty one — nothing at the door could have
          // known it was the same person — and this is where they say so. If
          // the number already belongs to an account, the two become one and
          // the session follows the survivor.
          const adopted = await adoptPhone(pid, phoneOk);
          if (!adopted.ok) return json({ error: adopted.error }, 400);
          if (adopted.merged) {
            pid = adopted.parentId;
            refreshed = createSession({ email: s.email, parentId: pid, isAdmin: !!s.isAdmin });
          }

          // One connection, one transaction. q() takes an arbitrary
          // connection from the pool, so BEGIN/COMMIT through it would not wrap
          // anything.
          const invited = await tx(async (c) => {
            await c.query(
              `update public.parents
                  set full_name = $2, phone = $3, relationship = $4,
                      profile_complete = true, updated_at = now()
                where id = $1`,
              [pid, fullName, adopted.phone, relationship],
            );

            // Versioned, and a withdrawal is a separate row rather than a
            // delete, so the sequence of what was permitted when survives.
            await c.query(
              `insert into public.consents (parent_id, document, version)
               values ($1, $2, $3)
               on conflict (parent_id, document, version) where withdrawn_at is null
               do nothing`,
              [pid, CONSENT_DOCUMENT, CONSENT_VERSION],
            );

            if (!second?.email || !second?.name) return null;
            const email = String(second.email).trim().toLowerCase();
            const name = String(second.name).trim();
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
            if (email === s.email.toLowerCase()) return null; // inviting yourself

            // A second guardian is a person with their own account, not a name
            // on someone else's record — they consent for themselves.
            const existing = await c.query(`select id from public.parents where lower(email) = $1`, [
              email,
            ]);
            if (existing.rowCount === 0) {
              // phone is NOT NULL with no default, and we do not know this
              // person's number — they give it themselves when they register.
              // Omitting it threw, which rolled back the whole transaction and
              // failed the registration of the guardian who invited them.
              const made = await c.query<{ id: string }>(
                `insert into public.parents (full_name, email, invited_by, phone)
                 values ($1, $2, $3, '')
                 returning id`,
                [name, email, pid],
              );
              if (made.rows[0]) {
                await c.query(
                  `insert into public.parent_emails (email, parent_id) values ($1, $2)
                   on conflict (email) do nothing`,
                  [email, made.rows[0].id],
                );
              }
            }
            return email;
          });

          // Outside the transaction: a mail failure must not undo a
          // registration the guardian has already completed.
          if (invited) await sendParentInvite(invited, fullName).catch(() => {});

          // The two milestones a coordinator actually chases: the form
          // finished, and the current consent document accepted.
          await note("registration_done", { email: s.email, parentId: pid });
          await note("consent_given", {
            email: s.email, parentId: pid,
            detail: `version ${CONSENT_VERSION}`,
          });
          if (refreshed) {
            return new Response(JSON.stringify({ ok: true, invited }), {
              status: 200,
              headers: { "content-type": "application/json",
                         "set-cookie": cookieHeader(refreshed) },
            });
          }
          return json({ ok: true, invited });
        } catch (err) {
          return fail("POST /api/me/register", err, "Could not finish setting up your account");
        }
      },
    },
  },
});
