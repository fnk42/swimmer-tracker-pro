import { useEffect, useState } from "react";

// Who is in the preview, and the power to end it.
//
// Registering is not access: `agreed` is what lib/scope checks, so a row with
// "not signed" against it is a person who has seen nothing. That distinction is
// the one a coordinator most needs at a glance, so it is the loud column.
type Tester = {
  id: string; email: string; full_name: string; how_known: string;
  agreed_at: string | null; expires_at: string; revoked_at: string | null;
  last_seen_at: string | null; created_at: string;
  feedback: number; sign_ins: number;
};

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "—";

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
};

export function TesterPanel() {
  const [rows, setRows] = useState<Tester[] | null>(null);
  const [denied, setDenied] = useState(false);

  const load = () =>
    fetch("/api/admin/testers")
      .then((r) => (r.status === 401 || r.status === 403 ? (setDenied(true), null) : r.json()))
      .then((j) => j && setRows(j.rows ?? []))
      .catch(() => undefined);

  useEffect(() => { void load(); }, []);

  async function revoke(t: Tester, on: boolean) {
    await fetch("/api/admin/testers", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: t.id, revoke: on }),
    });
    await load();
  }

  if (denied || !rows) return null;

  const signed = rows.filter((r) => r.agreed_at && !r.revoked_at).length;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-4 py-2.5">
        <span className="text-[13.5px] font-semibold">Analytics preview — testers</span>
        <span className="text-[12.5px] text-muted-foreground">
          {rows.length} registered · {signed} with access
        </span>
        <span className="flex-1" />
        <button onClick={() => void navigator.clipboard?.writeText(`${location.origin}/tester`)}
                className="text-[12.5px] text-muted-foreground underline-offset-4 hover:underline">
          Copy the invite link
        </button>
        <button onClick={() => void load()}
                className="text-[12.5px] text-muted-foreground underline-offset-4 hover:underline">
          Refresh
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-muted-foreground">
          Nobody yet. Share <code className="rounded bg-secondary px-1 py-0.5">/tester</code> with
          the people you want looking at the analytics.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((t) => {
            const expired = new Date(t.expires_at).getTime() < Date.now();
            const out = !!t.revoked_at || expired || !t.agreed_at;
            return (
              <li key={t.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]">
                <span className="min-w-0 flex-1">
                  <b className="font-medium">{t.full_name || t.email}</b>{" "}
                  <span className="text-muted-foreground">{t.email}</span>
                  {t.how_known && (
                    <span className="block text-[12px] text-muted-foreground">{t.how_known}</span>
                  )}
                </span>
                <span className={out ? "font-medium text-amber-700" : "text-emerald-700"}>
                  {t.revoked_at
                    ? "revoked"
                    : expired
                      ? "expired"
                      : t.agreed_at
                        ? `signed ${day(t.agreed_at)}`
                        : "not signed — no access"}
                </span>
                <span className="text-muted-foreground">{t.sign_ins} sign-ins</span>
                <span className="text-muted-foreground">{t.feedback} feedback</span>
                <span className="font-mono text-[11px] text-muted-foreground">{ago(t.last_seen_at)}</span>
                <button onClick={() => void revoke(t, !t.revoked_at)}
                        className="text-[12.5px] text-muted-foreground underline-offset-4 hover:text-destructive hover:underline">
                  {t.revoked_at ? "Restore" : "Revoke"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="border-t border-border px-4 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
        Access needs a signed agreement and ends 30 September 2026. Revoking takes effect on their
        next click. Their sign-ins appear in the log above; what they said is on the{" "}
        <a href="/feedback" className="underline underline-offset-2">feedback board</a>.
      </p>
    </div>
  );
}
