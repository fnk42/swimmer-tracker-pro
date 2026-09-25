import { useEffect, useState } from "react";

// A log of who tried to sign in and who got in. Nothing else.
//
// The first version of this had count tiles and a "locked out" panel worked
// out with a subquery. It was more apparatus than the question deserves: what
// a coordinator wants is to read down a list and see whether parents are
// getting in. A failed attempt is red, so the one case that needs acting on
// still stands out without a panel to announce it.
//
// Admins only, and it holds email addresses, so it is gated on isAdmin.

type Row = {
  id: string;
  kind: string;
  email: string | null;
  detail: string | null;
  ok: boolean;
  created_at: string;
  parent_name: string | null;
};

// What this page is for, in order. Getting in and paying are the things a
// coordinator is asked about on the phone; who is attached to which child is a
// question for a quieter day, so it is kept but not led with.
const LOUD = new Set([
  "code_undelivered",
  "code_wrong",
  "payment_recorded",
  "signed_in",
  "code_requested",
  "registration_done",
  "tester_agreed",
  "tester_registered",
]);

const LABEL: Record<string, string> = {
  payment_recorded: "recorded a payment",
  code_requested: "asked for a sign-in code",
  code_undelivered: "code did NOT send",
  code_wrong: "wrong or expired code",
  signed_in: "signed in",
  registration_done: "finished registering",
  consent_given: "accepted the consent document",
  swimmer_claimed: "claimed a swimmer",
  swimmer_unlinked: "removed a swimmer from their account",
  tester_registered: "registered as a tester",
  tester_agreed: "signed the confidentiality agreement",
  tester_refused: "tried the preview without agreeing",
  tester_feedback: "posted feedback",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function ActivityLog() {
  const [rows, setRows] = useState<Row[] | null>(null);
  // Claims and unlinks still happen and are still recorded; they are just
  // not what this page is opened to check.
  const [showQuiet, setShowQuiet] = useState(false);
  const [denied, setDenied] = useState(false);

  const load = () =>
    fetch("/api/admin/activity")
      .then((r) => (r.status === 401 || r.status === 403 ? (setDenied(true), null) : r.json()))
      .then((j) => j && setRows(j.rows ?? []))
      .catch(() => undefined);

  useEffect(() => {
    void load();
  }, []);

  // Say so rather than vanishing. Rendering nothing on a 403 meant the log
  // simply was not on the page, with no way to tell "you are not a coordinator"
  // apart from "this feature is broken" — which is how it got reported missing.
  if (denied)
    return (
      <div
        className="rounded-xl border border-border bg-card px-4 py-3 text-[13px]
                      text-muted-foreground"
      >
        <b className="font-semibold text-foreground">Sign-in log</b> — admins only. This account is
        not on the admin list, so there is nothing to show here.
      </div>
    );
  if (!rows) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const loud = rows.filter((r) => LOUD.has(r.kind));
  const quiet = rows.filter((r) => !LOUD.has(r.kind));
  const shown = showQuiet ? rows : loud;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border px-4 py-2.5">
        <span className="text-[13.5px] font-semibold">
          Signing in &amp; paying
          {!showQuiet && quiet.length > 0 && (
            <span className="ml-2 font-normal text-muted-foreground">
              {quiet.length} quieter entr{quiet.length === 1 ? "y" : "ies"} hidden
            </span>
          )}
        </span>
        <span className="flex gap-3">
          {quiet.length > 0 && (
            <button
              onClick={() => setShowQuiet(!showQuiet)}
              className="text-[12.5px] text-muted-foreground underline-offset-4 hover:underline"
            >
              {showQuiet ? "Hide the rest" : "Show everything"}
            </button>
          )}
          <button
            onClick={() => void load()}
            className="text-[12.5px] text-muted-foreground underline-offset-4 hover:underline"
          >
            Refresh
          </button>
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-muted-foreground">
          Nothing yet. Attempts are recorded from 22 September 2026 onwards.
        </p>
      ) : (
        <ul className="max-h-[520px] divide-y divide-border overflow-y-auto">
          {shown.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2 text-[13px]"
            >
              <span className={`min-w-0 flex-1 ${r.ok ? "" : "text-rose-700"}`}>
                {/* The name a coordinator knows them by, not the address they
                    happen to sign in with. The address still rides along,
                    dimmed: chasing somebody who cannot get in needs it, and a
                    stranger requesting a code has no name to show. */}
                <b className="font-medium">{r.parent_name ?? r.email ?? "someone"}</b>{" "}
                {LABEL[r.kind] ?? r.kind}
                {r.parent_name && r.email ? (
                  <span className="text-muted-foreground"> · {r.email}</span>
                ) : null}
                {r.detail ? <span className="text-muted-foreground"> · {r.detail}</span> : null}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {when(r.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p
        className="border-t border-border px-4 py-2.5 text-[12px] leading-relaxed
                    text-muted-foreground"
      >
        Sign-in and registration attempts only — no page views, no IP addresses, no third party. Red
        is a failed attempt.
      </p>
    </div>
  );
}
