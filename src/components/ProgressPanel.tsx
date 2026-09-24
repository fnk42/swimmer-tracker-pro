import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EVENT, formatKes } from "@/lib/event-config";

type Row = {
  name: string;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  has_parent: boolean;
  entered: boolean;
  paid: number;
  has_been_here: boolean;
};

type Tester = {
  email: string;
  full_name: string;
  agreed: boolean;
  revoked: boolean;
  expires_at: string;
  last_seen_at: string | null;
  sign_ins: number;
};

// Where each swimmer has got to, in the order the steps happen. The first
// answer that is "no" is where that family is stuck, which is the whole point:
// a list of names is not useful, a list of names with a reason is.
function stage(r: Row): { label: string; done: boolean; tone: string } {
  if (!r.has_parent) return { label: "no adult on record", done: false, tone: "text-destructive" };
  if (!r.has_been_here) return { label: "never signed in", done: false, tone: "text-destructive" };
  if (!r.entered) return { label: "no entry form", done: false, tone: "text-amber-600" };
  if (r.paid <= 0) return { label: "nothing paid", done: false, tone: "text-amber-600" };
  if (r.paid < EVENT.totalKes)
    return {
      label: `owes ${formatKes(EVENT.totalKes - r.paid)}`,
      done: false,
      tone: "text-amber-600",
    };
  return { label: "paid in full", done: true, tone: "text-emerald-700" };
}

export function ProgressPanel() {
  const [open, setOpen] = useState(false);
  const qy = useQuery({
    queryKey: ["admin", "progress"],
    queryFn: async () => {
      const r = await fetch("/api/admin/progress");
      if (!r.ok) throw new Error(await r.text());
      return (await r.json()) as { machakos: Row[]; testers: Tester[] };
    },
    refetchInterval: 60_000,
  });

  // Always render something. A panel that disappears when the request fails is
  // a panel nobody can report as broken — the same trap the feedback board and
  // the activity log both fell into.
  const rows = qy.data?.machakos ?? [];
  const testers = qy.data?.testers ?? [];
  const stuck = rows.filter((r) => !stage(r).done);
  const shown = open ? rows : stuck;

  const waiting = testers.filter((t) => !t.agreed && !t.revoked);
  const inPreview = testers.filter((t) => t.agreed && !t.revoked);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Where everyone is</CardTitle>
            <CardDescription>
              {qy.isLoading
                ? "Reading…"
                : qy.isError
                  ? "Could not read this just now — refresh the page."
                  : `${rows.length - stuck.length} of ${rows.length} swimmers done · ` +
                    `${inPreview.length} of ${testers.length} testers in the preview`}
            </CardDescription>
          </div>
          {rows.length > 0 && (
            <Button variant="outline" size="sm" className="h-8" onClick={() => setOpen(!open)}>
              {open ? "Show only those stuck" : `Show all ${rows.length}`}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Machakos {stuck.length > 0 && `· ${stuck.length} still to sort`}
          </h4>
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {qy.isLoading ? "…" : "Everybody in the team is entered and paid up."}
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {shown.map((r) => {
                const s = stage(r);
                return (
                  <li
                    key={r.name}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 p-3 text-sm"
                  >
                    <span className="font-medium">{r.name}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {r.parent_name || "—"}
                      {r.parent_email ? ` · ${r.parent_email}` : ""}
                      {r.parent_phone ? ` · ${r.parent_phone}` : ""}
                    </span>
                    <span className={`text-xs font-medium ${s.tone}`}>{s.label}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Analytics preview {waiting.length > 0 && `· ${waiting.length} not in yet`}
          </h4>
          {testers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {qy.isLoading ? "…" : "No testers yet."}
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {testers.map((t) => (
                <li
                  key={t.email}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 p-3 text-sm"
                >
                  <span className="font-medium">{t.full_name || t.email}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {t.email}
                  </span>
                  <span
                    className={
                      "text-xs font-medium " +
                      (t.revoked
                        ? "text-muted-foreground"
                        : t.agreed
                          ? "text-emerald-700"
                          : t.sign_ins > 0
                            ? "text-amber-600"
                            : "text-destructive")
                    }
                  >
                    {t.revoked
                      ? "access withdrawn"
                      : t.agreed
                        ? "in the preview"
                        : t.sign_ins > 0
                          ? "signed in, agreement outstanding"
                          : "never signed in"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
