import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { TermsPanel } from "@/components/TermsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getSwimmers,
  isAuthed,
  getRegistration,
  saveRegistration,
  getPaid,
  getBalance,
  getStatus,
  getPaymentsFor,
  addPayment,
  isRegistered,
} from "@/lib/store";
import { EVENT, CONVENER, formatKes } from "@/lib/event-config";
import { registrationSchema, paymentSchema } from "@/lib/schemas";
import type { Swimmer, Registration, Payment } from "@/lib/schemas";
import { toast } from "sonner";

export const Route = createFileRoute("/parent")({
  component: ParentPage,
});

function ParentPage() {
  const navigate = useNavigate();
  const [swimmers, setSwimmers] = useState<Swimmer[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (!isAuthed()) {
      navigate({ to: "/" });
      return;
    }
    setSwimmers(getSwimmers());
  }, [navigate]);

  const selected = swimmers.find((s) => s.id === selectedId);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Register & pay</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {EVENT.name} · {EVENT.startDate} – {EVENT.endDate} · Total{" "}
            {formatKes(EVENT.totalKes)} per swimmer
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Select your swimmer</CardTitle>
            <CardDescription>Pick from the roster loaded by the convener.</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Choose swimmer…" />
              </SelectTrigger>
              <SelectContent>
                {swimmers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {isRegistered(s.id) ? " ✓" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selected && (
          <>
            <RegistrationSection swimmer={selected} key={"reg-" + selected.id} />
            <PaymentSection swimmer={selected} key={"pay-" + selected.id} />
          </>
        )}
      </main>
    </div>
  );
}

type RegFormState = {
  age: number | "";
  gender: "Male" | "Female" | "";
  sleepover: "Yes" | "No" | "";
  ownsCellphone: "Yes" | "No" | "";
  parent1Name: string;
  parent2Name: string;
  primaryPhone: string;
  secondaryPhone: string;
  dietary: string;
  allergies: string;
  healthConditions: string;
  specialRequests: string;
};

const FIELD_LABELS: Record<string, string> = {
  age: "Age",
  gender: "Gender",
  sleepover: "Spending the night with the team",
  ownsCellphone: "Owns a cellphone",
  parent1Name: "Parent 1 full name",
  primaryPhone: "Primary cell number",
};

