import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RosterManager } from "@/components/RosterManager";
import { ClaimQueue } from "@/components/ClaimQueue";
import { ActivityLog } from "@/components/ActivityLog";
import { ParentImport } from "@/components/ParentImport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  useSwimmers,
  useRegistrations,
  usePayments,
  useParents,
  useSwimmerParents,
  useRenameSwimmer,
  useDeleteSwimmer,
  paidForSwimmer,
  balanceForSwimmer,
  statusForSwimmer,
  paymentsForSwimmer,
  parentsForSwimmer,
  useMe,
} from "@/lib/api";
import { EVENT, formatKes } from "@/lib/event-config";
import { exportAllData, downloadCsv } from "@/lib/csv";
import type {
  Swimmer,
  Registration,
  Payment,
  Parent,
  SwimmerParentLink,
} from "@/lib/schemas";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Trash2, FileDown, Pencil, Check, X } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [toDelete, setToDelete] = useState<Swimmer | null>(null);

  const swimmersQ = useSwimmers();
  const registrationsQ = useRegistrations();
  const paymentsQ = usePayments();
  const parentsQ = useParents();
  const linksQ = useSwimmerParents();
  const deleteMut = useDeleteSwimmer();

  // The gate is the signed session, not a localStorage flag. The old check
  // could be defeated with one line in the browser console; this one cannot,
  // and the admin API routes refuse unauthorised callers independently anyway.
  const me = useMe();
  useEffect(() => {
    if (me.isLoading) return;
    if (!me.data?.signedIn) navigate({ to: "/" });
    else if (!me.data.isAdmin) navigate({ to: "/parent" });
  }, [me.isLoading, me.data, navigate]);

  const swimmers = swimmersQ.data ?? [];
  const registrations = registrationsQ.data ?? [];
  const payments = paymentsQ.data ?? [];

  // Club-level totals. paidForSwimmer already divides a multi-child payment by
  // the number of children it covers, so summing it never double-counts.
  const totals = useMemo(() => {
    const registeredIds = new Set(registrations.map((r) => r.swimmerId));
    let collected = 0;
    let paidInFull = 0;
    for (const s of swimmers) {
      const paid = paidForSwimmer(payments, s.id);
      collected += paid;
      if (paid >= EVENT.totalKes) paidInFull += 1;
    }
    return {
      collected,
      // What the club is still owed by everyone on the roster.
      outstanding: swimmers.reduce(
        (sum, s) => sum + Math.max(0, EVENT.totalKes - paidForSwimmer(payments, s.id)),
        0,
      ),
      registered: registeredIds.size,
      paidInFull,
    };
  }, [swimmers, registrations, payments]);
  const parents = parentsQ.data ?? [];
  const links = linksQ.data ?? [];

  const registrationById = useMemo(() => {
    const m = new Map<string, Registration>();
    registrations.forEach((r) => m.set(r.swimmerId, r));
    return m;
  }, [registrations]);

  const loading =
    swimmersQ.isLoading ||
    registrationsQ.isLoading ||
    paymentsQ.isLoading ||
    parentsQ.isLoading ||
    linksQ.isLoading;
  const errored =
    swimmersQ.isError ||
    registrationsQ.isError ||
    paymentsQ.isError ||
    parentsQ.isError ||
    linksQ.isError;

  async function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    try {
      await deleteMut.mutateAsync(target.id);
      toast.success(`Removed ${target.name}`);
      setToDelete(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete swimmer.";
      toast.error(msg);
    }
  }

  if (me.isLoading || !me.data?.isAdmin) return null;

  return (
    <div className="min-h-screen bg-secondary">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold">Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {EVENT.name} · {swimmers.length} in the squad · {formatKes(EVENT.totalKes)} per head
            </p>
          </div>
          <Button
            variant="outline"
            disabled={loading || errored}
            onClick={() =>
              downloadCsv(
                `nextgen-nationals-${new Date().toISOString().slice(0, 10)}.csv`,
                exportAllData({ swimmers, registrations, payments }),
              )
            }
          >
            <FileDown className="h-4 w-4" /> Export all (CSV)
          </Button>
        </div>

        {!loading && !errored && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Collected", value: formatKes(totals.collected), tone: "text-emerald-700" },
              { label: "Outstanding", value: formatKes(totals.outstanding), tone: "text-amber-700" },
              { label: "Registered", value: `${totals.registered} of ${swimmers.length}`, tone: "" },
              { label: "Paid in full", value: `${totals.paidInFull} of ${swimmers.length}`, tone: "" },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="py-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </div>
                  <div className={`text-lg font-semibold mt-1 ${s.tone}`}>{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {loading ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground text-center">
              Loading admin data…
            </CardContent>
          </Card>
        ) : errored ? (
          <Card>
            <CardContent className="py-6 text-sm text-destructive">
              Couldn't load data from the server. Please refresh.
            </CardContent>
          </Card>
        ) : (
          <>
            <HeadcountSummary
              swimmers={swimmers}
              registrations={registrations}
              parents={parents}
              links={links}
            />

            {/* The ask first: the parent list is what unblocks every family. */}
            <ParentImport onDone={() => swimmersQ.refetch()} />

            {/* Then approvals: a claim nobody looks at is a parent locked out. */}
            <ClaimQueue />

            <section className="mt-8">
              <ActivityLog />
            </section>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Roster</CardTitle>
                <CardDescription>Add a swimmer or bulk-import from CSV.</CardDescription>
              </CardHeader>
              <CardContent>
                <RosterManager />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Swimmers</CardTitle>
                <CardDescription>
                  Click a row to see registration & payment details.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="hidden sm:table-cell">Age</TableHead>
                        <TableHead className="hidden md:table-cell">Parent sleepover</TableHead>
                        <TableHead className="hidden md:table-cell">Contact</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {swimmers.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={9}
                            className="text-center text-muted-foreground py-8"
                          >
                            No swimmers yet. Add one above.
                          </TableCell>
                        </TableRow>
                      )}
                      {swimmers.map((s) => (
                        <SwimmerRow
                          key={s.id}
                          swimmer={s}
                          registration={registrationById.get(s.id)}
                          payments={payments}
                          parents={parentsForSwimmer(links, parents, s.id)}
                          onDelete={() => setToDelete(s)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete &&
                (() => {
                  const payCount = paymentsForSwimmer(payments, toDelete.id).length;
                  const registered = !!registrationById.get(toDelete.id);
                  if (!payCount && !registered) return "This swimmer has no data attached.";
                  const parts: string[] = [];
                  if (registered) parts.push("their registration");
                  if (payCount)
                    parts.push(`${payCount} payment record${payCount === 1 ? "" : "s"}`);
                  return `This will also delete ${parts.join(" and ")}. This cannot be undone.`;
                })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SwimmerRow({
  swimmer,
  registration: reg,
  payments: allPayments,
  parents,
  onDelete,
}: {
  swimmer: Swimmer;
  registration: Registration | undefined;
  payments: Payment[];
  parents: Parent[];
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(swimmer.name);
  const renameMut = useRenameSwimmer();

  const paid = paidForSwimmer(allPayments, swimmer.id);
  const balance = balanceForSwimmer(allPayments, swimmer.id);
  const status = statusForSwimmer(allPayments, swimmer.id);
  const payments = useMemo(
    () => paymentsForSwimmer(allPayments, swimmer.id),
    [allPayments, swimmer.id],
  );

  const hasFlag = !!(reg?.allergies || reg?.healthConditions || reg?.dietary);

  // Sleepover status per swimmer, aggregated across all linked parents:
  //   any "Yes" -> "Yes"
  //   all "No"  -> "No"
  //   mixed / has "Yet to decide" -> "Yet to decide"
  //   no parents linked -> null (renders as "—")
  const sleepoverAggregate: "Yes" | "No" | "Yet to decide" | null = (() => {
    if (parents.length === 0) return null;
    if (parents.some((p) => p.stayingOvernight === "Yes")) return "Yes";
    if (parents.every((p) => p.stayingOvernight === "No")) return "No";
    return "Yet to decide";
  })();

  const primaryPhone = parents[0]?.phone ?? null;

  async function saveName() {
    const n = nameDraft.trim();
    if (!n || n === swimmer.name) {
      setEditing(false);
      return;
    }
    try {
      await renameMut.mutateAsync({ id: swimmer.id, name: n });
      toast.success("Name updated");
      setEditing(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to rename.";
      toast.error(msg);
    }
  }

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => !editing && setOpen((o) => !o)}>
        <TableCell>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell onClick={(e) => editing && e.stopPropagation()}>
          {editing ? (
            <div className="flex items-center gap-1">
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="h-8"
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
              <Button size="icon" variant="ghost" onClick={saveName}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setNameDraft(swimmer.name);
                  setEditing(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium">{swimmer.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditing(true);
                }}
                className="text-muted-foreground hover:text-foreground opacity-0 hover:opacity-100 focus:opacity-100 [tr:hover_&]:opacity-100"
                aria-label="Rename"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              {hasFlag && (
                <Badge variant="outline" className="bg-amber-50/70 text-amber-700 border-amber-200 text-[10px]">
                  Health note
                </Badge>
              )}
            </div>
          )}
        </TableCell>
        <TableCell className="hidden sm:table-cell text-sm">{reg?.age ?? swimmer.age ?? "—"}</TableCell>
        <TableCell className="hidden md:table-cell text-sm">{sleepoverAggregate ?? "—"}</TableCell>
        <TableCell className="hidden md:table-cell text-sm">{primaryPhone ?? "—"}</TableCell>
        <TableCell className="text-right text-sm">{formatKes(paid)}</TableCell>
        <TableCell className="text-right text-sm">{formatKes(balance)}</TableCell>
        <TableCell>
          <StatusPill status={status} />
        </TableCell>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete swimmer">
            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={9} className="bg-secondary p-0">
            <div className="p-4 space-y-4">
              {reg ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2 text-sm">
                    <Info label="Age" value={reg.age} />
                    <Info label="Swimmer gender" value={reg.gender} />
                    <Info label="Owns cellphone" value={reg.ownsCellphone} />
                    <Info label="Dietary" value={reg.dietary || "—"} highlight={!!reg.dietary} />
                    <Info label="Allergies" value={reg.allergies || "—"} highlight={!!reg.allergies} />
                    <Info
                      label="Health conditions"
                      value={reg.healthConditions || "—"}
                      highlight={!!reg.healthConditions}
                    />
                    <Info label="Special requests" value={reg.specialRequests || "—"} />
                  </div>
                  <ParentDetailBlock parents={parents} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No registration submitted yet.
                </p>
              )}

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Payment history
                </div>
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No payments recorded.</p>
                ) : (
                  <ul className="divide-y rounded-md border bg-white">
                    {payments.map((p) => {
                      const n = p.childCount && p.childCount > 0 ? p.childCount : 1;
                      return (
                        <li key={p.id} className="p-3 flex items-start justify-between gap-3 text-sm">
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="font-semibold">{formatKes(p.amount)}</span>
                              {n > 1 && (
                                <span className="text-xs text-muted-foreground">
                                  ({formatKes(p.amount / n)} credited · covers {n} children)
                                </span>
                              )}
                            </div>
                            <div className="text-xs">
                              <span className="text-muted-foreground">Ref </span>
                              <span className="font-mono font-medium text-foreground break-all">
                                {p.reference}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(p.createdAt).toLocaleString()}
                            </div>
                          </div>
                          <Badge variant="secondary">{p.type}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function Info({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-sm ${highlight ? "text-amber-700 font-medium" : ""}`}>{value}</div>
    </div>
  );
}

function ParentDetailBlock({ parents }: { parents: Parent[] }) {
  if (parents.length === 0) {
    return (
      <div className="rounded-md border bg-white p-3 text-sm text-muted-foreground italic">
        No parents linked yet.
      </div>
    );
  }
  return (
    <div className="rounded-md border bg-white divide-y">
      {parents.map((p, i) => (
        <div key={p.id} className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Parent {i + 1}
              </span>
              <span className="font-medium text-sm truncate">{p.fullName}</span>
            </div>
            <GenderPill gender={p.gender ?? undefined} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3 text-xs text-muted-foreground">
            <div>
              <div className="uppercase tracking-wide text-[10px]">Staying overnight</div>
              <div className="text-sm text-foreground">{p.stayingOvernight}</div>
            </div>
            <div>
              <div className="uppercase tracking-wide text-[10px]">Phone</div>
              <div className="text-sm text-foreground font-mono">{p.phone}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: "Unpaid" | "Partial" | "Paid" }) {
  const map = {
    Unpaid: "bg-secondary text-foreground",
    Partial: "bg-amber-100/70 text-amber-700",
    Paid: "bg-emerald-100/70 text-emerald-700",
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${map[status]}`}>{status}</span>
  );
}

function HeadcountSummary({
  swimmers,
  registrations,
  parents,
  links,
}: {
  swimmers: Swimmer[];
  registrations: Registration[];
  parents: Parent[];
  links: SwimmerParentLink[];
}) {
  const [showList, setShowList] = useState(false);

  const regBySwimmer = useMemo(() => {
    const m = new Map<string, Registration>();
    registrations.forEach((r) => m.set(r.swimmerId, r));
    return m;
  }, [registrations]);
  const swimmerGender = (s: Swimmer) => regBySwimmer.get(s.id)?.gender ?? s.gender;
  const boys = swimmers.filter((s) => swimmerGender(s) === "Male").length;
  const girls = swimmers.filter((s) => swimmerGender(s) === "Female").length;

  // Which swimmers each parent is linked to. Deduped by parent id.
  const namesByParent = useMemo(() => {
    const swimmerNameById = new Map(swimmers.map((s) => [s.id, s.name]));
    const m = new Map<string, string[]>();
    links.forEach((l) => {
      const nm = swimmerNameById.get(l.swimmerId);
      if (!nm) return;
      const bucket = m.get(l.parentId);
      if (bucket) {
        if (!bucket.includes(nm)) bucket.push(nm);
      } else {
        m.set(l.parentId, [nm]);
      }
    });
    return m;
  }, [links, swimmers]);

  // Count staying parents even when the swimmer's registration is incomplete —
  // stayingOvernight is a fact about the parent, not the registration form.
  const stayingParents = useMemo(
    () =>
      parents
        .filter((p) => p.stayingOvernight === "Yes")
        .filter((p) => (namesByParent.get(p.id)?.length ?? 0) > 0)
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [parents, namesByParent],
  );

  const stayingCount = stayingParents.length;
  const male = stayingParents.filter((p) => p.gender === "Male").length;
  const female = stayingParents.filter((p) => p.gender === "Female").length;
  const unspecified = stayingCount - male - female;

  const summarySub = [
    `${male} male`,
    `${female} female`,
    ...(unspecified > 0 ? [`${unspecified} unspecified`] : []),
  ].join(" · ");

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard
          title="Swimmers"
          primary={swimmers.length}
          sub={`${boys} boys · ${girls} girls`}
        />
        <SummaryCard
          title="Parents/guardians staying"
          primary={stayingCount}
          sub={summarySub}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {female} female {female === 1 ? "parent/guardian" : "parents/guardians"} for {girls}{" "}
        {girls === 1 ? "girl" : "girls"} · {male} male{" "}
        {male === 1 ? "parent/guardian" : "parents/guardians"} for {boys}{" "}
        {boys === 1 ? "boy" : "boys"}
        {unspecified > 0 && (
          <>
            {" "}
            · {unspecified} unspecified
          </>
        )}
      </p>
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowList((v) => !v)}
          className="gap-1"
        >
          {showList ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Parents/guardians staying overnight ({stayingCount})
        </Button>
        {showList && (
          <div className="mt-3 rounded-md border bg-white divide-y">
            {stayingParents.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground italic">
                No one confirmed to stay overnight yet.
              </p>
            ) : (
              stayingParents.map((p) => (
                <div
                  key={p.id}
                  className="p-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,2fr)_auto] sm:items-center"
                >
                  <div className="font-medium text-sm truncate">{p.fullName}</div>
                  <GenderPill gender={p.gender ?? undefined} />
                  <div className="text-xs text-muted-foreground truncate">
                    <span className="uppercase tracking-wide">Swimmers:</span>{" "}
                    {(namesByParent.get(p.id) ?? []).join(", ")}
                  </div>
                  <div className="text-xs text-muted-foreground">{p.phone}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  primary,
  sub,
}: {
  title: string;
  primary: number;
  sub: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{primary}</div>
      <div className="mt-0.5 text-sm text-muted-foreground">{sub}</div>
    </div>
  );
}

function GenderPill({ gender }: { gender: "Male" | "Female" | undefined }) {
  if (gender === "Male") {
    return (
      <span className="text-xs font-medium bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
        Male
      </span>
    );
  }
  if (gender === "Female") {
    return (
      <span className="text-xs font-medium bg-rose-100 text-rose-900 px-2 py-0.5 rounded-full">
        Female
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground italic">Unspecified</span>;
}
