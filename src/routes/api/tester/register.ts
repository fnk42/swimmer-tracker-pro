import { createFileRoute } from "@tanstack/react-router";
import { one, q, json, fail } from "@/lib/db";
import { newCode, hashCode, sessionFromRequest } from "@/lib/session";
import { sendLoginCode } from "@/lib/mailer";
import { note } from "@/lib/activity";

const TTL_MIN = 10;

// Sign up to look at the preview.
//
// Creating the row grants nothing. Access is the signed agreement plus an
// unexpired date, both checked in lib/scope on every request — so somebody who
// registers and never reads the agreement sees exactly what a stranger sees.
export const Route = createFileRoute("/api/tester/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const b = await request.json().catch(() => ({}));
          const email = String(b?.email ?? "")
            .trim()
            .toLowerCase();
          const fullName = String(b?.fullName ?? "").trim();
          const howKnown = String(b?.howKnown ?? "")
            .trim()
            .slice(0, 200);

          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            return json({ error: "Enter a valid email address" }, 400);
          }
          if (fullName.length < 2) return json({ error: "Enter your name" }, 400);

          // Registering twice is signing in again, not an error — people lose
          // the email and start over.
          const tester = await one<{ id: string }>(
            `insert into public.testers (email, full_name, how_known)
             values ($1, $2, $3)
             on conflict (lower(email)) do update
               set full_name = case when public.testers.full_name = ''
                                    then excluded.full_name
                                    else public.testers.full_name end
             returning id`,
            [email, fullName, howKnown],
          );

          // They may already be signed in — they gave us a code a moment ago
          // and it turned out there was no tester row to find. Sending a
          // second one to the address they are reading this on is asking them
          // to prove again what they just proved.
          const s = sessionFromRequest(request);
          if (s && s.email.toLowerCase() === email) {
            await note("tester_registered", { email, detail: fullName });
            return json({ ok: true, testerId: tester?.id, signedIn: true });
          }

          const code = newCode();
          await q(
            `insert into public.auth_codes (email, code_hash, expires_at)
             values ($1, $2, now() + interval '${TTL_MIN} minutes')`,
            [email, hashCode(email, code)],
          );
          const sent = await sendLoginCode(email, code);

          await note("tester_registered", { email, detail: fullName });
          if (!sent.delivered) {
            await note("code_undelivered", {
              email,
              ok: false,
              detail: `tester, via ${sent.via}`,
            });
            console.error(`[tester] code for ${email} NOT delivered (${sent.via})`);
          }
          return json({ ok: true, testerId: tester?.id, devMode: !sent.delivered || undefined });
        } catch (err) {
          return fail("POST /api/tester/register", err, "Could not register you");
        }
      },
    },
  },
});
