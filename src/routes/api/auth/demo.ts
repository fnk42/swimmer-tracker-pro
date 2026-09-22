import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";
import { json, fail } from "@/lib/db";
import { createSession, cookieHeader } from "@/lib/session";
import { note } from "@/lib/activity";

// A shared account for people trying the app out, so testers do not each need
// an address added to ADMIN_EMAILS.
//
// OFF UNLESS CONFIGURED. With no DEMO_PASSWORD set this route 404s and the
// link on the landing page does not render, so switching it off after testing
// is one variable, not a deploy.
//
// The password lives in the environment, never in the repository. A shared
// credential on a public URL is only as good as the secret, and a secret in
// git is not one.
//
// Every attempt, right or wrong, goes to the activity log. That is the whole
// safety net: if this is guessed, it is visible in Admin rather than silent.

const ATTEMPTS: number[] = [];
const WINDOW_MS = 10 * 60 * 1000;
const MAX_TRIES = 20;

const sha = (s: string) => createHash("sha256").update(s).digest();

export const Route = createFileRoute("/api/auth/demo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const want = process.env.DEMO_PASSWORD;
          if (!want) return json({ error: "Not found" }, 404);
          const email = (process.env.DEMO_EMAIL ?? "test@nextgen.com").toLowerCase();

          // Crude but effective against guessing: a shared password cannot be
          // locked to an account, so the rate limit is global.
          const now = Date.now();
          while (ATTEMPTS.length && now - ATTEMPTS[0] > WINDOW_MS) ATTEMPTS.shift();
          if (ATTEMPTS.length >= MAX_TRIES) {
            await note("code_wrong", {
              email, ok: false, detail: "demo sign-in rate-limited",
            });
            return json({ error: "Too many attempts. Try again in a few minutes." }, 429);
          }
          ATTEMPTS.push(now);

          const body = (await request.json()) as { password?: string };
          const given = String(body.password ?? "");
          // Hashed first so both sides are a fixed 32 bytes, then compared in
          // constant time — a plain === leaks the password's length and, over
          // enough tries, its prefix.
          const ok = timingSafeEqual(sha(given), sha(want));
          if (!ok) {
            await note("code_wrong", { email, ok: false, detail: "demo password wrong" });
            return json({ error: "That password is wrong." }, 401);
          }

          await note("signed_in", { email, detail: "shared demo account" });
          const token = createSession({ email, isAdmin: true });
          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json", "set-cookie": cookieHeader(token) },
          });
        } catch (err) {
          return fail("POST /api/auth/demo", err, "Could not sign in");
        }
      },

      // Whether the link should appear at all, so the landing page does not
      // advertise a door that is not there.
      GET: async () => json({ enabled: !!process.env.DEMO_PASSWORD }),
    },
  },
});
