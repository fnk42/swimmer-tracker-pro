import { createFileRoute } from "@tanstack/react-router";
import { one } from "@/lib/db";

// Deployment self-check. Reports whether each piece of configuration is
// PRESENT and whether the database answers — never any value, so this is safe
// to hit from a browser while diagnosing a deploy.
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const config = {
          DATABASE_URL: !!process.env.DATABASE_URL,
          SESSION_SECRET: !!process.env.SESSION_SECRET,
          SESSION_SECRET_long_enough: (process.env.SESSION_SECRET ?? "").length >= 32,
          ADMIN_EMAILS: !!process.env.ADMIN_EMAILS,
          ADMIN_EMAILS_count: (process.env.ADMIN_EMAILS ?? "")
            .split(",").map((s) => s.trim()).filter(Boolean).length,
          // Who is emailed when a parent links a swimmer. Unset means
          // everyone with the coordinator view, which is the old behaviour.
          NOTIFY_EMAILS_set: process.env.NOTIFY_EMAILS !== undefined,
          NOTIFY_EMAILS_count: (process.env.NOTIFY_EMAILS ?? process.env.ADMIN_EMAILS ?? "")
            .split(",").map((s) => s.trim()).filter(Boolean).length,
          RESEND_API_KEY: !!process.env.RESEND_API_KEY,
          MAIL_FROM: process.env.MAIL_FROM ?? "(unset — will use resend.dev)",
        };

        let database: Record<string, unknown> = { reachable: false };
        try {
          const r = await one<{ n: number }>(`select count(*)::int n from public.swimmers`);
          database = { reachable: true, swimmers: r?.n ?? 0 };
        } catch (err) {
          database = {
            reachable: false,
            // The message only, never the connection string.
            reason: err instanceof Error ? err.message.slice(0, 200) : "unknown",
          };
        }

        const ok =
          config.DATABASE_URL &&
          config.SESSION_SECRET_long_enough &&
          config.ADMIN_EMAILS &&
          config.RESEND_API_KEY &&
          database.reachable;

        return new Response(JSON.stringify({ ok, config, database }, null, 2), {
          status: ok ? 200 : 503,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
