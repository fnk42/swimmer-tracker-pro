import { createFileRoute } from "@tanstack/react-router";
import { q, one, json, fail } from "@/lib/db";
import { newCode, hashCode } from "@/lib/session";
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

          // Always answer the same way whether or not the address is known —
          // otherwise this endpoint tells a stranger which parents exist.
          if (!parent) return json({ ok: true });

          const code = newCode();
          await q(
            `insert into public.auth_codes (email, code_hash, expires_at)
             values ($1, $2, now() + interval '${TTL_MIN} minutes')`,
            [email, hashCode(email, code)],
          );
          const sent = await sendLoginCode(email, code);

          return json({
            ok: true,
            // Only ever true in local development, where the code is printed
            // to the server console instead of being emailed.
            devMode: sent.via === "console" ? true : undefined,
          });
        } catch (err) {
          return fail("POST /api/auth/request-code", err, "Could not send a code");
        }
      },
    },
  },
});
