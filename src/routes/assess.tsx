import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/lib/api";
import {
  AREAS,
  FIGURE_AREAS,
  areaById,
  pointsOf,
  report,
  zoneOf,
  type AssessmentBody,
  type Pick,
  type Point,
  type Side,
  type Zone,
} from "@/lib/assessment-template";

// The coaches' assessment desk (Felix, 21 Oct 2026).
//
// Where a coach lands after signing in. One page, not a wizard: their name
// and today's date are already filled in, they find the swimmer, tap the part
// of the swimmer they are commenting on, and pick from a short list of
// standard answers, with a few words of their own if they want ("getting
// better"). Everything saves itself as a draft as they go; sharing with the
// parents is the one deliberate step. Picking the same swimmer again on the
// same day carries on with that day's assessment rather than starting over.
//
// The look is the Nationals registration form's — water, glass panels — with
// gold as the accent, so a coach can tell at a glance this is the coaches'
// side.

type Search = { name?: string; id?: string };

export const Route = createFileRoute("/assess")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    name: typeof s.name === "string" ? s.name : undefined,
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: AssessPage,
});

const GOLD = "var(--ng-gold)";
const OK = "var(--ng-ok)";

type Saved = {
  id: string;
  name: string;
  area: string;
  filmedOn: string;
  shared: boolean;
  updatedAt: string;
  mine?: boolean;
  body?: AssessmentBody;
};

