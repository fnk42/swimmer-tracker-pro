import { useEffect, useState } from "react";
import type React from "react";

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
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // The item being answered, and what is being written. A reply is public to
  // every tester on the board, so it is composed deliberately rather than
  // typed into a row by accident.
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const load = () =>
    fetch("/api/tester/feedback")
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) { setDenied(true); return null; }
        if (!r.ok) throw new Error(`the server answered ${r.status}`);
        return r.json();
      })
      .then((j) => { if (j) { setRows(j.rows ?? []); setFailed(null); } })
      .catch((e) => setFailed(e instanceof Error ? e.message : "could not reach the server"));

  useEffect(() => { void load(); }, []);

  async function patch(r: Row, body: Record<string, unknown>) {
    setBusy(r.id);
    try {
      await fetch("/api/tester/feedback", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: r.id, ...body }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  const setStatus = (r: Row, status: string) => patch(r, { status });

  async function sendReply(r: Row) {
    const text = draft.trim();
    if (!text) return;
    await patch(r, { reply: text });
    setReplyTo(null);
    setDraft("");
  }

  // Never render nothing.
  //
  // This used to return null unless the rows had arrived, so a failed request
  // — or a slow one — left no panel on the page at all, and the only way to
  // tell "there is no feedback" from "this is broken" was to open the network
  // tab. A panel that is meant to be on a page should say why it is empty.
  const shell = (body: React.ReactNode) => (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-2.5">
        <span className="text-[13.5px] font-semibold">Tester feedback</span>
        <button onClick={() => { setFailed(null); void load(); }}
                className="text-[12.5px] text-muted-foreground underline-offset-4 hover:underline">
          Refresh
        </button>
      </div>
      {body}
    </div>
  );

  if (denied)
    return shell(
      <p className="px-4 py-3 text-[13px] text-muted-foreground">
        Admins only. This account is not on the admin list.
      </p>,
    );

  if (failed)
    return shell(
      <p className="px-4 py-3 text-[13px] text-destructive">
        Could not load the feedback — {failed}. Try Refresh; if it keeps happening, tell Felix.
      </p>,
    );

  if (!rows)
    return shell(<p className="px-4 py-3 text-[13px] text-muted-foreground">Loading…</p>);

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
          No feedback yet. Every item a tester posts appears here, and you can answer it
          where everybody testing will see the answer.
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
                  <div className="mt-2 rounded-lg border-l-2 border-primary/50 bg-secondary px-3 py-2">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {r.replied_by ?? "The club"} replied · every tester sees this
                    </p>
                    <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed">{r.reply}</p>
                  </div>
                )}

                {replyTo === r.id ? (
                  <div className="mt-2">
                    <label className="sr-only" htmlFor={`rep-${r.id}`}>Your reply</label>
                    <textarea
                      id={`rep-${r.id}`} rows={3} autoFocus value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Answer them here. Every tester sees it on the board."
                      className="w-full resize-none rounded-lg border border-border bg-background
                                 px-3 py-2 text-[13px] leading-relaxed"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      <button type="button" disabled={busy === r.id || !draft.trim()}
                              onClick={() => void sendReply(r)}
                              className="rounded-md bg-primary px-2.5 py-1 text-[12px] font-medium
                                         text-primary-foreground disabled:opacity-50">
                        {busy === r.id ? "Posting…" : "Post reply"}
                      </button>
                      <button type="button"
                              onClick={() => { setReplyTo(null); setDraft(""); }}
                              className="rounded-md border border-border px-2.5 py-1 text-[12px]
                                         text-muted-foreground hover:text-foreground">
                        Cancel
                      </button>
                      {r.reply && (
                        <button type="button" disabled={busy === r.id}
                                onClick={() => { void patch(r, { reply: "" }); setReplyTo(null); setDraft(""); }}
                                className="rounded-md border border-border px-2.5 py-1 text-[12px]
                                           text-muted-foreground hover:text-destructive">
                          Delete reply
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button type="button"
                            onClick={() => { setReplyTo(r.id); setDraft(r.reply ?? ""); }}
                            className="rounded-md bg-primary px-2.5 py-0.5 text-[11.5px] font-medium
                                       text-primary-foreground">
                      {r.reply ? "Edit reply" : "Reply"}
                    </button>
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
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
