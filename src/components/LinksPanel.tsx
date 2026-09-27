import { useEffect, useState } from "react";

// Who is on which child, with a way to take a wrong one off.
//
// Closed by default like the panels around it, and opened by the link in the
// "is now linked to" email, which lands here (#links) with the newest links
// already showing — the one the email was about is at the top.
type Link = {
  swimmer_id: string;
  swimmer: string;
  parent_id: string;
  parent_name: string;
  phone: string;
  emails: string | null;
  status: string;
  note: string | null;
  linked_at: string | null;
};

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export function LinksPanel() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<Link[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#links") setOpen(true);
  }, []);

  const load = (t: string) =>
    fetch("/api/admin/links" + (t.trim().length >= 2 ? `?q=${encodeURIComponent(t.trim())}` : ""))
      .then((r) => (r.status === 401 || r.status === 403 ? (setDenied(true), null) : r.json()))
      .then((j) => j && setRows(j.rows ?? []))
      .catch(() => undefined);

  useEffect(() => {
    if (!open) return;
    const h = setTimeout(() => void load(term), 250);
    return () => clearTimeout(h);
  }, [term, open]);

  async function remove(l: Link) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/links", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ swimmerId: l.swimmer_id, parentId: l.parent_id }),
      });
      if (r.ok) setDone(`${l.swimmer} removed from ${l.parent_name || l.emails || "that account"}.`);
      setConfirming(null);
      await load(term);
    } finally {
      setBusy(false);
    }
  }

  if (denied) return null;

  return (
    <div id="links" className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-baseline gap-3 px-4 py-2.5 text-left"
      >
        <span className="text-[13.5px] font-semibold">Parent links</span>
        <span className="text-[12.5px] text-muted-foreground">
          Who is on which child — remove a wrong one
        </span>
        <span className="flex-1" />
        <span aria-hidden className="text-[15px] text-muted-foreground">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div className="border-t border-border">
          <div className="px-4 py-3">
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search a swimmer's name — or leave empty for the newest links"
              aria-label="Search a swimmer"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            {done && <p className="mt-2 text-[13px] text-emerald-700">{done}</p>}
          </div>
          {!rows ? (
            <p className="px-4 pb-4 text-[13px] text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 pb-4 text-[13px] text-muted-foreground">No links found.</p>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {rows.map((l) => {
                const key = `${l.swimmer_id}:${l.parent_id}`;
                return (
                  <li key={key} className="px-4 py-2.5 text-[13px]">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <b className="font-medium">{l.swimmer}</b>
                      <span className="min-w-0 flex-1">
                        {l.parent_name || <i className="text-muted-foreground">no name yet</i>}{" "}
                        <span className="text-muted-foreground">
                          {l.emails ?? "—"}
                          {l.phone ? ` · ${l.phone}` : ""} · {when(l.linked_at)}
                        </span>
                      </span>
                      {confirming === key ? (
                        <span className="flex gap-2">
                          <button
                            disabled={busy}
                            onClick={() => void remove(l)}
                            className="rounded-md bg-destructive px-2.5 py-1 text-[12.5px] font-medium text-destructive-foreground"
                          >
                            {busy ? "Removing…" : "Yes, remove"}
                          </button>
                          <button
                            onClick={() => setConfirming(null)}
                            className="text-[12.5px] text-muted-foreground underline-offset-4 hover:underline"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setConfirming(key);
                            setDone(null);
                          }}
                          className="text-[12.5px] font-medium text-destructive underline-offset-4 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {confirming === key && (
                      <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                        Takes {l.swimmer} off this account only. The swimmer, any other parent
                        and the account stay as they are, and the parent can add them again.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
