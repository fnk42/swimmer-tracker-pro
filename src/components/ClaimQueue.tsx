import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// The approval queue, for coordinators.
//
// A parent claiming a child proves nothing by claiming, so nothing is granted
// until someone here decides. The point of this screen is to make that decision
// possible in a few seconds without a phone call, which means showing the
// evidence rather than just the names:
//
//   phone match   the claiming parent's number is on that swimmer's own
//                 registration, so the club already had them down as a contact
//   conflict      two adults are already approved, so a third needs a decision
//                 about who comes off rather than a quiet addition

type Claim = {
  swimmerId: string;
  parentId: string;
  swimmer: string;
  age: number | null;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  relationship: string | null;
  claimedAt: string;
  phoneMatch: boolean;
  nameMatch: boolean;
  approvedAlready: string[];
  conflict: boolean;
};

type Unlisted = {
  id: string;
  child_name: string;
  child_age: number | null;
  note: string | null;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
};

export function ClaimQueue() {
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [unlisted, setUnlisted] = useState<Unlisted[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function actUnlisted(id: string, dismiss: boolean) {
    setBusy(id);
    setError(null);
    try {
      const r = await fetch("/api/admin/claims", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, dismiss }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? "Could not do that."); return; }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function load() {
    try {
      const r = await fetch("/api/admin/claims");
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      setClaims(d.claims ?? []);
      setUnlisted(d.unlisted ?? []);
    } catch {
      setError("Could not load the queue. Refresh to try again.");
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function decide(c: Claim, decision: "approved" | "rejected") {
    const k = c.swimmerId + c.parentId;
    setBusy(k);
    setError(null);
    try {
      const r = await fetch("/api/admin/claims", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ swimmerId: c.swimmerId, parentId: c.parentId, decision }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error ?? "Could not record that decision.");
        return;
      }
      setClaims((cs) => (cs ?? []).filter((x) => x.swimmerId + x.parentId !== k));
    } finally {
      setBusy(null);
    }
  }

  if (claims === null) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">Loading claims…</CardContent>
      </Card>
    );
  }

  const waiting = claims.length + unlisted.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          Parent claims
          {waiting > 0 && (
            <span className="rounded-full bg-amber-100/70 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              {waiting} waiting
            </span>
          )}
        </CardTitle>
        <CardDescription>
          A parent sees no swimmer by name until you approve them — only the club's overall
          numbers.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {error && <p className="text-sm font-medium text-destructive">{error}</p>}

        {waiting === 0 && (
          <p className="rounded-lg bg-secondary px-3 py-6 text-center text-sm text-muted-foreground">
            Nothing waiting. New claims appear here, and you get an email when one arrives.
          </p>
        )}

        {claims.map((c) => {
          const k = c.swimmerId + c.parentId;
          return (
            <div key={k} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-[15px] font-semibold text-foreground">{c.parentName}</span>
                <span className="text-sm text-muted-foreground">
                  says they are {c.relationship ?? "the parent"} of
                </span>
                <span className="text-[15px] font-semibold text-foreground">
                  {c.swimmer}
                  {c.age ? <span className="font-normal text-muted-foreground"> · {c.age}</span> : null}
                </span>
              </div>

              <div className="mt-1.5 font-mono text-xs text-muted-foreground">
                {c.parentEmail}
                {c.parentPhone ? ` · ${c.parentPhone}` : ""}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {c.phoneMatch ? (
                  <Badge tone="ok">✓ Phone matches the registration</Badge>
                ) : (
                  <Badge tone="warn">Phone not on the registration</Badge>
                )}
                {c.nameMatch && <Badge tone="ok">Surname appears on the registration</Badge>}
                {c.approvedAlready.length > 0 && (
                  <Badge tone="plain">
                    Already approved: {c.approvedAlready.join(", ")}
                  </Badge>
                )}
                {c.conflict && (
                  <Badge tone="bad">Two adults already approved — decide who comes off</Badge>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <Button size="sm" disabled={busy === k} onClick={() => decide(c, "approved")}>
                  {busy === k ? "Saving…" : "Approve"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === k}
                  onClick={() => decide(c, "rejected")}
                >
                  Decline
                </Button>
              </div>
            </div>
          );
        })}

        {unlisted.length > 0 && (
          <div className="pt-2">
            <h4 className="mb-2 text-sm font-semibold text-foreground">
              Swimmers not on the roster
            </h4>
            {unlisted.map((u) => (
              <div key={u.id} className="rounded-xl border border-border bg-card p-4">
                <div className="text-[15px] font-semibold text-foreground">
                  {u.child_name}
                  {u.child_age ? (
                    <span className="font-normal text-muted-foreground"> · {u.child_age}</span>
                  ) : null}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  asked for by {u.parent_name} · {u.parent_email}
                </div>
                {u.note && <p className="mt-2 text-sm text-foreground">“{u.note}”</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy === u.id}
                          onClick={() => void actUnlisted(u.id, false)}>
                    {busy === u.id ? "Adding…" : "Add to the roster and link them"}
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === u.id}
                          onClick={() => void actUnlisted(u.id, true)}>
                    Dismiss
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Adding puts them on the roster and on this parent's account. They are not in
                  the Nationals team until the club puts them there.
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "bad" | "plain";
  children: React.ReactNode;
}) {
  const cls = {
    ok: "bg-emerald-100/70 text-emerald-700",
    warn: "bg-amber-100/70 text-amber-700",
    bad: "bg-destructive/10 text-destructive",
    plain: "bg-secondary text-muted-foreground",
  }[tone];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>
  );
}
