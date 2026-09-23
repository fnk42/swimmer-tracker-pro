import { useEffect, useState } from "react";

// What the testers have said, on the admin page.
//
// The board itself lives at /feedback and is where a reply gets written — it
// has the room for it. This is the same items in the place a coordinator
// already is, so "is anything broken?" does not need a second tab. Status is
// settable here because that is one click and the whole point of reading it.
type Row = {
  id: string; author: string; kind: string; body: string; route: string;
  context: string; status: string; reply: string | null; replied_by: string | null;
  created_at: string; agrees: number; mine: boolean;
};

const KIND: Record<string, { label: string; cls: string }> = {
  broken: { label: "Broken", cls: "bg-rose-100 text-rose-800 border-rose-200" },
  confusing: { label: "Confusing", cls: "bg-amber-100 text-amber-900 border-amber-200" },
  idea: { label: "Idea", cls: "bg-sky-100 text-sky-800 border-sky-200" },
};
const STATUS: Record<string, string> = {
  open: "bg-secondary text-muted-foreground",
  seen: "bg-secondary text-foreground",
  fixed: "bg-emerald-100 text-emerald-800",
  wontfix: "bg-secondary text-muted-foreground line-through",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

export function FeedbackPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    fetch("/api/tester/feedback")
      .then((r) => (r.status === 401 || r.status === 403 ? (setDenied(true), null) : r.json()))
      .then((j) => j && setRows(j.rows ?? []))
      .catch(() => undefined);

  useEffect(() => { void load(); }, []);

  async function setStatus(r: Row, status: string) {
    setBusy(r.id);
    try {
      await fetch("/api/tester/feedback", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: r.id, status }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (denied || !rows) return null;

  const open = rows.filter((r) => r.status === "open").length;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-4 py-2.5">
        <span className="text-[13.5px] font-semibold">Tester feedback</span>
        <span className="text-[12.5px] text-muted-foreground">
          {rows.length} item{rows.length === 1 ? "" : "s"}
          {open ? ` · ${open} still open` : rows.length ? " · all seen" : ""}
        </span>
        <span className="flex-1" />
        <a href="/feedback"
           className="text-[12.5px] text-muted-foreground underline-offset-4 hover:underline">
          Open the board
        </a>
        <button onClick={() => void load()}
                className="text-[12.5px] text-muted-foreground underline-offset-4 hover:underline">
          Refresh
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-4 text-[13px] text-muted-foreground">
          Nothing yet. It appears here the moment a tester posts.
        </p>
      ) : (
        <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
          {rows.map((r) => {
            const k = KIND[r.kind] ?? { label: r.kind, cls: "bg-secondary text-foreground" };
            return (
              <li key={r.id} className="px-4 py-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className={"rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide " + k.cls}>
                    {k.label}
                  </span>
                  <b className="text-[13px] font-medium">{r.author}</b>
                  <span className="text-[12px] text-muted-foreground">
                    {r.route ? `${r.route} · ` : ""}{when(r.created_at)}
                  </span>
                  {r.agrees > 0 && (
                    <span className="text-[12px] font-medium text-foreground">
                      ▲ {r.agrees} agree{r.agrees === 1 ? "s" : ""}
                    </span>
                  )}
                  <span className="flex-1" />
                  <span className={"rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase " + (STATUS[r.status] ?? "")}>
                    {r.status}
                  </span>
                </div>

                <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{r.body}</p>

                {r.reply && (
                  <p className="mt-2 rounded-lg bg-secondary px-3 py-2 text-[13px] leading-relaxed">
                    <b className="font-semibold">{r.replied_by ?? "Replied"}:</b> {r.reply}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["seen", "fixed", "wontfix", "open"]
                    .filter((st) => st !== r.status)
                    .map((st) => (
                      <button key={st} type="button" disabled={busy === r.id}
                              onClick={() => void setStatus(r, st)}
                              className="rounded-md border border-border px-2 py-0.5 text-[11.5px]
                                         text-muted-foreground hover:text-foreground disabled:opacity-50">
                        mark {st}
                      </button>
                    ))}
                  <span className="flex-1" />
                  <a href="/feedback"
                     className="text-[11.5px] text-muted-foreground underline-offset-4 hover:underline">
                    reply on the board
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
