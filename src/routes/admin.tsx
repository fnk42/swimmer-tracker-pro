import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RosterManager } from "@/components/RosterManager";
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
import { isAuthed } from "@/lib/store";
import {
  useSwimmers,
  useRegistrations,
  usePayments,
  useRenameSwimmer,
  useDeleteSwimmer,
  paidForSwimmer,
  balanceForSwimmer,
  statusForSwimmer,
  paymentsForSwimmer,
} from "@/lib/api";
import { EVENT, formatKes } from "@/lib/event-config";
import { exportAllData, downloadCsv } from "@/lib/csv";
import type { Swimmer, Registration, Payment } from "@/lib/schemas";
import { registrationSchema } from "@/lib/schemas";
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
  const deleteMut = useDeleteSwimmer();

  useEffect(() => {
    if (!isAuthed()) navigate({ to: "/" });
  }, [navigate]);

  const swimmers = swimmersQ.data ?? [];
  const registrations = registrationsQ.data ?? [];
  const payments = paymentsQ.data ?? [];

  const registrationById = useMemo(() => {
    const m = new Map<string, Registration>();
    registrations.forEach((r) => m.set(r.swimmerId, r));
    return m;
  }, [registrations]);

  const loading =
    swimmersQ.isLoading || registrationsQ.isLoading || paymentsQ.isLoading;
  const errored =
    swimmersQ.isError || registrationsQ.isError || paymentsQ.isError;

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

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold">Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {EVENT.name} · {swimmers.length} swimmer{swimmers.length === 1 ? "" : "s"} ·{" "}
              {formatKes(EVENT.totalKes)} per head
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
            <HeadcountSummary swimmers={swimmers} registrations={registrations} />

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
  onDelete,
}: {
  swimmer: Swimmer;
  registration: Registration | undefined;
  payments: Payment[];
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
                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
                  Health note
                </Badge>
              )}
            </div>
          )}
        </TableCell>
        <TableCell className="hidden sm:table-cell text-sm">{reg?.age ?? swimmer.age ?? "—"}</TableCell>
        <TableCell className="hidden md:table-cell text-sm">{reg?.parentSleepover ?? "—"}</TableCell>
        <TableCell className="hidden md:table-cell text-sm">{reg?.primaryPhone ?? "—"}</TableCell>
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
          <TableCell colSpan={9} className="bg-slate-50 p-0">
            <div className="p-4 space-y-4">
              {reg ? (
                <div className="grid gap-4 sm:grid-cols-2 text-sm">
                  <Info label="Age" value={reg.age} />
                  <Info label="Swimmer gender" value={reg.gender} />
                  <Info label="Parent sleepover" value={reg.parentSleepover} />
                  <Info label="Parent/guardian gender" value={reg.guardianGender || "—"} />
                  <Info label="Owns cellphone" value={reg.ownsCellphone} />
                  <Info label="Parent 1" value={reg.parent1Name} />
                  <Info label="Parent 2" value={reg.parent2Name || "—"} />
                  <Info label="Primary phone" value={reg.primaryPhone} />
                  <Info label="Secondary phone" value={reg.secondaryPhone || "—"} />
                  <Info label="Dietary" value={reg.dietary || "—"} highlight={!!reg.dietary} />
                  <Info label="Allergies" value={reg.allergies || "—"} highlight={!!reg.allergies} />
                  <Info
                    label="Health conditions"
                    value={reg.healthConditions || "—"}
                    highlight={!!reg.healthConditions}
                  />
                  <Info label="Special requests" value={reg.specialRequests || "—"} />
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
      <div className={`text-sm ${highlight ? "text-amber-800 font-medium" : ""}`}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: "Unpaid" | "Partial" | "Paid" }) {
  const map = {
    Unpaid: "bg-slate-100 text-slate-700",
    Partial: "bg-amber-100 text-amber-800",
    Paid: "bg-emerald-100 text-emerald-800",
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${map[status]}`}>{status}</span>
  );
}

// A registration counts toward summary totals only when every required Zod
// field is present. Old rows saved before guardian_gender existed will be
// treated as incomplete until updated.
function isCompleteRegistration(reg: Registration): boolean {
  return registrationSchema.safeParse(reg).success;
}

type GroupedGuardian = {
  name: string;
  gender: "Male" | "Female" | undefined;
  phone: string;
  swimmerNames: string[];
};

function HeadcountSummary({
  swimmers,
  registrations,
}: {
  swimmers: Swimmer[];
  registrations: Registration[];
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

  const swimmerNameById = new Map(swimmers.map((s) => [s.id, s.name]));
  const completeStaying = registrations.filter(
    (r) => isCompleteRegistration(r) && r.parentSleepover === "Yes",
  );

  // Best-effort dedupe by parent/guardian identity: lowercased name + phone.
  // A proper parent entity is planned separately.
  const groupedMap = new Map<string, GroupedGuardian>();
  completeStaying.forEach((r) => {
    const key = `${(r.parent1Name || "").trim().toLowerCase()}|${(r.primaryPhone || "").trim()}`;
    const swimmerName = swimmerNameById.get(r.swimmerId) ?? "Unknown";
    const existing = groupedMap.get(key);
    if (existing) {
      if (!existing.swimmerNames.includes(swimmerName)) {
        existing.swimmerNames.push(swimmerName);
      }
    } else {
      groupedMap.set(key, {
        name: r.parent1Name,
        gender: r.guardianGender,
        phone: r.primaryPhone,
        swimmerNames: [swimmerName],
      });
    }
  });
  const guardians = [...groupedMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const stayingCount = guardians.length;
  const male = guardians.filter((g) => g.gender === "Male").length;
  const female = guardians.filter((g) => g.gender === "Female").length;

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
          sub={`${male} male · ${female} female`}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {female} female {female === 1 ? "parent/guardian" : "parents/guardians"} for {girls}{" "}
        {girls === 1 ? "girl" : "girls"} · {male} male{" "}
        {male === 1 ? "parent/guardian" : "parents/guardians"} for {boys}{" "}
        {boys === 1 ? "boy" : "boys"}
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
            {guardians.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground italic">
                No one confirmed to stay overnight yet.
              </p>
            ) : (
              guardians.map((g, i) => (
                <div
                  key={i}
                  className="p-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,2fr)_auto] sm:items-center"
                >
                  <div className="font-medium text-sm truncate">{g.name || "—"}</div>
                  <GenderPill gender={g.gender} />
                  <div className="text-xs text-muted-foreground truncate">
                    <span className="uppercase tracking-wide">Swimmers:</span>{" "}
                    {g.swimmerNames.join(", ")}
                  </div>
                  <div className="text-xs text-muted-foreground">{g.phone || "—"}</div>
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
      <span className="text-xs font-medium bg-sky-100 text-sky-900 px-2 py-0.5 rounded-full">
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
