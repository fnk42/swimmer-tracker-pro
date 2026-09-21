import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import dormant from "@/tracker/dormant.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// What has shipped, what is being built, and everything Boit has asked for.
//
// Coordinators only. A shipped row carries the commit it went out in, so the
// board is checkable against the repository rather than being a claim.

export const Route = createFileRoute("/roadmap")({ component: Roadmap });

type Item = {
  id: string; title: string; detail: string | null; status: Status;
  raised_by: string | null; created_at: string; shipped_at: string | null;
  commit_sha: string | null; comments: number;
};
type Note = {
  id: string; route: string; body: string; author: string;
  is_coach: boolean; created_at: string;
};
type Status = "idea" | "planned" | "building" | "shipped" | "parked";
type Comment = { id: string; author: string; body: string; created_at: string };
type Coverage = { total: number; with_guardian: number; eligible: number; version: string };

// Shipped is green and carries a tick; everything still owed is amber, blue or
// grey by how close it is. The distinction a reader needs at a glance is
// "is this done or not", so that is the one the colour makes.
const COLUMNS: {
  k: Status; t: string; d: string; dot: string; chip: string; edge: string;
}[] = [
  { k: "shipped",  t: "Shipped",      d: "live now, with the commit it went out in",
    dot: "#0F6E56", chip: "bg-emerald-50 text-emerald-900 border-emerald-200",
    edge: "border-l-[3px] border-l-emerald-600" },
  { k: "building", t: "Building now", d: "in progress, not yet live",
    dot: "#C2761B", chip: "bg-amber-50 text-amber-900 border-amber-200",
    edge: "border-l-[3px] border-l-amber-500" },
  { k: "planned",  t: "Planned",      d: "agreed, not started",
    dot: "#2C7BE5", chip: "bg-sky-50 text-sky-900 border-sky-200",
    edge: "border-l-[3px] border-l-sky-500" },
  { k: "idea",     t: "Ideas",        d: "raised, not yet decided",
    dot: "#64748B", chip: "bg-slate-50 text-slate-700 border-slate-200",
    edge: "border-l-[3px] border-l-slate-300" },
];

const NEXT: Record<Status, Status> = {
  idea: "planned", planned: "building", building: "shipped",
  shipped: "shipped", parked: "idea",
};

const when = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";

