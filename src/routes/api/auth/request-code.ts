import { createFileRoute } from "@tanstack/react-router";
import { q, one, json, fail } from "@/lib/db";
import { newCode, hashCode, isAdminEmail, sessionFromRequest } from "@/lib/session";
import { note } from "@/lib/activity";
import { sendLoginCode } from "@/lib/mailer";

const WINDOW_MIN = 15;
const MAX_PER_WINDOW = 3;
const TTL_MIN = 10;

export const Route = createFileRoute("/api/auth/request-code")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const email = String(body?.email ?? "")
            .trim()
            .toLowerCase();
          if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            return json({ error: "Enter a valid email address" }, 400);
          }

          // Too many requests for this address recently? Stop, but say the same
          // thing we always say, so this cannot be used to probe for addresses.
          const recent = await one<{ n: number }>(
            `select count(*)::int n from public.auth_codes
             where lower(email) = $1 and created_at > now() - interval '${WINDOW_MIN} minutes'`,
            [email],
          );
          if ((recent?.n ?? 0) >= MAX_PER_WINDOW) {
            return json({ ok: true, throttled: true });
          }

          const parent = await one<{ id: string }>(
            `select id from public.parents where lower(email) = $1`,
            [email],
          );

          // EVERY address gets a code, known to the club or not.
          //
          // It used to be only the addresses already in `parents`. That meant a
          // parent the club had no record of — or had under their spouse's
          // address — was told a code was on its way and then sat waiting for
          // an email that was never generated, which is how a family missed
          // paying for the Nationals. Being told nothing is worse than the club
          // roster being guessable.
          //
          // Holding the door open is safe because the door is not the guard:
          // the account a stranger reaches is empty, claiming a swimmer is
          // PENDING until a coordinator approves it (api/me/link), and no named
          // result is served before that approval (lib/scope). What they can do
          // is identify themselves and claim their own child, which is the
          // point.
          // Nobody needs two codes in one sitting. If this session already
          // belongs to the address being asked about, they proved it minutes
          // ago — sending another only invalidates the one they are holding,
          // which is how a working sign-in turns into "that code is wrong".
          const live = sessionFromRequest(request);
          if (live && live.email.toLowerCase() === email) {
            return json({ ok: true, signedIn: true });
          }

          const code = newCode();
          await q(
            `insert into public.auth_codes (email, code_hash, expires_at)
             values ($1, $2, now() + interval '${TTL_MIN} minutes')`,
            [email, hashCode(email, code)],
          );
          const sent = await sendLoginCode(email, code);
          await note("code_requested", {
            email,
            parentId: parent?.id ?? null,
            // Flagged so the coordinator can see first-timers arriving in the
            // sign-in log, and chase anyone who stalls before claiming a child.
            detail: parent || isAdminEmail(email) ? undefined : "first time — no record yet",
          });

          // A delivery failure is an operational problem, not something to
          // tell the caller about — it is logged loudly instead, and the code
          // is written to the server log so nobody is stranded.
          if (!sent.delivered) {
            await note("code_undelivered", {
              email,
              parentId: parent?.id ?? null,
              ok: false,
              detail: `via ${sent.via}${sent.error ? `: ${sent.error}` : ""}`,
            });
            console.error(
              `[auth] code generated for ${email} but NOT delivered ` +
                `(via ${sent.via}${sent.error ? `, ${sent.error}` : ""}). ` +
                `Check RESEND_API_KEY and that the sending domain is verified.`,
            );
          }
          return json({ ok: true, devMode: !sent.delivered ? true : undefined });
        } catch (err) {
          return fail("POST /api/auth/request-code", err, "Could not send a code");
        }
      },
    },
  },
});