// The date where the coach is, not UTC: a session at 7am in Nairobi is today.
const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const longDate = (ymd: string) => {
  const d = new Date(ymd + "T00:00:00");
  return isNaN(+d) ? ymd : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
};
const shortDate = (ymd: string) => {
  if (ymd === today()) return "Today";
  const d = new Date(ymd + "T00:00:00");
  return isNaN(+d) ? ymd : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

const ZONE_LABEL: Record<Zone, string> = {
  head: "Head and breathing",
  arm: "Arm and elbow",
  hand: "Hands",
  body: "Body",
  legs: "Kick",
  wall: "Off the wall",
};
const ZONE_ORDER: Zone[] = ["head", "arm", "hand", "body", "legs", "wall"];

function AssessPage() {
  const search = Route.useSearch();
  const me = useMe();
  const qc = useQueryClient();
  // Private for now: the server says who may use it (ASSESSMENT_EMAILS), and
  // under what name their assessments go out.
  const probe = useQuery({
    queryKey: ["assess-probe"],
    enabled: !!me.data?.signedIn,
    queryFn: async () => {
      const r = await fetch("/api/coach/assessments?probe=1");
      return r.ok ? ((await r.json()) as { ok: true; coachName: string }) : null;
    },
  });
  const coach = (!!me.data?.isAdmin || !!me.data?.isCoach) && !!probe.data?.ok;

  const [id, setId] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [typed, setTyped] = useState(search.name ?? "");
  const [area, setArea] = useState("");
  const [filmedOn, setFilmedOn] = useState(today());
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [priorities, setPriorities] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [shared, setShared] = useState(false);
  const [zone, setZone] = useState<Zone>("arm");
  const [find, setFind] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" | "error"; at?: string; msg?: string }>({ kind: "idle" });

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
  const recent = useQuery({
    queryKey: ["assess-recent"],
    enabled: coach,
    queryFn: async () => {
      const r = await fetch("/api/coach/assessments?mine=1");
      return r.ok ? ((await r.json()) as Saved[]) : [];
    },
  });

  // ── Saving ──
  // Every change marks the form dirty; a pause, or moving to another part of
  // the form, saves it. Saves run one at a time so a new assessment is only
  // ever created once.
  const dirty = useRef(false);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const idRef = useRef<string | undefined>(undefined);
  const latest = useRef({ name, area, filmedOn, picks, priorities, note, shared });
  latest.current = { name, area, filmedOn, picks, priorities, note, shared };

  const saveNow = useCallback((share?: boolean) => {
    const run = async () => {
      const s = latest.current;
      if (!s.name || !s.area || !Object.keys(s.picks).length) return;
      const sharedNow = share ?? s.shared;
      dirty.current = false;
      setStatus({ kind: "saving" });
      try {
        const body: AssessmentBody = { area: s.area, filmedOn: s.filmedOn, picks: s.picks, priorities: s.priorities, note: s.note };
        const r = await fetch("/api/coach/assessments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: idRef.current, name: s.name, shared: sharedNow, body }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "That didn't save. Please try again.");
        idRef.current = d.id;
        setId(d.id);
        setShared(sharedNow);
        setStatus({ kind: "saved", at: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) });
        qc.invalidateQueries({ queryKey: ["assess-recent"] });
      } catch (e) {
        dirty.current = true;
        setStatus({ kind: "error", msg: e instanceof Error ? e.message : "That didn't save." });
      }
    };
    chain.current = chain.current.then(run, run);
    return chain.current;
  }, [qc]);
  const flush = useCallback(() => (dirty.current ? saveNow() : chain.current), [saveNow]);

  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => saveNow(), 1200);
    return () => clearTimeout(t);
  }, [picks, priorities, note, filmedOn, saveNow]);
  // Leaving the page: one last save.
  useEffect(() => {
    const h = () => { if (dirty.current) saveNow(); };
    window.addEventListener("pagehide", h);
    return () => window.removeEventListener("pagehide", h);
  }, [saveNow]);
  const touch = () => { dirty.current = true; };

  // ── Loading ──
  function load(a: Saved) {
    const b = a.body!;
    idRef.current = a.id;
    setId(a.id);
    setName(a.name);
    setTyped(a.name);
    setArea(b.area);
    setFilmedOn(b.filmedOn);
    setPicks(b.picks ?? {});
    setPriorities(b.priorities ?? []);
    setNote(b.note ?? "");
    setShared(a.shared);
    setFind("");
    dirty.current = false;
    setStatus({ kind: "saved", at: undefined });
  }
  function blank(n: string, a: string) {
    idRef.current = undefined;
    setId(undefined);
    setName(n);
    setArea(a);
    setFilmedOn(today());
    setPicks({});
    setPriorities([]);
    setNote("");
    setShared(false);
    setFind("");
    dirty.current = false;
    setStatus({ kind: "idle" });
  }
  /** This coach's assessment of this swimmer today (in this area, if given), newest first. */
  async function todays(n: string, a?: string) {
    const r = await fetch("/api/coach/assessments?name=" + encodeURIComponent(n));
    const list = r.ok ? ((await r.json()) as Saved[]) : [];
    return list
      .filter((x) => x.mine && x.filmedOn === today() && (!a || x.area === a))
      .sort((x, y) => (x.updatedAt < y.updatedAt ? 1 : -1))[0];
  }
  async function chooseSwimmer(n: string) {
    await flush();
    setTyped(n);
    const hit = await todays(n);
    if (hit?.body) load(hit);
    else blank(n, "");
  }
  async function chooseArea(a: string) {
    if (a === area) return;
    await flush();
    const hit = await todays(name, a);
    if (hit?.body) load(hit);
    else blank(name, a);
    setZone("arm");
  }
  async function openSaved(a: Saved) {
    await flush();
    if (a.body) load(a);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // An Edit link from a swimmer's card, or a name passed in.
  const opened = useRef(false);
  useEffect(() => {
    if (!coach || opened.current) return;
    opened.current = true;
    if (search.id) {
      fetch("/api/coach/assessments?id=" + encodeURIComponent(search.id))
        .then((r) => (r.ok ? r.json() : null))
        .then((a: Saved | null) => { if (a?.body) load(a); })
        .catch(() => {});
    } else if (search.name) {
      chooseSwimmer(search.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coach]);

  const A = areaById(area);
  const points = useMemo(() => (A ? pointsOf(A) : new Map<string, Point>()), [A]);
  const answerOf = (pid: string) => points.get(pid)?.answers.find((a) => a.id === picks[pid]?.answer);
  const workIds = Object.keys(picks).filter((k) => answerOf(k)?.tone === "work");
  const preview = useMemo(
    () => (A && Object.keys(picks).length ? report({ area, filmedOn, picks, priorities, note }) : null),
    [A, area, filmedOn, picks, priorities, note],
  );

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

  function choose(pid: string, answer: string) {
    const tone = points.get(pid)?.answers.find((a) => a.id === answer)?.tone;
    const off = picks[pid]?.answer === answer;
    touch();
    setPicks((m) => {
      const n = { ...m };
      if (off) delete n[pid];
      else n[pid] = { ...n[pid], answer, ...(tone === "work" ? {} : { side: undefined }) };
      return n;
    });
    if (tone !== "work" || off) setPriorities((p) => p.filter((x) => x !== pid));
  }
  function patch(pid: string, p: Partial<Pick>) {
    touch();
    setPicks((m) => ({ ...m, [pid]: { ...m[pid], ...p } }));
  }
  function togglePriority(pid: string) {
    touch();
    setPriorities((p) => (p.includes(pid) ? p.filter((x) => x !== pid) : p.length >= 3 ? p : [...p, pid]));
  }
  async function goZone(z: Zone) {
    setZone(z);
    setFind("");
    await flush();
  }

  const names = swimmers.data ?? [];
  const matches = typed.trim() && typed !== name
    ? names.filter((n) => n.toLowerCase().includes(typed.trim().toLowerCase())).slice(0, 8)
    : [];
  const coachName = probe.data?.coachName ?? "";
  const figure = FIGURE_AREAS.has(area);
  const q = find.trim().toLowerCase();
  const allPoints = A ? [...points.values()] : [];
  const shown: { title: string; points: Point[] }[] = !A
    ? []
    : q
      ? [{ title: `Points matching "${find}"`, points: allPoints.filter((pt) =>
          [pt.label, ...pt.answers.map((x) => x.label)].some((t) => t.toLowerCase().includes(q))) }]
      : figure
        ? [{ title: ZONE_LABEL[zone], points: allPoints.filter((pt) => zoneOf(area, pt.id) === zone) }]
        : A.phases.map((p) => ({ title: p.title, points: p.points }));
  const counts: Partial<Record<Zone, number>> = {};
  for (const pid of Object.keys(picks)) {
    const z = zoneOf(area, pid);
    if (z) counts[z] = (counts[z] ?? 0) + 1;
  }

  return (
    <Frame>
      {/* Who and when: filled in. */}
      <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-white/70">
        <span><span className="text-white/45">Coach</span> <b className="text-white">{coachName}</b></span>
        <span className="flex items-center gap-1.5">
          <span className="text-white/45">Date</span>
          <b className="text-white">{longDate(filmedOn)}</b>
          {filmedOn !== today() && <span className="text-white/45">(not today)</span>}
        </span>
        <SaveState s={status} shared={shared} hasWork={!!name && !!area && Object.keys(picks).length > 0} />
      </div>

      <div className="ng-panel mt-4 p-5 sm:p-7" style={{ borderColor: "rgba(255,194,75,.28)" }}>
        <p className="ng-eyebrow" style={{ color: GOLD }}>
          <span className="dot" aria-hidden style={{ background: GOLD, boxShadow: "0 0 12px var(--ng-gold)" }} />
          {id ? "Assessment" : "New assessment"}
        </p>

        {/* The swimmer: front and centre. */}
        <label className="ng-label mt-4" htmlFor="a-name" style={{ color: GOLD }}>Swimmer</label>
        <div className="relative">
          <input id="a-name" className="ng-field" value={typed} autoComplete="off" type="search"
            style={{ fontSize: 17, padding: "14px 16px" }}
            placeholder="Type a swimmer's name…"
            onChange={(e) => setTyped(e.target.value)} />
          {matches.length > 0 && (
            <ul className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-white/15 bg-[#10223f] shadow-2xl">
              {matches.map((n) => (
                <li key={n}>
                  <button type="button" className="block w-full px-4 py-3 text-left text-[15px] hover:bg-white/10"
                    onClick={() => chooseSwimmer(n)}>{n}</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!name && <Recent list={recent.data ?? []} onOpen={openSaved} />}

        {name && (
          <>
            <span className="ng-label mt-6 block" style={{ color: GOLD }}>What are you assessing?</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {AREAS.map((a) => (
                <Choice key={a.id} on={area === a.id} onClick={() => chooseArea(a.id)}>{a.name}</Choice>
              ))}
            </div>
          </>
        )}

        {A && (
          <>
            {figure && (
              <>
                <p className="mt-6 text-[13.5px] text-white/60">Tap the part of the swimmer you want to comment on.</p>
                <SwimmerFigure zone={find ? null : zone} counts={counts} onZone={goZone} />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ZONE_ORDER.map((z) => (
                    <Mini key={z} on={!find && zone === z} tone="gold" onClick={() => goZone(z)}>
                      {ZONE_LABEL[z]}{counts[z] ? ` · ${counts[z]}` : ""}
                    </Mini>
                  ))}
                </div>
              </>
            )}

            <input className="ng-field mt-4" type="search" value={find} autoComplete="off"
              style={{ fontSize: 14.5, padding: "10px 14px" }}
              placeholder="Or find a point: elbow, head, kick, breathing…" aria-label="Find a point"
              onChange={(e) => setFind(e.target.value)} />

            {shown.map((g) => (
              <section key={g.title} className="mt-5">
                <h3 className="text-[13px] font-bold uppercase tracking-[1.4px] text-white/55">{g.title}</h3>
                {!g.points.length && <p className="mt-2 text-[14px] text-white/55">No point matches.</p>}
                <ul className="mt-2 space-y-2.5">
                  {g.points.map((pt) => (
                    <PointCard key={pt.id} pt={pt} pick={picks[pt.id]} onChoose={(a) => choose(pt.id, a)} onPatch={(p) => patch(pt.id, p)} />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>

      {preview && (
        <div className="ng-panel mt-5 p-5 sm:p-7">
          <h2 className="text-[19px] font-semibold">Before you share</h2>
          {workIds.length > 0 && (
            <>
              <span className="ng-label mt-4 block" style={{ color: GOLD }}>Priorities · up to three, in order</span>
              <div className="mt-1.5 flex flex-col gap-2">
                {[...workIds].sort((x, y) => {
                  const ix = priorities.indexOf(x), iy = priorities.indexOf(y);
                  return (ix < 0 ? 9 : ix) - (iy < 0 ? 9 : iy);
                }).map((wid) => {
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

          <label className="ng-label mt-5" htmlFor="a-note" style={{ color: GOLD }}>Coach's summary (optional)</label>
          <textarea id="a-note" className="ng-field" rows={3} maxLength={2000} value={note}
            placeholder="Anything the standard points do not cover."
            onChange={(e) => { touch(); setNote(e.target.value); }} />

          <span className="ng-label mt-5 block" style={{ color: GOLD }}>What the parents will read</span>
          <Report name={name} filmedOn={filmedOn} r={preview} />

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" className="ng-btn" style={goldBtn} disabled={status.kind === "saving"}
              onClick={() => saveNow(true)}>
              {shared ? "Shared · update" : "Share with parents"}
            </button>
            <span className="text-[13px] text-white/55">
              {shared
                ? `${firstName(name)}'s parents can read this. Changes save straight to it.`
                : "Saved as a draft as you go. Only coaches can see it until you share."}
            </span>
          </div>
        </div>
      )}

      {name && (recent.data ?? []).length > 0 && (
        <div className="mt-5">
          <Recent list={recent.data ?? []} onOpen={openSaved} current={id}
            onNew={async () => { await flush(); blank("", ""); setTyped(""); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
        </div>
      )}
    </Frame>
  );
}

function SaveState({ s, shared, hasWork }: { s: { kind: string; at?: string; msg?: string }; shared: boolean; hasWork: boolean }) {
  if (!hasWork) return null;
  const txt = s.kind === "saving" ? "Saving…"
    : s.kind === "error" ? `Not saved: ${s.msg}`
    : s.kind === "saved" ? `${shared ? "Shared" : "Draft saved"}${s.at ? ` ${s.at}` : ""}`
    : "Not saved yet";
  return (
    <span className="ml-auto rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
      style={{ background: s.kind === "error" ? "rgba(239,68,68,.2)" : "rgba(255,255,255,.08)",
        color: s.kind === "error" ? "#fecaca" : shared ? "#7FE3B5" : "rgba(255,255,255,.7)" }}>
      {txt}
    </span>
  );
}

function Recent({ list, onOpen, current, onNew }: { list: Saved[]; onOpen: (a: Saved) => void; current?: string; onNew?: () => void }) {
  if (!list.length) return null;
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <span className="ng-label block" style={{ color: GOLD }}>Recent</span>
        {onNew && (
          <button type="button" className="text-[13px] font-semibold underline-offset-4 hover:underline" style={{ color: GOLD }}
            onClick={onNew}>+ Another swimmer</button>
        )}
      </div>
      <ul className="mt-1.5 overflow-hidden rounded-xl border border-white/12">
        {list.map((a) => (
          <li key={a.id} className="border-b border-white/10 last:border-b-0">
            <button type="button" onClick={() => onOpen(a)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5"
              style={a.id === current ? { background: "rgba(255,194,75,.08)" } : undefined}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{a.name}</span>
                <span className="block text-[12.5px] text-white/55">{areaById(a.area)?.name} · {shortDate(a.filmedOn)}</span>
              </span>
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-[.8px]"
                style={a.shared ? { background: "rgba(31,182,122,.18)", color: "#7FE3B5" } : { background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.65)" }}>
                {a.shared ? "Shared" : "Draft"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PointCard({ pt, pick, onChoose, onPatch }: {
  pt: Point; pick?: Pick; onChoose: (a: string) => void; onPatch: (p: Partial<Pick>) => void;
}) {
  const ans = pt.answers.find((x) => x.id === pick?.answer);
  return (
    <li className="rounded-xl border p-3.5"
      style={{
        borderColor: ans?.tone === "work" ? "rgba(255,194,75,.45)" : ans?.tone === "good" ? "rgba(31,182,122,.45)" : "rgba(255,255,255,.12)",
        background: "rgba(255,255,255,.03)",
      }}>
      <span className="text-[15px] font-semibold">{pt.label}</span>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={pt.label}>
        {pt.answers.map((x) => (
          <Mini key={x.id} on={pick?.answer === x.id} tone={x.tone === "good" ? "ok" : "gold"} onClick={() => onChoose(x.id)}>
            {x.label}
          </Mini>
        ))}
      </div>
      {ans && (
        <>
          <p className="mt-2 text-[13.5px] leading-relaxed text-white/65">
            {ans.text}
            {ans.fix && <span className="block" style={{ color: GOLD }}>Fix: {ans.fix}</span>}
          </p>
          {ans.tone === "work" && pt.sided && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {(["left", "right", "both"] as Side[]).map((sd) => (
                <Mini key={sd} on={(pick?.side ?? "both") === sd} tone="gold" onClick={() => onPatch({ side: sd })}>
                  {sd === "both" ? "Both arms" : sd === "left" ? "Left arm" : "Right arm"}
                </Mini>
              ))}
            </div>
          )}
          <input className="ng-field mt-2.5" style={{ fontSize: 14, padding: "9px 12px" }} maxLength={200}
            placeholder="Note (optional): e.g. getting better" value={pick?.note ?? ""}
            aria-label={`Note on ${pt.label}`}
            onChange={(e) => onPatch({ note: e.target.value })} />
        </>
      )}
    </li>
  );
}

/** A swimmer in outline, side on, with the parts a coach can tap. */
function SwimmerFigure({ zone, counts, onZone }: { zone: Zone | null; counts: Partial<Record<Zone, number>>; onZone: (z: Zone) => void }) {
  // Limbs as centre lines, drawn twice (a light stroke, then the water colour
  // a little thinner) so the whole body reads as one clean outline.
  const limbs: [string, number][] = [
    ["M262 104 L452 94", 40],
    ["M440 93 L520 97 L586 100", 15],
    ["M582 100 L602 101", 12],
    ["M428 103 L400 130 L394 178", 15],
    ["M394 176 L392 192", 12],
    ["M272 100 L192 92 L122 98", 21],
    ["M122 98 L102 92", 10],
    ["M272 110 L194 118 L126 126", 21],
    ["M126 126 L106 131", 10],
  ];
  const spots: { z: Zone; x: number; y: number; lx: number; ly: number; label: string }[] = [
    { z: "head", x: 484, y: 90, lx: 484, ly: 54, label: "Head" },
    { z: "arm", x: 400, y: 130, lx: 338, ly: 160, label: "Elbow" },
    { z: "hand", x: 596, y: 100, lx: 590, ly: 144, label: "Hand" },
    { z: "body", x: 320, y: 102, lx: 310, ly: 60, label: "Body" },
    { z: "legs", x: 168, y: 110, lx: 168, ly: 164, label: "Kick" },
    { z: "wall", x: 17, y: 130, lx: 74, ly: 218, label: "Off the wall" },
  ];
  return (
    <svg viewBox="0 30 640 200" className="-mx-2 mt-1 w-[calc(100%+16px)] select-none sm:mx-0 sm:w-full" role="group" aria-label="Swimmer figure">
      <defs>
        <linearGradient id="fig-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#16A6E8" stopOpacity=".16" />
          <stop offset="1" stopColor="#16A6E8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g pointerEvents="none">
      <rect x="0" y="70" width="640" height="160" fill="url(#fig-water)" />
      <path d="M0 70 Q 20 64 40 70 T 80 70 T 120 70 T 160 70 T 200 70 T 240 70 T 280 70 T 320 70 T 360 70 T 400 70 T 440 70 T 480 70 T 520 70 T 560 70 T 600 70 T 640 70"
        fill="none" stroke="#46D3F0" strokeOpacity=".45" strokeWidth="2" />
      <rect x="8" y="40" width="18" height="185" rx="4" fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.25)" strokeWidth="1.5" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {limbs.map(([d, w], i) => <path key={"o" + i} d={d} stroke="#CFE3FF" strokeWidth={w + 5} />)}
        <circle cx="484" cy="90" r="24" fill="#CFE3FF" />
        {limbs.map(([d, w], i) => <path key={"i" + i} d={d} stroke="#10284A" strokeWidth={w} />)}
        <circle cx="484" cy="90" r="21.5" fill="#10284A" />
        <path d="M490 84 L503 86" stroke="#FFC24B" strokeWidth="4" />
      </g>
      </g>
      {spots.map((s) => {
        const on = zone === s.z, n = counts[s.z] ?? 0;
        return (
          <g key={s.z} role="button" tabIndex={0} aria-label={ZONE_LABEL[s.z]} aria-pressed={on}
            onClick={() => onZone(s.z)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onZone(s.z); } }}
            style={{ cursor: "pointer", outline: "none" }}>
            <circle cx={s.x} cy={s.y} r="34" fill="transparent" />
            {on && <circle cx={s.x} cy={s.y} r="20" fill="none" stroke="#FFC24B" strokeOpacity=".5" strokeWidth="6" />}
            <circle cx={s.x} cy={s.y} r={on ? 15 : 13} fill={n || on ? "#FFC24B" : "rgba(255,194,75,.25)"} stroke="#FFC24B" strokeWidth="2.5">
              {!on && !n && <animate attributeName="r" values="11;15;11" dur="2s" repeatCount="indefinite" />}
            </circle>
            {n > 0 && <text x={s.x} y={s.y + 4.5} textAnchor="middle" fontSize="16" fontWeight="800" fill="#0A1B33">{n}</text>}
            <text x={s.lx} y={s.ly} textAnchor="middle" fontSize="21" fontWeight={on ? 800 : 600}
              fill={on ? "#FFC24B" : "rgba(255,255,255,.75)"}>{s.label}</text>
          </g>
        );
      })}
    </svg>
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
      className={"min-h-[44px] rounded-xl px-3 text-[14.5px] font-medium transition-colors " + (left ? "text-left " : "") +
        (on ? "" : "border border-white/25 bg-white/5 text-white/80 hover:bg-white/10")}
      style={on ? { background: GOLD, color: "#0A1B33" } : undefined}>
      {children}
    </button>
  );
}

function Mini({ on, onClick, children, tone }: { on: boolean; onClick: () => void; children: ReactNode; tone: "ok" | "gold" }) {
  const fill = tone === "ok" ? OK : GOLD;
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={"min-h-[38px] rounded-lg px-3 text-[13.5px] font-semibold transition-colors " +
        (on ? "" : "border bg-white/5 hover:bg-white/10")}
      style={on ? { background: fill, color: tone === "ok" ? "#fff" : "#0A1B33" }
        : { borderColor: tone === "ok" ? "rgba(31,182,122,.5)" : "rgba(255,194,75,.45)", color: "rgba(255,255,255,.85)" }}>
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
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {r.good.map((g, i) => (
              <li key={i}>{g.text}{g.note && <span className="block text-white/60">Coach's note: {g.note}</span>}</li>
            ))}
          </ul>
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
                {w.note && <span className="block text-white/60">Coach's note: {w.note}</span>}
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
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-12 pt-8 text-white sm:px-5 sm:pt-10">
        <div className="flex items-start justify-between gap-4">
          <img src="/nextgen-logo.png" alt="NextGen Multi Sport Academy" className="w-auto object-contain"
            width={395} height={265} style={{ height: "clamp(52px, 6vw, 84px)" }} />
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