function Roadmap() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [cov, setCov] = useState<Coverage | null>(null);
  const [denied, setDenied] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  // One discussion thread per item: raise it against the thing it is about,
  // argue it out there, and the reasoning stays attached to the work.
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, Comment[]>>({});
  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);

  async function load() {
    const r = await fetch("/api/roadmap");
    if (r.status === 403 || r.status === 401) { setDenied(true); setItems([]); return; }
    const d = await r.json().catch(() => ({}));
    setItems(d.items ?? []);
    setNotes(d.notes ?? []);
    setCov(d.aiCoverage ?? null);
  }
  useEffect(() => { void load(); }, []);

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/roadmap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, detail, status: "idea" }),
      });
      if (!r.ok) { toast.error("Could not add that."); return; }
      setTitle(""); setDetail("");
      toast.success("Added to Ideas.");
      await load();
    } finally { setBusy(false); }
  }

  async function move(it: Item) {
    const to = NEXT[it.status];
    if (to === it.status) return;
    await fetch("/api/roadmap", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: it.id, status: to }),
    });
    await load();
  }

  async function loadThread(id: string) {
    const r = await fetch(`/api/roadmap/comment?itemId=${encodeURIComponent(id)}`);
    const d = await r.json().catch(() => ({}));
    setThreads((t) => ({ ...t, [id]: d.comments ?? [] }));
  }

  async function toggleThread(id: string) {
    if (openThread === id) { setOpenThread(null); return; }
    setOpenThread(id);
    setReply("");
    if (!threads[id]) await loadThread(id);
  }

  async function postComment(id: string) {
    const body = reply.trim();
    if (!body) return;
    setPosting(true);
    try {
      const r = await fetch("/api/roadmap/comment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itemId: id, body }),
      });
      if (!r.ok) { toast.error("Could not save that."); return; }
      setReply("");
      await loadThread(id);
      await load();
    } finally { setPosting(false); }
  }

  async function resolve(id: string) {
    await fetch("/api/notes", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  if (denied) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16">
        <h1 className="text-xl font-semibold">Coordinators only</h1>
        <p className="mt-2 text-muted-foreground">
          The roadmap is for the people running the club. If you have something to say about
          the app, use the <strong>Note</strong> button on any page — it reaches us directly.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">What we are building</h1>
        <span className="flex flex-wrap gap-2">
          <a href="/database"
             className="rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-[13px]
                        font-medium text-sky-900 hover:bg-sky-100">
            Swimmer database — birth dates and details →
          </a>
          <a href="/dormant"
             className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[13px]
                        font-medium text-amber-900 hover:bg-amber-100">
            {dormant.swimmers.length} dormant swimmers — review or put back →
          </a>
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">
        Everything shipped, everything planned, and every idea raised. Shipped items are green
        and ticked; everything still owed is amber, blue or grey by how near it is. Tick an item
        along as it
        moves. Anything marked shipped shows the commit it went out in, so this board can be
        checked against the code rather than taken on trust.
      </p>

      {/* Add an idea */}
      <section className="mt-7 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Add an idea</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input value={title} onChange={(e) => setTitle(e.target.value)}
                 placeholder="One line — what should it do?" />
          <Button disabled={!title.trim() || busy} onClick={add}>
            {busy ? "Adding…" : "Add"}
          </Button>
        </div>
        <Textarea className="mt-2" rows={2} value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder="Anything more — why it matters, who asked for it (optional)" />
      </section>

      {/* The consent drive, which is what gates the coaching assistant. */}
      {cov && (
        <section className="mt-7 rounded-xl border border-[color:var(--ng-electric)]/40 bg-card p-4">
          <h2 className="text-sm font-semibold">Coaching assistant — what it would be allowed to see</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
            The assistant sends race data to OpenAI, outside Kenya. The consent document now says
            so, which means every guardian re-accepts before their child can be included. A child
            whose guardians have not accepted, or who has no guardian on file, is never sent.
          </p>
          <div className="mt-3 flex flex-wrap gap-5 text-[13.5px]">
            <span><strong className="text-[19px]">{cov.eligible}</strong> of {cov.total} swimmers
              <span className="block text-xs text-muted-foreground">cleared for the assistant</span></span>
            <span><strong className="text-[19px]">{cov.with_guardian}</strong>
              <span className="block text-xs text-muted-foreground">have any guardian attached</span></span>
          </div>
          {cov.eligible === 0 && (
            <p className="mt-3 rounded-lg bg-secondary p-3 text-[13px] text-muted-foreground">
              Nobody yet, which is expected — consent version {cov.version} went live today.
              Until families accept it the assistant has nothing it may look at, so the consent
              drive is the thing that unblocks it.
            </p>
          )}
        </section>
      )}

      {items === null ? (
        <p className="mt-8 text-muted-foreground">Loading…</p>
      ) : (
        <div className="mt-8 space-y-8">
          {COLUMNS.map((col) => {
            const rows = items.filter((i) => i.status === col.k);
            if (!rows.length) return null;
            return (
              <section key={col.k}>
                <div className="flex items-baseline gap-3">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 flex-none translate-y-[-1px] rounded-full"
                    style={{ background: col.dot }}
                  />
                  <h2 className="text-[15px] font-semibold">{col.t}</h2>
                  <span className="text-xs text-muted-foreground">{col.d}</span>
                  <span
                    className={`ml-auto rounded-full border px-2 py-0.5 text-xs font-semibold ${col.chip}`}
                  >
                    {rows.length}
                  </span>
                </div>
                <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
                  {rows.map((it) => (
                    <li key={it.id} className={`p-4 ${col.edge}`}>
                      <div className="flex items-start gap-3">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14.5px] font-medium">
                            {it.status === "shipped" ? (
                              <span className="mr-1.5 font-bold text-emerald-700">✓</span>
                            ) : (
                              <span
                                aria-hidden
                                className="mr-1.5 inline-block h-1.5 w-1.5 -translate-y-[2px] rounded-full"
                                style={{ background: col.dot }}
                              />
                            )}
                            {it.title}
                          </span>
                          {it.detail && (
                            <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">
                              {it.detail}
                            </span>
                          )}
                          <span className="mt-1.5 block font-mono text-[11px] text-muted-foreground">
                            {it.raised_by ? `raised by ${it.raised_by}` : ""}
                            {it.commit_sha ? ` · ${it.commit_sha}` : ""}
                            {it.shipped_at ? ` · shipped ${when(it.shipped_at)}` : ""}
                          </span>
                        </span>
                        <span className="flex flex-none items-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => void toggleThread(it.id)}>
                            💬{it.comments > 0 ? ` ${it.comments}` : ""}
                          </Button>
                          {it.status !== "shipped" && (
                            <Button size="sm" variant="outline" onClick={() => move(it)}>
                              → {NEXT[it.status]}
                            </Button>
                          )}
                        </span>
                      </div>

                      {openThread === it.id && (
                        <div className="mt-3 rounded-lg border border-border bg-secondary/40 p-3">
                          {(threads[it.id] ?? []).length === 0 ? (
                            <p className="text-[13px] text-muted-foreground">
                              Nothing here yet. Say what you want changed and it stays attached
                              to this item.
                            </p>
                          ) : (
                            <ul className="space-y-3">
                              {(threads[it.id] ?? []).map((cm) => (
                                <li key={cm.id} className="text-[13.5px]">
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    {cm.author} · {when(cm.created_at)}
                                  </span>
                                  <span className="mt-0.5 block whitespace-pre-wrap leading-relaxed">
                                    {cm.body}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <Textarea
                              value={reply}
                              onChange={(e) => setReply(e.target.value)}
                              rows={2}
                              placeholder="Suggest a change, or answer a question…"
                              className="text-[13.5px]"
                            />
                            <Button
                              disabled={!reply.trim() || posting}
                              onClick={() => void postComment(it.id)}
                              className="sm:self-end"
                            >
                              {posting ? "Sending…" : "Reply"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {/* Notes left from inside the app */}
      <section className="mt-10">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[15px] font-semibold">Notes from the app</h2>
          <span className="text-xs text-muted-foreground">
            left on a page, with the page attached
          </span>
        </div>
        {notes.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-muted-foreground">
            Nothing open. Notes arrive here when anyone uses the Note button.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
            {notes.map((n) => (
              <li key={n.id} className="flex items-start gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px]">{n.body}</span>
                  <span className="mt-1 block font-mono text-[11px] text-muted-foreground">
                    {n.author}{n.is_coach ? " (coach)" : ""} · {n.route || "—"} · {when(n.created_at)}
                  </span>
                </span>
                <Button size="sm" variant="outline" onClick={() => resolve(n.id)}>Done</Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
