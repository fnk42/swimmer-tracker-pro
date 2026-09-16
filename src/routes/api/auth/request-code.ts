import { createFileRoute } from "@tanstack/react-router";
import { q, one, json, fail } from "@/lib/db";
import { newCode, hashCode, isAdminEmail } from "@/lib/session";
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
          const email = String(body?.email ?? "").trim().toLowerCase();
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

          // Coordinators need a code even if they have no child registered.
          // Always answer the same way whether or not the address is known —
          // otherwise this endpoint tells a stranger who is involved.
          if (!parent && !isAdminEmail(email)) return json({ ok: true });

          const code = newCode();
          await q(
            `insert into public.auth_codes (email, code_hash, expires_at)
             values ($1, $2, now() + interval '${TTL_MIN} minutes')`,
            [email, hashCode(email, code)],
          );
          const sent = await sendLoginCode(email, code);

          // The response is deliberately the same shape whether or not the
          // address was known, so this cannot be used to discover who is
          // registered. A delivery failure is an operational problem, not
          // something to tell the caller about — it is logged loudly instead,
          // and the code is written to the server log so nobody is stranded.
          if (!sent.delivered) {
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
