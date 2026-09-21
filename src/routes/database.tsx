import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

// The swimmer database: every swimmer the archive knows, and where each of
// their birth dates came from.
//
// A birth date decides which age band a swimmer is judged in, so a wrong one
// moves their whole assessment. Most are inferred from the six digits at the
// front of the athlete ID, and that is a guess — it was wrong for 3 of the
// 288 swimmers in the first export to carry a real date. 26 have no date at
// all, because a PDF-only meet carries no athlete ID.
//
// The list opens on the ones that need attention: no date first, then guessed,
// then the dates that disagree with the ages the meets recorded.

type Edit = { dob: string | null; sex: string | null; note: string | null;
              edited_by: string; created_at: string };
type Row = {
  swimmer: string; id: string; dob: string; dobSource: "club" | "export" | "id" | "none";
  band: string; status: string; swims: number; firstSwim: string; lastSwim: string;
  agesSeen: [string, number][]; agesOk: number; agesOff: number; disputed: string;
  edit: Edit | null;
};
type Payload = { bands: string[]; counts: Record<string, number>;
                 swimmers: Row[]; generated: string; pending: number };

const SOURCE: Record<string, { label: string; cls: string }> = {
  club:   { label: "set by the club", cls: "bg-emerald-50 text-emerald-900 border-emerald-200" },
  export: { label: "from the meet export", cls: "bg-sky-50 text-sky-900 border-sky-200" },
  id:     { label: "guessed from athlete ID", cls: "bg-amber-50 text-amber-900 border-amber-200" },
  none:   { label: "no date on file", cls: "bg-rose-50 text-rose-900 border-rose-200" },
};

export const Route = createFileRoute("/database")({ component: Database });

function Database() {
  const [data, setData] = useState<Payload | null>(null);
  const [denied, setDenied] = useState(false);
  const [qStr, setQStr] = useState("");
  const [only, setOnly] = useState<"attention" | "all">("attention");
  const [draft, setDraft] = useState<Record<string, { dob: string; note: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});

  const load = async () => {
    const r = await fetch("/api/swimmer-details");
    if (r.status === 401 || r.status === 403) { setDenied(true); return; }
    setData(await r.json());
  };
  useEffect(() => { void load(); }, []);

  const save = async (s: Row) => {
    const d = draft[s.swimmer] ?? { dob: "", note: "" };
    setBusy(s.swimmer); setErr((e) => ({ ...e, [s.swimmer]: "" }));
    const r = await fetch("/api/swimmer-details", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ swimmer: s.swimmer, dob: d.dob, note: d.note }),
    });
    setBusy(null);
    if (!r.ok) {
      const body = (await r.json()) as { error?: string };
      setErr((e) => ({ ...e, [s.swimmer]: body.error ?? "Could not save" }));
      return;
    }
    setDraft((x) => ({ ...x, [s.swimmer]: { dob: "", note: "" } }));
    await load();
  };

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = qStr.trim().toLowerCase();
    return data.swimmers.filter((s) => {
      if (needle && !s.swimmer.toLowerCase().includes(needle)) return false;
      if (only === "all") return true;
      return s.dobSource === "none" || s.dobSource === "id" || s.agesOff > 0 || !!s.disputed;
    });
  }, [data, qStr, only]);

  if (denied) return <main className="mx-auto max-w-2xl px-5 py-16">
    <p className="text-muted-foreground">Coordinators only.</p></main>;
  if (!data) return <main className="mx-auto max-w-5xl px-5 py-16">
    <p className="text-muted-foreground">Loading…</p></main>;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Swimmer database</h1>
      <p className="mt-2 max-w-[92ch] text-[14px] leading-relaxed text-muted-foreground">
        A birth date decides which age band a swimmer is judged in, so a wrong one moves their
        whole assessment. Most dates here are <em>inferred</em> from the six digits at the front
        of the athlete ID — a guess that was wrong for 3 of the 288 swimmers in the first export
        to carry a real date. This is where the club corrects them.
      </p>

      <div className="mt-5 flex flex-wrap gap-2 text-[13px]">
        {(["none", "id", "export", "club"] as const).map((k) => (
          <span key={k} className={`rounded-full border px-3 py-1 ${SOURCE[k].cls}`}>
            {data.counts[k] ?? 0} {SOURCE[k].label}
          </span>
        ))}
        {data.pending > 0 && (
          <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-violet-900">
            {data.pending} edited — live on the next data run
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-[14px]"
          placeholder="Search a swimmer…" value={qStr}
          onChange={(e) => setQStr(e.target.value)}
        />
        <Button size="sm" variant={only === "attention" ? "default" : "outline"}
                onClick={() => setOnly("attention")}>Needs attention</Button>
        <Button size="sm" variant={only === "all" ? "default" : "outline"}
                onClick={() => setOnly("all")}>All {data.swimmers.length}</Button>
      </div>

      <ul className="mt-5 divide-y divide-border rounded-xl border border-border bg-card">
        {rows.map((s) => {
          const d = draft[s.swimmer] ?? { dob: "", note: "" };
          const src = SOURCE[s.dobSource];
          return (
            <li key={s.swimmer} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-[15px] font-medium">{s.swimmer}</span>
                <span className="font-mono text-[11.5px] text-muted-foreground">
                  {s.swims} swims · {s.firstSwim || "—"} to {s.lastSwim || "—"}
                  {s.id && s.id !== "(none)" ? ` · ${s.id}` : " · no athlete ID"}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px]">
                <span className={`rounded-full border px-2 py-0.5 ${src.cls}`}>
                  {s.dob || "no date"} · {src.label}
                </span>
                {s.band && <span className="text-muted-foreground">age band {s.band}</span>}
                {s.agesSeen.length > 0 && (
                  <span className={s.agesOff ? "text-amber-800" : "text-muted-foreground"}>
                    {s.agesOk} of {s.agesOk + s.agesOff} meet ages fit
                  </span>
                )}
              </div>

              {s.disputed && (
                <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[12.5px]
                              leading-relaxed text-rose-900">
                  <b>In dispute.</b> {s.disputed}
                </p>
              )}

              {s.edit && (
                <p className="mt-2 text-[12.5px] text-violet-900">
                  <b>{s.edit.dob ?? "date cleared"}</b> set by {s.edit.edited_by}
                  {s.edit.note ? ` — ${s.edit.note}` : ""}. Live on the next data run.
                </p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input type="date" value={d.dob}
                  className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px]"
                  onChange={(e) => setDraft((x) => ({ ...x, [s.swimmer]: { ...d, dob: e.target.value } }))}
                />
                <input
                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px]"
                  placeholder="Why? (from the registration form, confirmed with the parent…)"
                  value={d.note}
                  onChange={(e) => setDraft((x) => ({ ...x, [s.swimmer]: { ...d, note: e.target.value } }))}
                />
                <Button size="sm" variant="outline" disabled={!d.dob || busy === s.swimmer}
                        onClick={() => void save(s)}>Save date</Button>
              </div>
              {err[s.swimmer] && (
                <p className="mt-1.5 text-[12.5px] text-rose-700">{err[s.swimmer]}</p>
              )}
              {s.agesSeen.length > 0 && (
                <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                  meets recorded: {s.agesSeen.map(([y, a]) => `${a} in ${y}`).join(" · ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-5 max-w-[92ch] text-[12.5px] leading-relaxed text-muted-foreground">
        A saved date is recorded here and reaches the club's figures when the analytics next run,
        because the roster is rebuilt from the archive rather than edited in place. Nothing is
        overwritten: correcting a correction leaves both rows.
      </p>
    </main>
  );
}