function RegistrationSection({ swimmer }: { swimmer: Swimmer }) {
  const existing = getRegistration(swimmer.id);
  const [form, setForm] = useState<RegFormState>({
    age: existing?.age ?? swimmer.age ?? "",
    gender: existing?.gender ?? swimmer.gender ?? "",
    sleepover: existing?.sleepover ?? "",
    ownsCellphone: existing?.ownsCellphone ?? "",
    parent1Name: existing?.parent1Name ?? "",
    parent2Name: existing?.parent2Name ?? "",
    primaryPhone: existing?.primaryPhone ?? "",
    secondaryPhone: existing?.secondaryPhone ?? "",
    dietary: existing?.dietary ?? "",
    allergies: existing?.allergies ?? "",
    healthConditions: existing?.healthConditions ?? "",
    specialRequests: existing?.specialRequests ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const bannerRef = useRef<HTMLDivElement>(null);

  function update<K extends keyof RegFormState>(k: K, v: RegFormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      swimmerId: swimmer.id,
      updatedAt: new Date().toISOString(),
      age: form.age === "" ? undefined : form.age,
      gender: form.gender === "" ? undefined : form.gender,
      sleepover: form.sleepover === "" ? undefined : form.sleepover,
      ownsCellphone: form.ownsCellphone === "" ? undefined : form.ownsCellphone,
      parent1Name: form.parent1Name,
      parent2Name: form.parent2Name,
      primaryPhone: form.primaryPhone,
      secondaryPhone: form.secondaryPhone,
      dietary: form.dietary,
      allergies: form.allergies,
      healthConditions: form.healthConditions,
      specialRequests: form.specialRequests,
    };
    const parsed = registrationSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errs[issue.path.join(".")] = issue.message;
      }
      setErrors(errs);
      toast.error("Please fix the highlighted fields.");
      requestAnimationFrame(() => {
        bannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    setErrors({});
    saveRegistration(parsed.data);
    toast.success("Registration saved");
  }

  const errText = (k: string) =>
    errors[k] ? <p className="text-xs text-destructive mt-1">{errors[k]}</p> : null;
  const errRing = (k: string) =>
    errors[k] ? "border-destructive ring-1 ring-destructive/40" : "";
  const missingLabels = Object.keys(errors)
    .map((k) => FIELD_LABELS[k])
    .filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">2. Registration — {swimmer.name}</CardTitle>
        <CardDescription>
          {existing
            ? "Details on file. Update anything that's changed."
            : "Fill in the details below. You can come back later to complete payment."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6">
          {Object.keys(errors).length > 0 && (
            <div
              ref={bannerRef}
              className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <div className="font-medium mb-1">Please complete the required fields:</div>
              <ul className="list-disc pl-5 text-xs">
                {missingLabels.length > 0
                  ? missingLabels.map((l) => <li key={l}>{l}</li>)
                  : Object.values(errors).map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Swimmer
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Age</Label>
                <Input
                  type="number"
                  min={4}
                  max={25}
                  value={form.age === 0 ? "" : (form.age as number | "")}
                  onChange={(e) => update("age", parseInt(e.target.value, 10) as number)}
                  className="h-11"
                />
                {errText("age")}
              </div>
              <div>
                <Label>Gender</Label>
                <Select
                  value={form.gender as string}
                  onValueChange={(v) => update("gender", v as "Male" | "Female")}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
                {errText("gender")}
              </div>
              <div>
                <Label>Spending the night with the team?</Label>
                <Select
                  value={form.sleepover as string}
                  onValueChange={(v) => update("sleepover", v as "Yes" | "No")}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
                {errText("sleepover")}
              </div>
              <div>
                <Label>Owns a cellphone?</Label>
                <Select
                  value={form.ownsCellphone as string}
                  onValueChange={(v) => update("ownsCellphone", v as "Yes" | "No")}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Phones are collected and stored during the sleepover.
                </p>
                {errText("ownsCellphone")}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Parents / guardians
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Parent 1 full name</Label>
                <Input
                  className="h-11"
                  value={form.parent1Name}
                  onChange={(e) => update("parent1Name", e.target.value)}
                />
                {errText("parent1Name")}
              </div>
              <div>
                <Label>
                  Parent 2 full name{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  className="h-11"
                  value={form.parent2Name ?? ""}
                  onChange={(e) => update("parent2Name", e.target.value)}
                />
              </div>
              <div>
                <Label>Primary cell number</Label>
                <Input
                  className="h-11"
                  inputMode="tel"
                  value={form.primaryPhone}
                  onChange={(e) => update("primaryPhone", e.target.value)}
                  placeholder="+254 7XX XXX XXX"
                />
                {errText("primaryPhone")}
              </div>
              <div>
                <Label>
                  Secondary cell number{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  className="h-11"
                  inputMode="tel"
                  value={form.secondaryPhone ?? ""}
                  onChange={(e) => update("secondaryPhone", e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Health & requests
            </h3>
            <div className="grid gap-4">
              <div>
                <Label>
                  Dietary issues{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  rows={2}
                  value={form.dietary ?? ""}
                  onChange={(e) => update("dietary", e.target.value)}
                />
              </div>
              <div>
                <Label>
                  Allergies <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  rows={2}
                  value={form.allergies ?? ""}
                  onChange={(e) => update("allergies", e.target.value)}
                />
              </div>
              <div>
                <Label>
                  Health conditions we should know about{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  rows={2}
                  value={form.healthConditions ?? ""}
                  onChange={(e) => update("healthConditions", e.target.value)}
                />
              </div>
              <div>
                <Label>
                  Special requests{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  rows={3}
                  value={form.specialRequests ?? ""}
                  onChange={(e) => update("specialRequests", e.target.value)}
                />
              </div>
            </div>
          </section>

          <Button type="submit" size="lg" className="w-full sm:w-auto h-11">
            Save details
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PaymentSection({ swimmer }: { swimmer: Swimmer }) {
  const [tick, setTick] = useState(0); // force refresh after submit
  const registered = useMemo(() => isRegistered(swimmer.id), [swimmer.id, tick]);
  const paid = useMemo(() => getPaid(swimmer.id), [swimmer.id, tick]);
  const balance = useMemo(() => getBalance(swimmer.id), [swimmer.id, tick]);
  const status = useMemo(() => getStatus(swimmer.id), [swimmer.id, tick]);
  const history: Payment[] = useMemo(() => getPaymentsFor(swimmer.id), [swimmer.id, tick]);
  const pct = Math.min(100, Math.round((paid / EVENT.totalKes) * 100));

  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [type, setType] = useState<"Deposit" | "Partial" | "Final">("Deposit");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!registered) {
      setError("Save the swimmer's registration details first.");
      return;
    }
    const n = parseInt(amount, 10);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (n > balance) {
      setError(`Amount exceeds remaining balance (${formatKes(balance)}).`);
      return;
    }
    if (!reference.trim()) {
      setError("Enter your M-Pesa reference.");
      return;
    }
    if (!agreed) {
      setError("Please tick the rules & expectations box.");
      return;
    }
    const parsed = paymentSchema.safeParse({
      id: "tmp",
      swimmerId: swimmer.id,
      amount: n,
      reference: reference.trim(),
      type,
      createdAt: new Date().toISOString(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid payment.");
      return;
    }
    addPayment({ swimmerId: swimmer.id, amount: n, reference: reference.trim(), type });
    toast.success(
      `Payment recorded. Confirmation sent to ${CONVENER.email} (simulated).`,
      { duration: 5000 },
    );
    setAmount("");
    setReference("");
    setType("Deposit");
    setAgreed(false);
    setError(null);
    setTick((x) => x + 1);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">3. Payment — {swimmer.name}</CardTitle>
        <CardDescription>Log each M-Pesa payment as you make it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border bg-sky-50/60 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-lg font-semibold">{formatKes(EVENT.totalKes)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Paid</div>
              <div className="text-lg font-semibold text-emerald-700">{formatKes(paid)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className="text-lg font-semibold">{formatKes(balance)}</div>
            </div>
            <StatusBadge status={status} />
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        {balance > 0 ? (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="amount">Amount (KES)</Label>
                <Input
                  id="amount"
                  className="h-11"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={balance}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={String(balance)}
                />
              </div>
              <div>
                <Label htmlFor="ref">M-Pesa reference</Label>
                <Input
                  id="ref"
                  className="h-11"
                  value={reference}
                  onChange={(e) => setReference(e.target.value.toUpperCase())}
                  placeholder="e.g. QGH7X8Y2ZA"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Payment type</Label>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Deposit">Deposit</SelectItem>
                    <SelectItem value="Partial">Partial payment</SelectItem>
                    <SelectItem value="Final">Final payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TermsPanel checked={agreed} onCheckedChange={setAgreed} />

            {error && <p className="text-sm text-destructive">{error}</p>}
            {!registered && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                Please save registration details above before submitting a payment.
              </p>
            )}

            <Button type="submit" size="lg" className="w-full h-11">
              Submit payment
            </Button>
          </form>
        ) : (
          <div className="rounded-md border bg-emerald-50 border-emerald-200 p-4 text-sm text-emerald-800">
            🎉 Fully paid. Thank you!
          </div>
        )}

        {history.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Payment history</h4>
            <ul className="divide-y rounded-md border">
              {history.map((p) => (
                <li key={p.id} className="p-3 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{formatKes(p.amount)}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {new Date(p.createdAt).toLocaleString()} · Ref {p.reference}
                    </div>
                  </div>
                  <Badge variant="secondary">{p.type}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: "Unpaid" | "Partial" | "Paid" }) {
  const map = {
    Unpaid: "bg-slate-100 text-slate-700",
    Partial: "bg-amber-100 text-amber-800",
    Paid: "bg-emerald-100 text-emerald-800",
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${map[status]}`}>{status}</span>
  );
}
