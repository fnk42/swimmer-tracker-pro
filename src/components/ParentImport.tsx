import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

// Import the club's parent list.
//
// This is the single biggest gap in the data: 190 swimmers, and until this runs
// only 24 have an adult attached. Boit has the real list, so the fastest route
// is for him to put it in rather than for parents to be matched one at a time.
//
// Preview first, always. Kenyan surnames repeat — Mwangi, Otieno, Wanjiru — so a
// surname that hits two swimmers is shown as a decision rather than guessed at.
// Nothing is written until he has looked at it.

type Row = {
  name: string;
  email: string;
  phone: string;
  surname: string;
  existingParentId: string | null;
  matched: { id: string; name: string; age: number | null }[];
  unresolved: { asked: string; couldBe: string[] }[];
  confident: boolean;
  ambiguous: boolean;
  noMatch: boolean;
};

type Summary = {
  total: number;
  confident: number;
  ambiguous: number;
  noMatch: number;
  alreadyKnown: number;
};

export function ParentImport({ onDone }: { onDone?: () => void }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<{ parentsAdded: number; linksAdded: number } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  async function onFile(f: File) {
    setText(await f.text());
    setRows(null);
    setApplied(null);
  }

  async function preview() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/parent-import?preview=1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? "Could not read that list.");
        return;
      }
      setRows(d.rows);
      setSummary(d.summary);
      // Ambiguous rows start unticked: a surname hitting two swimmers is a
      // decision, not a default.
      setSkip(new Set((d.rows as Row[]).flatMap((x, i) => (x.ambiguous ? [i] : []))));
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!rows) return;
    setBusy(true);
    setError(null);
    try {
      const keep = rows.filter((_, i) => !skip.has(i));
      const r = await fetch("/api/admin/parent-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows: keep.map((k) => ({ ...k, children: undefined })), text }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? "Could not import that list.");
        return;
      }
      setApplied({ parentsAdded: d.parentsAdded ?? 0, linksAdded: d.linksAdded ?? 0 });
      setRows(null);
      setText("");
      onDone?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-[color:var(--ng-electric)]/40">
      <CardHeader>
        <CardTitle className="text-base">Upload the parent list</CardTitle>
        <CardDescription>The one thing that would help most right now.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {applied && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-700">
            Done — <strong>{applied.parentsAdded}</strong> parent
            {applied.parentsAdded === 1 ? "" : "s"} added and <strong>{applied.linksAdded}</strong>{" "}
            swimmer link
            {applied.linksAdded === 1 ? "" : "s"} made. Those families can now sign in and see their
            own children.
          </div>
        )}

        {!rows && (
          <>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder={
                "Paste here, one parent per line. For example:\n\n" +
                "Janet Masua, janet@example.com, 0722 000 111\n" +
                "Peter Ngaywa, peter@example.com, 0733 222 333, Seth"
              }
              className="font-mono text-[13px]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={!text.trim() || busy} onClick={preview}>
                {busy ? "Reading…" : "Show me what this will do"}
              </Button>
              <input
                ref={file}
                type="file"
                accept=".csv,.tsv,.txt"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
              <Button variant="outline" onClick={() => file.current?.click()}>
                Upload a CSV
              </Button>
            </div>
          </>
        )}

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        {rows && summary && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <Tag tone="plain">{summary.total} in the list</Tag>
              <Tag tone="ok">{summary.confident} matched</Tag>
              {summary.ambiguous > 0 && (
                <Tag tone="warn">{summary.ambiguous} need you to choose</Tag>
              )}
              {summary.noMatch > 0 && <Tag tone="plain">{summary.noMatch} no swimmer found</Tag>}
              {summary.alreadyKnown > 0 && (
                <Tag tone="plain">{summary.alreadyKnown} already on file</Tag>
              )}
            </div>

            <div className="max-h-[420px] divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {rows.map((r, i) => (
                <label
                  key={i}
                  className="flex cursor-pointer items-start gap-3 bg-card p-3 hover:bg-secondary/50"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 flex-none"
                    checked={!skip.has(i)}
                    onChange={(e) => {
                      const n = new Set(skip);
                      if (e.target.checked) n.delete(i);
                      else n.add(i);
                      setSkip(n);
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">
                      {r.name || <em className="text-muted-foreground">no name</em>}
                      {r.existingParentId && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          already on file
                        </span>
                      )}
                    </span>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {[r.email, r.phone].filter(Boolean).join(" · ") || "—"}
                    </span>
                    {r.matched.length > 0 && (
                      <span className="mt-1 block text-[13px]">
                        <span className="text-emerald-700">→ </span>
                        {r.matched.map((m) => `${m.name}${m.age ? ` (${m.age})` : ""}`).join(", ")}
                      </span>
                    )}

                    {/* A child the list named that we could not pin down. Shown
                        rather than guessed: the surname fallback once offered a
                        sibling instead of the right child. */}
                    {(r.unresolved ?? []).map((u) => (
                      <span key={u.asked} className="mt-1 block text-[13px] text-amber-700">
                        “{u.asked}” —{" "}
                        {u.couldBe.length
                          ? `could be ${u.couldBe.join(", ")}. Link them by hand.`
                          : "no swimmer by that name. Check the spelling, or add them to the roster."}
                      </span>
                    ))}

                    {r.matched.length === 0 && !(r.unresolved ?? []).length && (
                      <span className="mt-1 block text-[13px] text-muted-foreground">
                        No swimmer with the surname “{r.surname}”
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={busy} onClick={apply}>
                {busy ? "Saving…" : `Link ${rows.length - skip.size} of ${rows.length}`}
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setRows(null)}>
                Back
              </Button>
              <span className="text-xs text-muted-foreground">
                Unticked rows are skipped entirely.
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Tag({ tone, children }: { tone: "ok" | "warn" | "plain"; children: React.ReactNode }) {
  const cls = {
    ok: "bg-emerald-100/70 text-emerald-700",
    warn: "bg-amber-100/70 text-amber-700",
    plain: "bg-secondary text-muted-foreground",
  }[tone];
  return <span className={`rounded-full px-2.5 py-1 font-medium ${cls}`}>{children}</span>;
}
