import { useEffect, useState } from "react";

// A log of who tried to sign in and who got in. Nothing else.
//
// The first version of this had count tiles and a "locked out" panel worked
// out with a subquery. It was more apparatus than the question deserves: what
// a coordinator wants is to read down a list and see whether parents are
// getting in. A failed attempt is red, so the one case that needs acting on
// still stands out without a panel to announce it.
//
// Coordinators only, and it holds email addresses, so it is gated on isAdmin.

type Row = {
  id: string; kind: string; email: string | null; detail: string | null;
  ok: boolean; created_at: string; parent_name: string | null;
};

const LABEL: Record<string, string> = {
  code_requested: "asked for a sign-in code",
  code_undelivered: "code did NOT send",
  code_wrong: "wrong or expired code",
  signed_in: "signed in",
  registration_done: "finished registering",
  consent_given: "accepted the consent document",
  swimmer_claimed: "claimed a swimmer",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

export function ActivityLog() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [denied, setDenied] = useState(false);

  const load = () =>
    fetch("/api/admin/activity")
      .then((r) => (r.status === 401 || r.status === 403 ? (setDenied(true), null) : r.json()))
      .then((j) => j && setRows(j.rows ?? []))
      .catch(() => undefined);

  useEffect(() => { void load(); }, []);

  // Say so rather than vanishing. Rendering nothing on a 403 meant the log
  // simply was not on the page, with no way to tell "you are not a coordinator"
  // apart from "this feature is broken" — which is how it got reported missing.
  if (denied)
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-[13px]
                      text-muted-foreground">
        <b className="font-semibold text-foreground">Sign-in log</b> — coordinators only. This
        account is not on the coordinator list, so there is nothing to show here.
      </div>
    );
  if (!rows) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-2.5">
        <span className="text-[13.5px] font-semibold">Sign-in log</span>
        <button onClick={() => void load()}
          className="text-[12.5px] text-muted-foreground underline-offset-4 hover:underline">
          Refresh
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-muted-foreground">
          Nothing yet. Attempts are recorded from 22 September 2026 onwards.
        </p>
      ) : (
        <ul className="max-h-[520px] divide-y divide-border overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2 text-[13px]">
              <span className={`min-w-0 flex-1 ${r.ok ? "" : "text-rose-700"}`}>
                <b className="font-medium">{r.email ?? r.parent_name ?? "someone"}</b>{" "}
                {LABEL[r.kind] ?? r.kind}
                {r.detail ? <span className="text-muted-foreground"> · {r.detail}</span> : null}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {when(r.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="border-t border-border px-4 py-2.5 text-[12px] leading-relaxed
                    text-muted-foreground">
        Sign-in and registration attempts only — no page views, no IP addresses, no third party.
        Red is a failed attempt.
      </p>
    </div>
  );
}
