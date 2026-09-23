import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/feedback")({ component: FeedbackBoard });

// The testers' shared board.
//
// Everyone testing reads every item, with names on it. That is deliberate: it
// stops five people filing the same bug, and a name against a comment keeps it
// civil. It is a different thing from the roadmap's comments, which are the
// coordinators' own working notes.
type Row = {
  id: string; author: string; kind: string; body: string; route: string;
  context: string; status: string; reply: string | null; replied_by: string | null;
  created_at: string; agrees: number; mine: boolean;
};

const KINDS: { id: string; label: string; tone: string }[] = [
  { id: "broken", label: "Something is broken", tone: "rose" },
  { id: "confusing", label: "Confusing", tone: "amber" },
  { id: "idea", label: "Idea", tone: "cyan" },
];

const KIND_STYLE: Record<string, string> = {
  broken: "bg-rose-500/15 text-rose-300 border-rose-400/35",
  confusing: "bg-amber-400/15 text-amber-300 border-amber-400/35",
  idea: "bg-cyan-400/15 text-cyan-300 border-cyan-400/35",
};
const STATUS_STYLE: Record<string, string> = {
  open: "bg-white/10 text-white/65",
  seen: "bg-white/10 text-white/80",
  fixed: "bg-cyan-400/15 text-cyan-300",
  wontfix: "bg-white/10 text-white/45",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

function FeedbackBoard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [canModerate, setCanModerate] = useState(false);
  const [kind, setKind] = useState("broken");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTester, setIsTester] = useState(false);

  const load = () =>
    fetch("/api/tester/feedback")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setRows(d.rows ?? []); setCanModerate(!!d.canModerate); } })
      .catch(() => undefined);

  useEffect(() => {
    void load();
    fetch("/api/tester/me").then((r) => r.json())
      .then((d) => setIsTester(!!d?.isTester)).catch(() => undefined);
  }, []);

  async function post() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/tester/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, body, route: document.referrer || "/tracker" }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? "Could not post that."); return; }
      setBody("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleAgree(row: Row) {
    await fetch("/api/tester/feedback", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: row.id, agree: !row.mine }),
    });
    await load();
  }

  async function setStatus(row: Row, status: string) {
    await fetch("/api/tester/feedback", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: row.id, status }),
    });
    await load();
  }

  return (
    <div className="ng-sora relative flex min-h-screen flex-col">
      <div className="ng-water" aria-hidden />
      <div className="ng-caustics" aria-hidden />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-16 pt-9">
        <div className="mb-7 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-[25px] font-semibold text-white">Tester feedback</h1>
          <a href="/tracker" className="text-[13.5px] text-[var(--ng-cyan)] underline-offset-4 hover:underline">
            back to the analytics
          </a>
          <span className="flex-1" />
          {rows && (
            <span className="text-[12.5px] text-white/45">
              {rows.length} item{rows.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-[380px_1fr]">
          {isTester ? (
            <div className="ng-panel h-fit p-5">
              <h2 className="text-[16px] font-semibold text-white">Tell us what you think</h2>
              <p className="mb-4 mt-1 text-[13px] leading-relaxed text-white/60">
                Everyone testing sees everyone's feedback, with names. If someone has already said
                it, agree with theirs instead of filing it twice.
              </p>

              <p className="ng-label">What kind?</p>
              <div className="mb-4 mt-1.5 flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <button key={k.id} type="button" onClick={() => setKind(k.id)}
                          className={
                            "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors " +
                            (kind === k.id ? KIND_STYLE[k.id] : "border-white/18 text-white/60 hover:text-white")
                          }>
                    {k.label}
                  </button>
                ))}
              </div>

              <label className="ng-label" htmlFor="fb-body">What happened?</label>
              <textarea id="fb-body" rows={5} className="ng-field resize-none" value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="The age-group chart still says 2022 after I set the span to 2024–2026." />

              {error && <p className="mt-2 text-sm font-medium text-[#FFC24B]">{error}</p>}

              <button type="button" className="ng-btn ng-btn-primary mt-4 w-full"
                      disabled={busy || body.trim().length < 4} onClick={() => void post()}>
                {busy ? "Posting…" : "Post to the board"}
              </button>
              <p className="mt-3 text-[11.5px] leading-relaxed text-white/40">
                Never paste a child's name into feedback. Say "the 11–12 chart", not who is on it.
              </p>
            </div>
          ) : (
            <div className="ng-panel h-fit p-5 text-[13px] leading-relaxed text-white/60">
              You are reading the testers' board. Only testers can post to it.
            </div>
          )}

          <div className="flex flex-col gap-3">
            {!rows && <p className="text-sm text-white/50">Loading…</p>}
            {rows?.length === 0 && (
              <p className="ng-panel p-5 text-[13.5px] text-white/60">
                Nothing yet. The first person to find something odd gets to name it.
              </p>
            )}
            {rows?.map((r) => (
              <article key={r.id} className="ng-panel p-4">
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={"rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide " + KIND_STYLE[r.kind]}>
                    {r.kind === "broken" ? "Broken" : r.kind === "confusing" ? "Confusing" : "Idea"}
                  </span>
                  <strong className="text-[13.5px] text-white">{r.author}</strong>
                  <span className="text-[12px] text-white/40">
                    {r.route ? `${r.route} · ` : ""}{when(r.created_at)}
                  </span>
                  <span className="flex-1" />
                  <span className={"rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase " + STATUS_STYLE[r.status]}>
                    {r.status}
                  </span>
                </div>

                <p className="whitespace-pre-line text-[13.8px] leading-relaxed text-white/85">{r.body}</p>

                {r.reply && (
                  <div className="mt-3 rounded-lg border border-[var(--ng-electric)]/30 bg-[var(--ng-electric)]/10 p-3">
                    <p className="text-[12px] font-semibold text-[var(--ng-cyan)]">
                      {r.replied_by ?? "The club"} replied
                    </p>
                    <p className="mt-1 whitespace-pre-line text-[13.2px] leading-relaxed text-white/80">
                      {r.reply}
                    </p>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3 text-[12.5px]">
                  {isTester && (
                    <button type="button" onClick={() => void toggleAgree(r)}
                            className={"rounded-full border px-3 py-1 font-medium transition-colors " +
                              (r.mine ? "border-[var(--ng-cyan)]/50 bg-[var(--ng-cyan)]/12 text-[var(--ng-cyan)]"
                                      : "border-white/18 text-white/55 hover:text-white")}>
                      ▲ {r.mine ? "You agree" : "Same here"}
                    </button>
                  )}
                  <span className="text-white/45">
                    {r.agrees} {r.agrees === 1 ? "person agrees" : "agree"}
                  </span>
                  <span className="flex-1" />
                  {canModerate && (
                    <span className="flex gap-1.5">
                      {["seen", "fixed", "wontfix"].map((st) => (
                        <button key={st} type="button" onClick={() => void setStatus(r, st)}
                                className="rounded-md border border-white/18 px-2 py-1 text-[11.5px]
                                           text-white/60 hover:text-white">
                          {st}
                        </button>
                      ))}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
