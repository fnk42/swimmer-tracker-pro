import { useEffect, useState } from "react";

// Six athletes' progression, on the signed-out landing page.
//
// Small multiples rather than one combined chart: each swimmer gets their own
// y-scale, which is the only honest way to put a 50 Free next to a 100 Breast.
//
// THE AXIS. Time runs up the y-axis with the FASTEST swim at the BOTTOM, so a
// line that FALLS means the swimmer is getting faster. This used to be
// inverted, on the theory that a parent reads "up is better" before they read
// the axis. It now matches the per-child charts in the tracker, which read the
// literal way round: their time is coming down. One convention in one product
// beats two clever ones.
//
// Names are pseudonyms assigned in tools/progress.py — the times and the shape
// of every curve are real, the name attached to them is invented. This page is
// public, so no real child is named on it at all. This component never receives
// a real name to begin with.

type Point = { d: string; t: number };
type Athlete = {
  name: string; event: string; course: string; swims: number;
  from: string; to: string; first: number; last: number; pct: number;
  points: Point[];
};

const LINE = ["#46D3F0", "#16A6E8", "#FFC24B", "#1FB67A", "#8FB8E8", "#C8A6F0"];

const clock = (s: number) =>
  s < 60 ? `${s.toFixed(2)}s`
    : `${Math.floor(s / 60)}:${(s % 60 < 10 ? "0" : "")}${(s % 60).toFixed(2)}`;

function Spark({ a, colour }: { a: Athlete; colour: string }) {
  const W = 240, H = 54, P = 5;
  const xs = a.points.map((p) => new Date(p.d + "T00:00:00").getTime());
  const ys = a.points.map((p) => p.t);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = (hi - lo) * 0.16 || 1;
  // top of the box is the SLOWEST time, bottom is the fastest
  const top = hi + pad, bot = lo - pad;

  const X = (v: number) => P + ((v - x0) / (x1 - x0 || 1)) * (W - 2 * P);
  const Y = (v: number) => P + ((top - v) / (top - bot || 1)) * (H - 2 * P);

  const d = a.points
    .map((p, i) => `${i ? "L" : "M"}${X(new Date(p.d + "T00:00:00").getTime()).toFixed(1)} ${Y(p.t).toFixed(1)}`)
    .join(" ");
  const area = `${d} L${X(x1).toFixed(1)} ${H - P} L${X(x0).toFixed(1)} ${H - P} Z`;
  const id = `pw-${a.name.replace(/\W/g, "")}-${a.event.replace(/\W/g, "")}`;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[.055] px-3.5 py-3">
      <div className="text-[13.5px] font-semibold leading-tight text-white">{a.name}</div>
      <div className="mt-0.5 font-mono text-[10.5px] tracking-wide text-white/50">
        {a.event} · {a.course} · {a.swims} swims
      </div>

      {/* "40.8% faster", not "-40.8%". A swimmer who took 40.8% off their time
          got faster; a minus sign in front of it reads as a loss. */}
      <div className="mt-2 font-mono text-[19px] font-semibold leading-none tabular-nums"
           style={{ color: colour }}>
        {a.pct < 0 ? `${Math.abs(a.pct)}% faster`
          : a.pct > 0 ? `${a.pct}% slower` : "level"}
      </div>
      <div className="mt-1 font-mono text-[10px] tracking-wide text-white/45">
        {clock(a.first)} → {clock(a.last)}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
           className="mt-2 block h-[54px] w-full" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={colour} stopOpacity=".30" />
            <stop offset="1" stopColor={colour} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${id})`} />
        <path d={d} fill="none" stroke={colour} strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round"
              vectorEffect="non-scaling-stroke" />
        <circle cx={X(x1)} cy={Y(a.points[a.points.length - 1].t)} r="2.8"
                fill={colour} stroke="#0A1B33" strokeWidth="1" />
      </svg>

      <span className="sr-only">
        {a.name} swam {a.event} {a.course} {a.swims} times between {a.from} and {a.to},
        improving from {clock(a.first)} to {clock(a.last)}, a change of {a.pct} percent.
      </span>
    </div>
  );
}

export function ProgressWall() {
  const [rows, setRows] = useState<Athlete[] | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/tracker/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d?.progress?.length) setRows(d.progress); })
      .catch(() => { /* the landing still works without it */ });
    return () => { live = false; };
  }, []);

  if (!rows) return null;

  return (
    <section className="mt-14" aria-labelledby="pw-h">
      <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="pw-h" className="text-[19px] font-semibold text-white">
          What four years of swimming looks like
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[.14em] text-[var(--ng-cyan)]">
          Real athletes · real times
        </span>
      </div>
      <p className="mb-6 max-w-[62ch] text-[14px] leading-relaxed text-white/60">
        Each line is one swimmer in one event, every time they have raced it. The line falls as
        their time comes down, so a falling line means they are getting faster. Real results —
        names changed, because these are children.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((a, i) => (
          <Spark key={a.name + a.event} a={a} colour={LINE[i % LINE.length]} />
        ))}
      </div>

      <p className="mt-4 max-w-[62ch] text-[12.5px] leading-relaxed text-white/40">
        Improvement at these ages is partly training and partly growing up — a coach reads both.
        The flattest line here is in deliberately: a club that only showed its steepest curves
        would be advertising, not measuring.
      </p>
    </section>
  );
}
