import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import {
  isAuthed,
  getSwimmers,
  getRegistration,
  getPaymentsFor,
  getPaid,
  getBalance,
  getStatus,
  removeSwimmer,
  renameSwimmer,
} from "@/lib/store";
import { EVENT, formatKes } from "@/lib/event-config";
import { exportAllData, downloadCsv } from "@/lib/csv";
import type { Swimmer } from "@/lib/schemas";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Trash2, FileDown, Pencil, Check, X } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [tick, setTick] = useState(0);
  const [toDelete, setToDelete] = useState<Swimmer | null>(null);

  useEffect(() => {
    if (!isAuthed()) {
      navigate({ to: "/" });
      return;
    }
    setSwimmers(getSwimmers());
  }, [navigate, tick]);

  const refresh = () => setTick((x) => x + 1);

  function confirmDelete() {
    if (!toDelete) return;
    removeSwimmer(toDelete.id);
    toast.success(`Removed ${toDelete.name}`);
    setToDelete(null);
    refresh();
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
            onClick={() =>
              downloadCsv(
                `nextgen-nationals-${new Date().toISOString().slice(0, 10)}.csv`,
                exportAllData(),
              )
            }
          >
            <FileDown className="h-4 w-4" /> Export all (CSV)
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roster</CardTitle>
            <CardDescription>Add a swimmer or bulk-import from CSV.</CardDescription>
          </CardHeader>
          <CardContent>
            <RosterManager onChange={refresh} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Swimmers</CardTitle>
            <CardDescription>Click a row to see registration & payment details.</CardDescription>
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
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No swimmers yet. Add one above.
                      </TableCell>
                    </TableRow>
                  )}
                  {swimmers.map((s) => (
                    <SwimmerRow key={s.id} swimmer={s} onDelete={() => setToDelete(s)} onRename={refresh} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && (() => {
                const payments = getPaymentsFor(toDelete.id).length;
                const registered = !!getRegistration(toDelete.id);
                if (!payments && !registered) return "This swimmer has no data attached.";
                const parts: string[] = [];
                if (registered) parts.push("their registration");
                if (payments) parts.push(`${payments} payment record${payments === 1 ? "" : "s"}`);
                return `This will also delete ${parts.join(" and ")}. This cannot be undone.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SwimmerRow({
  swimmer,
  onDelete,
  onRename,
}: {
  swimmer: Swimmer;
  onDelete: () => void;
  onRename: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(swimmer.name);

  const reg = getRegistration(swimmer.id);
  const paid = getPaid(swimmer.id);
  const balance = getBalance(swimmer.id);
  const status = getStatus(swimmer.id);
  const payments = getPaymentsFor(swimmer.id);

  const hasFlag = !!(reg?.allergies || reg?.healthConditions || reg?.dietary);

  function saveName() {
    const n = nameDraft.trim();
    if (n && n !== swimmer.name) {
      renameSwimmer(swimmer.id, n);
      onRename();
      toast.success("Name updated");
    }
    setEditing(false);
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
                  <Info label="Gender" value={reg.gender} />
                  <Info label="Parent sleepover" value={reg.parentSleepover} />
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
                        <li key={p.id} className="p-3 flex items-center justify-between gap-3 text-sm">
                          <div>
                            <div className="font-medium">
                              {formatKes(p.amount)}
                              {n > 1 && (
                                <span className="text-xs font-normal text-muted-foreground ml-2">
                                  ({formatKes(p.amount / n)} credited)
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(p.createdAt).toLocaleString()} · Ref {p.reference}
                              {n > 1 ? ` · covers ${n} children` : ""}
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
