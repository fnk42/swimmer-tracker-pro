import { createFileRoute } from "@tanstack/react-router";
import { one, q, json, fail } from "@/lib/db";
import { hashCode, createSession, cookieHeader, isAdminEmail } from "@/lib/session";

const MAX_ATTEMPTS = 5;

export const Route = createFileRoute("/api/auth/verify-code")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json().catch(() => ({}));
          const email = String(body?.email ?? "").trim().toLowerCase();
          const code = String(body?.code ?? "").trim();
          if (!email || !/^\d{6}$/.test(code)) {
            return json({ error: "Enter the 6-digit code from your email" }, 400);
          }

          const row = await one<{ id: string; attempts: number }>(
            `select id, attempts from public.auth_codes
             where lower(email) = $1
               and code_hash = $2
               and consumed_at is null
               and expires_at > now()
               and attempts < $3
             order by created_at desc limit 1`,
            [email, hashCode(email, code), MAX_ATTEMPTS],
          );

          if (!row) {
            // Count the failure against the newest outstanding code for this
            // address, so guessing runs out of attempts rather than forever.
            await q(
              `update public.auth_codes set attempts = attempts + 1
               where id = (select id from public.auth_codes
                           where lower(email) = $1 and consumed_at is null
                             and expires_at > now()
                           order by created_at desc limit 1)`,
              [email],
            );
            return json({ error: "That code is wrong or has expired" }, 401);
          }

          const parent = await one<{ id: string; full_name: string; email: string }>(
            `select id, full_name, email from public.parents where lower(email) = $1`,
            [email],
          );
          const admin = isAdminEmail(email);
          if (!parent && !admin) {
            return json({ error: "No record for that address" }, 403);
          }

          await q(`update public.auth_codes set consumed_at = now() where id = $1`, [row.id]);

          const token = createSession({
            email,
            parentId: parent?.id,
            isAdmin: admin,
          });
          return new Response(
            JSON.stringify({
              ok: true,
              isAdmin: admin,
              parent: parent ? { id: parent.id, fullName: parent.full_name } : null,
            }),
            {
              status: 200,
              headers: {
                "content-type": "application/json",
                "set-cookie": cookieHeader(token),
              },
            },
          );
        } catch (err) {
          return fail("POST /api/auth/verify-code", err, "Could not verify that code");
        }
      },
    },
  },
});
