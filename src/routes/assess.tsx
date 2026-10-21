import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMe } from "@/lib/api";
import {
  AREAS,
  areaById,
  pointsOf,
  report,
  type AssessmentBody,
  type Pick,
  type Point,
  type Side,
} from "@/lib/assessment-template";

// The coaches' assessment form (Felix, 21 Oct 2026).
//
// The same look as the Nationals registration form — water, glass panels, a
// three-step bar — with gold in place of electric blue as the accent, so a
// coach can tell at a glance this is the coaches' side. Gold marks the step,
// the chosen options and the save button; the page itself stays navy.
//
// The coach picks one answer per technique point from a short dropdown, or
// searches for the point ("elbow", "head"); the words come from the
// framework, so two coaches who see the same thing write the same sentence.

type Search = { name?: string; id?: string };

export const Route = createFileRoute("/assess")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    name: typeof s.name === "string" ? s.name : undefined,
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: AssessPage,
});

const GOLD = "var(--ng-gold)";
const STEPS = ["what", "marks", "finish"] as const;
type Step = (typeof STEPS)[number];
const TITLE: Record<Step, string> = {
  what: "The swimmer and the stroke",
  marks: "What you saw",
  finish: "Priorities and summary",
};

const today = () => new Date().toISOString().slice(0, 10);

