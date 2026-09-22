import { useEffect, useState } from "react";

// Who is getting in, and who is not.
//
// Built because there was no way to answer that except by asking a parent. It
// is an operational log, not analytics: the sign-in and registration path
// only, no page views, no IP addresses, no third party, nothing that needed a
// change to what parents have consented to.
//
// The part worth reading first is "asked for a code but never signed in" —
// that is a parent locked out, and it is the only list here that needs
// somebody to pick up a phone.

type Row = { id: string; kind: string; email: string | null; detail: string | null;
             ok: boolean; created_at: string; parent_name: string | null };
type Total = { kind: string; ok: boolean; n: number };
type Stuck = { email: string; asked: string; tries: number };
type Payload = { days: number; rows: Row[]; totals: Total[]; people: number; stuck: Stuck[] };

const LABEL: Record<string, string> = {
  code_requested: "asked for a code",
  code_undelivered: "code did NOT send",
  code_wrong: "wrong or expired code",
  signed_in: "signed in",
  registration_done: "finished registering",
  consent_given: "accepted the consent document",
  swimmer_claimed: "claimed a swimmer",
};

const when = (iso: string) => {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", hour: "2-digit",
                                           minute: "2-digit" });
};

export function ActivityLog() {
  const [days, setDays] = useState(7);
  const [d, setD] = useState<Payload | null>(null);
  const [denied, setDenied] = useState(false);

  const load = (n: number) =>
    fetch(`/api/admin/activity?days=${n}`)
      .then((r) => (r.status === 403 || r.status === 401 ? (setDenied(true), null) : r.json()))
      .then((j) => j && setD(j))
      .catch(() => undefined);

  useEffect(() => { void load(days); }, [days]);

  if (denied) return null;
  if (!d) return <p className="text-sm text-muted-foreground">Loading activity…</p>;

  const tot = (k: string, ok?: boolean) =>
    d.totals.filter((t) => t.kind === k && (ok === undefined || t.ok === ok))
      .reduce((a, t) => a + t.n, 0);

  const undelivered = tot("code_undelivered");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {[1, 7, 30].map((n) => (
          <button key={n} onClick={() => setDays(n)}
            className={`rounded-full border px-3 py-1 text-[13px] font-medium ${
              days === n ? "border-primary bg-primary text-primary-foreground"
                         : "border-border hover:bg-secondary"}`}>
            {n === 1 ? "Today" : `${n} days`}
          </button>
        ))}
        <button onClick={() => void load(days)}
          className="ml-auto text-[13px] text-muted-foreground underline-offset-4 hover:underline">
          Refresh
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { n: d.people, l: "people", d: "distinct addresses" },
          { n: tot("signed_in"), l: "sign-ins", d: "sessions created" },
          { n: tot("registration_done"), l: "registered", d: "finished the form" },
          { n: tot("swimmer_claimed"), l: "swimmers claimed", d: "awaiting approval" },
        ].map((t) => (
          <div key={t.l} className="rounded-xl border border-border bg-card p-4">
            <div className="text-2xl font-semibold tabular-nums">{t.n}</div>
            <div className="text-[13px] font-medium">{t.l}</div>
            <div className="text-[11.5px] text-muted-foreground">{t.d}</div>
          </div>
        ))}
      </div>

      {undelivered > 0 && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-900">
          <b>{undelivered} sign-in {undelivered === 1 ? "code" : "codes"} did not send.</b>{" "}
          Nobody with a failed code can get in. Check the mail credentials and the sending
          domain — the codes are in the server log so no one is stranded.
        </p>
      )}

      {d.stuck.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60">
          <div className="border-b border-amber-200 px-4 py-2.5 text-[13.5px] font-semibold
                          text-amber-900">
            {d.stuck.length} asked for a code and never signed in
          </div>
          <ul className="divide-y divide-amber-200/70">
            {d.stuck.map((s) => (
              <li key={s.email} className="flex flex-wrap items-baseline justify-between gap-2
                                           px-4 py-2 text-[13px]">
                <span className="font-medium text-amber-950">{s.email}</span>
                <span className="font-mono text-[11.5px] text-amber-800">
                  {s.tries} {s.tries === 1 ? "attempt" : "attempts"} · last {when(s.asked)}
                </span>
              </li>
            ))}
          </ul>
          <p className="px-4 py-2.5 text-[12px] leading-relaxed text-amber-900/80">
            Either the code never arrived, or it did and they stopped. Worth a call before they
            give up — this is the list that says who is locked out.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-2.5 text-[13.5px] font-semibold">
          Everything, newest first
          {d.rows.length === 400 && (
            <span className="ml-2 font-normal text-muted-foreground">(latest 400)</span>
          )}
        </div>
        {d.rows.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-muted-foreground">
            Nothing in this period. Sign-ins only started being recorded on 22 September 2026.
          </p>
        ) : (
          <ul className="max-h-[430px] divide-y divide-border overflow-y-auto">
            {d.rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2
                                        text-[13px]">
                <span className={`min-w-0 flex-1 ${r.ok ? "" : "text-rose-700"}`}>
                  <b className="font-medium">{r.parent_name ?? r.email ?? "someone"}</b>{" "}
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
      </div>

      <p className="text-[12px] leading-relaxed text-muted-foreground">
        The sign-in and registration path only. No page views, no IP addresses, no third party —
        so this needed no change to what parents have agreed to. Coordinators only.
      </p>
    </div>
  );
}
