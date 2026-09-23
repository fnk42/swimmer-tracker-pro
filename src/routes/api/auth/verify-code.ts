import { createFileRoute } from "@tanstack/react-router";
import { one, q, json, fail } from "@/lib/db";
import { hashCode, createSession, cookieHeader, isAdminEmail } from "@/lib/session";
import { note } from "@/lib/activity";

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
            await note("code_wrong", { email, ok: false });
            return json({ error: "That code is wrong or has expired" }, 401);
          }

          // Resolved through parent_emails, not parents.email: one parent may
          // sign in from any address they have ever used.
          let parent = await one<{ id: string; full_name: string; email: string }>(
            `select p.id, p.full_name, p.email
               from public.parent_emails pe
               join public.parents p on p.id = pe.parent_id
              where pe.email = $1`,
            [email],
          );
          const admin = isAdminEmail(email);

          // An invited tester. Looked up before the parent row is created,
          // because a tester has no child and must not be handed an empty
          // parent account — that is the Events side, which is not theirs.
          const tester = await one<{ id: string }>(
            `select id from public.testers
              where lower(email) = $1 and revoked_at is null`,
            [email],
          );
          if (tester && !parent && !admin) {
            await q(`update public.auth_codes set consumed_at = now() where id = $1`, [row.id]);
            const token = createSession({ email, testerId: tester.id, isAdmin: false });
            await note("signed_in", { email, detail: "tester" });
            return new Response(
              JSON.stringify({ ok: true, isAdmin: false, isTester: true, parent: null }),
              {
                status: 200,
                headers: {
                  "content-type": "application/json",
                  "set-cookie": cookieHeader(token),
                },
              },
            );
          }

          // First time this address has proved it owns its own inbox: open an
          // empty account for it rather than turning it away. Name and phone
          // are deliberately blank, which is precisely what viewer() reads as
          // needsProfile — so the very next page they see is /welcome, where
          // they say who they are and search for their child.
          //
          // The row is worth nothing on its own. It holds no claim on any
          // swimmer, and until a coordinator approves one it never will.
          const firstTime = !parent && !admin && !tester;
          if (firstTime) {
            parent = await one<{ id: string; full_name: string; email: string }>(
              `insert into public.parents (email, full_name, phone, profile_complete)
               values ($1, '', '', false)
               on conflict do nothing
               returning id, full_name, email`,
              [email],
            );
            // Lost a race with another tab signing in at the same moment.
            if (!parent) {
              parent = await one<{ id: string; full_name: string; email: string }>(
                `select id, full_name, email from public.parents where lower(email) = $1`,
                [email],
              );
            }
            // The address itself, so this account is reachable from it again —
            // and so it survives being folded into another by phone number.
            if (parent) {
              await q(
                `insert into public.parent_emails (email, parent_id) values ($1, $2)
                 on conflict (email) do nothing`,
                [email, parent.id],
              );
            }
          }

          await q(`update public.auth_codes set consumed_at = now() where id = $1`, [row.id]);

          const token = createSession({
            email,
            parentId: parent?.id,
            isAdmin: admin,
          });
          await note("signed_in", {
            email, parentId: parent?.id ?? null,
            detail: admin ? "admin" : firstTime ? "parent — first time" : "parent",
          });
          return new Response(
            JSON.stringify({
              ok: true,
              isAdmin: admin,
              firstTime,
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