function AssessPage() {
  const search = Route.useSearch();
  const me = useMe();
  // Private for now: the server says who may use it (ASSESSMENT_EMAILS).
  const probe = useQuery({
    queryKey: ["assess-probe"],
    enabled: !!me.data?.signedIn,
    queryFn: async () => (await fetch("/api/coach/assessments?probe=1")).ok,
  });
  const coach = (!!me.data?.isAdmin || !!me.data?.isCoach) && probe.data === true;

  const [step, setStep] = useState<Step>("what");
  const [id, setId] = useState<string | undefined>(search.id);
  const [name, setName] = useState(search.name ?? "");
  const [area, setArea] = useState("");
  const [filmedOn, setFilmedOn] = useState(today());
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [find, setFind] = useState("");
  const [priorities, setPriorities] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ shared: boolean } | null>(null);

  const swimmers = useQuery({
    queryKey: ["assess-swimmers"],
    enabled: coach,
    queryFn: async () => {
      const r = await fetch("/api/swimmers?all=1");
      if (!r.ok) return [] as string[];
      const rows = (await r.json()) as { analytics_name: string | null }[];
      return [...new Set(rows.map((x) => x.analytics_name).filter(Boolean) as string[])].sort();
    },
  });

  // Editing an existing one: load it once.
  useEffect(() => {
    if (!search.id || !coach) return;
    fetch("/api/coach/assessments?id=" + encodeURIComponent(search.id))
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => {
        if (!a?.body) return;
        const b = a.body as AssessmentBody;
        setName(a.name);
        setArea(b.area);
        setFilmedOn(b.filmedOn);
        setPicks(b.picks ?? {});
        setPriorities(b.priorities);
        setNote(b.note);
      })
      .catch(() => {});
  }, [search.id, coach]);

  const A = areaById(area);
  const body: AssessmentBody = { area, filmedOn, picks, priorities, note };
  const preview = useMemo(() => (A ? report(body) : null), [A, area, filmedOn, picks, priorities, note]);
  const points = useMemo(() => (A ? pointsOf(A) : new Map<string, Point>()), [A]);
  const answerOf = (pid: string) => points.get(pid)?.answers.find((a) => a.id === picks[pid]?.answer);
  const workIds = Object.keys(picks).filter((k) => answerOf(k)?.tone === "work");

  if (me.isLoading || probe.isLoading) return <Frame><p className="mt-10 text-white/60">Loading…</p></Frame>;
  if (!coach) {
    return (
      <Frame>
        <div className="ng-panel mt-6 p-6">
          <h2 className="text-[21px] font-semibold">Not available</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-white/70">
            This page is not open yet.{" "}
            <a className="font-semibold text-[var(--ng-gold)] underline-offset-4 hover:underline" href="/tracker">Back to the analytics</a>
          </p>
        </div>
      </Frame>
    );
  }

  const idx = STEPS.indexOf(step);
  const known = !!name && (swimmers.data ?? []).includes(name);

  function choose(pid: string, answer: string) {
    const tone = points.get(pid)?.answers.find((a) => a.id === answer)?.tone;
    setPicks((m) => {
      const n = { ...m };
      if (!answer) delete n[pid];
      else n[pid] = { answer, ...(tone === "work" && m[pid]?.side ? { side: m[pid].side } : {}) };
      return n;
    });
    if (tone !== "work") setPriorities((p) => p.filter((x) => x !== pid));
  }
  function setSide(pid: string, side: Side) {
    setPicks((m) => ({ ...m, [pid]: { ...m[pid], side } }));
  }
  function togglePriority(itemId: string) {
    setPriorities((p) => (p.includes(itemId) ? p.filter((x) => x !== itemId) : p.length >= 3 ? p : [...p, itemId]));
  }

  function next() {
    setError(null);
    if (step === "what") {
      if (!known) return setError("Choose a swimmer from the list");
      if (!A) return setError("Choose what was assessed");
      if (!filmedOn) return setError("Give the date of the session");
    }
    if (step === "marks" && !Object.keys(picks).length) return setError("Pick an answer for at least one point");
    setStep(STEPS[Math.min(STEPS.length - 1, idx + 1)]);
    window.scrollTo(0, 0);
  }

  async function save(shared: boolean) {
    setError(null);
    setSaving(true);
    try {
      const r = await fetch("/api/coach/assessments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, name, shared, body }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "That didn't save. Please try again.");
      setId(d.id);
      setSaved({ shared });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const back = `/tracker#/swimmers?swimmer=${encodeURIComponent(name)}`;

  if (saved) {
    return (
      <Frame>
        <div className="ng-panel mt-6 p-6 sm:p-7" style={{ borderColor: "rgba(255,194,75,.35)" }}>
          <h2 className="text-[21px] font-semibold">
            {saved.shared ? "Saved and shared" : "Saved as a draft"}
          </h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-white/70">
            {saved.shared
              ? `${A?.name} assessment for ${name}. ${firstName(name)}'s parents can now read it on their analytics page.`
              : `${A?.name} assessment for ${name}. Only coaches can see it until it is shared.`}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href={back} className="ng-btn" style={goldBtn}>Back to {firstName(name)}</a>
            <button type="button" className="ng-btn ng-btn-ghost" onClick={() => { setSaved(null); setStep("finish"); }}>
              Keep editing
            </button>
          </div>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="mt-7 flex items-center gap-2" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: i <= idx ? GOLD : "rgba(255,255,255,.15)" }} />
        ))}
      </div>
      <p className="ng-eyebrow mt-4" style={{ color: GOLD }}>
        <span className="dot" aria-hidden style={{ background: GOLD, boxShadow: "0 0 12px var(--ng-gold)" }} />
        Coach assessment · Step {idx + 1} of {STEPS.length}
      </p>

      <div className="ng-panel mt-4 p-6 sm:p-7">
        <h2 className="text-[21px] font-semibold">{TITLE[step]}</h2>

        {step === "what" && (
          <>
            <label className="ng-label mt-5" htmlFor="a-name" style={{ color: GOLD }}>Swimmer</label>
            <input id="a-name" className="ng-field" list="a-names" value={name} autoComplete="off"
              placeholder="Start typing a name…" onChange={(e) => setName(e.target.value)} />
            <datalist id="a-names">{(swimmers.data ?? []).map((n) => <option key={n} value={n} />)}</datalist>

            <span className="ng-label mt-5 block" style={{ color: GOLD }}>What was assessed</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AREAS.map((a) => (
                <Choice key={a.id} on={area === a.id} onClick={() => {
                  if (a.id !== area) { setArea(a.id); setPicks({}); setPriorities([]); setFind(""); }
                }}>{a.name}</Choice>
              ))}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="ng-label" htmlFor="a-date" style={{ color: GOLD }}>Date of the session</label>
                <input id="a-date" type="date" className="ng-field" value={filmedOn} max={today()}
                  onChange={(e) => setFilmedOn(e.target.value)} />
              </div>
            </div>

          </>
        )}

        {step === "marks" && A && (() => {
          const q = find.trim().toLowerCase();
          const hit = (ph: string, pt: { label: string; answers: { label: string }[] }) =>
            !q || [ph, pt.label, ...pt.answers.map((x) => x.label)].some((t) => t.toLowerCase().includes(q));
          const phases = A.phases
            .map((p) => ({ title: p.title, points: p.points.filter((pt) => hit(p.title, pt)) }))
            .filter((p) => p.points.length);
          const done = Object.keys(picks).length;
          return (
            <>
              <p className="mb-2 mt-1.5 text-[14px] leading-relaxed text-white/65">
                <span className="font-semibold text-white">{name}</span> · {A.name}. Pick what you saw for each
                point; leave a point on "Not assessed" if it wasn't clear.
              </p>
              <div className="sticky top-0 z-10 mt-4 rounded-b-xl bg-[#13243f]/95 py-2 backdrop-blur">
                <input className="ng-field" type="search" value={find} autoComplete="off"
                  placeholder="Find a point: elbow, head, kick, breathing…"
                  aria-label="Find a point" onChange={(e) => setFind(e.target.value)} />
                <p className="mt-1.5 text-[12.5px] text-white/50">
                  {done ? `${done} point${done === 1 ? "" : "s"} picked` : "Nothing picked yet"}
                </p>
              </div>
              {!phases.length && <p className="mt-5 text-[14px] text-white/60">No point matches "{find}".</p>}
              {phases.map((p) => (
                <section key={p.title} className="mt-5">
                  <h3 className="text-[13px] font-bold uppercase tracking-[1.4px] text-white/55">{p.title}</h3>
                  <ul className="mt-2 space-y-2.5">
                    {p.points.map((pt) => {
                      const pk = picks[pt.id];
                      const ans = pt.answers.find((x) => x.id === pk?.answer);
                      return (
                        <li key={pt.id} className="rounded-xl border p-3.5"
                          style={{
                            borderColor: ans?.tone === "work" ? "rgba(255,194,75,.45)" : ans?.tone === "good" ? "rgba(31,182,122,.45)" : "rgba(255,255,255,.12)",
                            background: "rgba(255,255,255,.03)",
                          }}>
                          <div className="grid items-center gap-2 sm:grid-cols-[1fr_15rem]">
                            <label htmlFor={"pt-" + pt.id} className="text-[15px] font-semibold">{pt.label}</label>
                            <select id={"pt-" + pt.id} className="ng-field" value={pk?.answer ?? ""}
                              style={{ fontSize: 14.5, padding: "9px 12px", colorScheme: "dark",
                                color: ans ? (ans.tone === "work" ? GOLD : "var(--ng-ok)") : undefined }}
                              onChange={(e) => choose(pt.id, e.target.value)}>
                              <option value="">Not assessed</option>
                              <optgroup label="Good">
                                {pt.answers.filter((x) => x.tone === "good").map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                              </optgroup>
                              <optgroup label="To work on">
                                {pt.answers.filter((x) => x.tone === "work").map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                              </optgroup>
                            </select>
                          </div>
                          {ans && (
                            <p className="mt-2 text-[13.5px] leading-relaxed text-white/65">
                              {ans.text}
                              {ans.fix && <span className="block" style={{ color: GOLD }}>Fix: {ans.fix}</span>}
                            </p>
                          )}
                          {ans?.tone === "work" && pt.sided && (
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {(["left", "right", "both"] as Side[]).map((sd) => (
                                <Mini key={sd} on={(pk?.side ?? "both") === sd} tone="gold" onClick={() => setSide(pt.id, sd)}>
                                  {sd === "both" ? "Both arms" : sd === "left" ? "Left arm" : "Right arm"}
                                </Mini>
                              ))}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </>
          );
        })()}

        {step === "finish" && A && preview && (
          <>
            {workIds.length > 0 && (
              <>
                <span className="ng-label mt-5 block" style={{ color: GOLD }}>Priorities · up to three, in order</span>
                <div className="mt-1.5 flex flex-col gap-2">
                  {workIds.map((wid) => {
                    const n = priorities.indexOf(wid);
                    return (
                      <Choice key={wid} on={n >= 0} onClick={() => togglePriority(wid)} left>
                        {n >= 0 ? `${n + 1}. ` : ""}{points.get(wid)?.label}: {answerOf(wid)?.label}
                      </Choice>
                    );
                  })}
                </div>
              </>
            )}

            <label className="ng-label mt-6" htmlFor="a-note" style={{ color: GOLD }}>Coach's summary (optional)</label>
            <textarea id="a-note" className="ng-field" rows={4} maxLength={2000} value={note}
              placeholder="Anything the standard points do not cover."
              onChange={(e) => setNote(e.target.value)} />

            <span className="ng-label mt-6 block" style={{ color: GOLD }}>What the parents will read</span>
            <Report name={name} filmedOn={filmedOn} r={preview} />
          </>
        )}

        {error && <p className="mt-5 rounded-xl border border-red-300/40 bg-red-500/10 p-3 text-[13.5px] text-white/90">{error}</p>}

        <div className="mt-7 flex flex-wrap items-center gap-3">
          {idx > 0 && (
            <button type="button" className="ng-btn ng-btn-ghost" onClick={() => { setError(null); setStep(STEPS[idx - 1]); }}>
              Back
            </button>
          )}
          {step !== "finish" ? (
            <button type="button" className="ng-btn" style={goldBtn} onClick={next}>Continue</button>
          ) : (
            <>
              <button type="button" className="ng-btn" style={goldBtn} disabled={saving} onClick={() => save(true)}>
                {saving ? "Saving…" : "Save and share with parents"}
              </button>
              <button type="button" className="ng-btn ng-btn-ghost" disabled={saving} onClick={() => save(false)}>
                Save as draft
              </button>
            </>
          )}
        </div>
      </div>
    </Frame>
  );
}

const firstName = (n: string) => (n.split(",")[1] ?? n).trim().split(/\s+/)[0] || n;

const goldBtn = {
  background: "linear-gradient(135deg, #FFC24B, #E9A52A)",
  color: "#0A1B33",
  boxShadow: "0 12px 26px -12px rgba(255,194,75,.7)",
} as const;

function Choice({ on, onClick, children, left }: { on: boolean; onClick: () => void; children: ReactNode; left?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={"min-h-[44px] rounded-xl px-4 text-[14.5px] font-medium transition-colors " + (left ? "text-left " : "") +
        (on ? "" : "border border-white/25 bg-white/5 text-white/80 hover:bg-white/10")}
      style={on ? { background: GOLD, color: "#0A1B33" } : undefined}>
      {children}
    </button>
  );
}

function Mini({ on, onClick, children, tone }: { on: boolean; onClick: () => void; children: ReactNode; tone: "ok" | "gold" }) {
  const fill = tone === "ok" ? "var(--ng-ok)" : GOLD;
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={"min-h-[36px] rounded-lg px-3 text-[13px] font-semibold transition-colors " +
        (on ? "" : "border border-white/25 bg-white/5 text-white/75 hover:bg-white/10")}
      style={on ? { background: fill, color: tone === "ok" ? "#fff" : "#0A1B33" } : undefined}>
      {children}
    </button>
  );
}

export function Report({ name, filmedOn, r }: { name: string; filmedOn: string; r: ReturnType<typeof report> }) {
  const d = new Date(filmedOn + "T00:00:00");
  const when = isNaN(+d) ? filmedOn : d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="mt-2 rounded-xl border border-white/12 bg-black/20 p-4 text-[14px] leading-relaxed text-white/80">
      <p className="text-[15px] font-semibold text-white">{r.title} · {firstName(name)}</p>
      <p className="text-[12.5px] text-white/50">{when}</p>
      {r.good.length > 0 && (
        <>
          <p className="mt-3 text-[12px] font-bold uppercase tracking-[1.2px] text-[var(--ng-ok)]">What is working</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">{r.good.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </>
      )}
      {r.work.length > 0 && (
        <>
          <p className="mt-3 text-[12px] font-bold uppercase tracking-[1.2px]" style={{ color: GOLD }}>To work on</p>
          <ol className="mt-1 space-y-2">
            {r.work.map((w) => (
              <li key={w.id}>
                {w.priority && <span className="mr-1.5 rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ background: GOLD, color: "#0A1B33" }}>Priority</span>}
                {w.text}
                <span className="block text-white/60">Fix: {w.fix}</span>
              </li>
            ))}
          </ol>
        </>
      )}
      {r.note && (
        <>
          <p className="mt-3 text-[12px] font-bold uppercase tracking-[1.2px] text-white/55">Coach's summary</p>
          <p className="mt-1 whitespace-pre-line">{r.note}</p>
        </>
      )}
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="ng-sora relative flex min-h-screen flex-col">
      <div className="ng-water" aria-hidden />
      <div className="ng-caustics" aria-hidden />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-12 pt-10 text-white">
        <div className="flex items-start justify-between gap-4">
          <img src="/nextgen-logo.png" alt="NextGen Multi Sport Academy" className="w-auto object-contain"
            width={395} height={265} style={{ height: "clamp(56px, 6vw, 84px)" }} />
          <nav className="flex items-center gap-3 pt-2 text-[13px]">
            <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[1px]"
              style={{ background: GOLD, color: "#0A1B33" }}>Coach view</span>
            <a href="/tracker#/swimmers" className="text-white/55 underline-offset-4 hover:text-white hover:underline">Analytics</a>
          </nav>
        </div>
        {children}
      </main>
    </div>
  );
}
