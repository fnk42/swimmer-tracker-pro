import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// The swimmers the twelve-month rule has set aside, and the way back.
//
// A rule that quietly removes 39 children from every figure has to be
// inspectable and reversible by the club, or it is not a rule, it is a silent
// deletion. Everything needed to judge a case is on the row: when they last
// raced for NextGen, how many swims they are carrying, the ages they swam at,
// and whether they have turned up for another club since.

type Decision = {
  swimmer: string; decision: string; reason: string | null;
  decided_by: string; created_at: string;
};
type Row = {
  swimmer: string; lastSwim: string; firstSwim: string; swims: number;
  ages: string; otherClubs: string; otherSwims: number; note: string;
  decision: Decision | null;
};
type Payload = {
  rule: string; decidedBy: string; decidedOn: string; lastMeet: string;
  current: number; former: number; swimmers: Row[]; pending: number;
};

const since = (d: string, from: string) => {
  const m = Math.round(
    (new Date(from).getTime() - new Date(d).getTime()) / (1000 * 60 * 60 * 24 * 30.44),
  );
  return `${m} months`;
};

export const Route = createFileRoute("/dormant")({ component: Dormant });

function Dormant() {
  const [data, setData] = useState<Payload | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [why, setWhy] = useState<Record<string, string>>({});

  const load = async () => {
    const r = await fetch("/api/roster-status");
    if (r.status === 401 || r.status === 403) { setDenied(true); return; }
    setData(await r.json());
  };
  useEffect(() => { void load(); }, []);

  const decide = async (swimmer: string, decision: "active" | "dormant") => {
    setBusy(swimmer);
    await fetch("/api/roster-status", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ swimmer, decision, reason: why[swimmer] ?? "" }),
    });
    setWhy((w) => ({ ...w, [swimmer]: "" }));
    setBusy(null);
    await load();
  };

  if (denied) {
    return <main className="mx-auto max-w-2xl px-5 py-16">
      <p className="text-muted-foreground">Coordinators only.</p>
    </main>;
  }
  if (!data) {
    return <main className="mx-auto max-w-5xl px-5 py-16">
      <p className="text-muted-foreground">Loading…</p>
    </main>;
  }

  const back = data.swimmers.filter((s) => s.decision?.decision === "active");

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Dormant swimmers</h1>
      <p className="mt-2 max-w-[92ch] text-[14px] leading-relaxed text-muted-foreground">
        {data.rule} The rule was set by {data.decidedBy} on {data.decidedOn} and is counted
        back from the club’s most recent meet, currently {data.lastMeet}.
      </p>
      <p className="mt-3 max-w-[92ch] rounded-lg border border-dashed border-border bg-secondary/40 p-3 text-[13px] leading-relaxed">
        <b>This list is the appeal.</b> The rule is mechanical and cannot know that a swimmer was
        injured, sat a year of exams, or raced at a meet whose results have not reached us. Put
        anyone back and they return to every club figure on the next data run. Their results were
        never deleted — only set aside.
      </p>

      <div className="mt-6 flex flex-wrap gap-3 text-[13px]">
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-900">
          {data.current} counting toward club figures
        </span>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-900">
          {data.swimmers.length} dormant
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
          {data.former} confirmed departed
        </span>
        {back.length > 0 && (
          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-900">
            {back.length} marked to come back — live on the next data run
          </span>
        )}
      </div>

      <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
        {data.swimmers.map((s) => {
          const reinstated = s.decision?.decision === "active";
          return (
            <li key={s.swimmer}
                className={`p-4 ${reinstated ? "border-l-[3px] border-l-sky-500 bg-sky-50/40" : ""}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="text-[15px] font-medium">{s.swimmer}</span>
                <span className="font-mono text-[11.5px] text-muted-foreground">
                  last raced {s.lastSwim} · {since(s.lastSwim, data.lastMeet)} before the
                  club’s last meet · {s.swims} swims kept · age {s.ages}
                </span>
              </div>
              {s.otherSwims > 0 && (
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  Has {s.otherSwims} swim{s.otherSwims === 1 ? "" : "s"} recorded under{" "}
                  {s.otherClubs}.
                </p>
              )}
              {reinstated ? (
                <p className="mt-2 text-[12.5px] text-sky-900">
                  <b>Marked active</b> by {s.decision!.decided_by}
                  {s.decision!.reason ? ` — ${s.decision!.reason}` : ""}. Back in the figures on
                  the next data run.{" "}
                  <button className="underline" disabled={busy === s.swimmer}
                          onClick={() => void decide(s.swimmer, "dormant")}>
                    undo
                  </button>
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px]"
                    placeholder="Why are they still with us? (injured, exams, results not collected…)"
                    value={why[s.swimmer] ?? ""}
                    onChange={(e) => setWhy((w) => ({ ...w, [s.swimmer]: e.target.value }))}
                  />
                  <Button size="sm" variant="outline" disabled={busy === s.swimmer}
                          onClick={() => void decide(s.swimmer, "active")}>
                    Put back in the figures
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-5 max-w-[92ch] text-[12.5px] leading-relaxed text-muted-foreground">
        Marking someone active records the decision here. It reaches the club figures when the
        analytics next run, because the roster is rebuilt from the archive rather than edited in
        place — which is also why nobody can be removed from history by accident.
      </p>
    </main>
  );
}
