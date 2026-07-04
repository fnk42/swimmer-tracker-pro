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
import { isAuthed } from "@/lib/store";
import {
  useSwimmers,
  useRegistrations,
  usePayments,
  useParents,
  useSaveRegistration,
  useSaveParent,
  useLinkParent,
  useAddPayment,
  paidForSwimmer,
  paymentsForSwimmer,
  statusForSwimmer,
} from "@/lib/api";
import { EVENT, PAYMENT, formatKes } from "@/lib/event-config";
import { registrationSchema, paymentSchema } from "@/lib/schemas";
import type { Swimmer, Registration, Payment, Parent } from "@/lib/schemas";
import { toast } from "sonner";
import { Check, Copy, X } from "lucide-react";

export const Route = createFileRoute("/parent")({
  component: ParentPage,
});

function ParentPage() {
  const navigate = useNavigate();
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [linkedParents, setLinkedParents] = useState<Parent[]>([]);
  const [linkedSwimmerIds, setLinkedSwimmerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const linkParentMut = useLinkParent();
  const swimmersQ = useSwimmers();
  const registrationsQ = useRegistrations();
  const paymentsQ = usePayments();

  useEffect(() => {
    if (!isAuthed()) navigate({ to: "/" });
  }, [navigate]);

  const swimmers = swimmersQ.data ?? [];
  const registrations = registrationsQ.data ?? [];
  const payments = paymentsQ.data ?? [];

  const registeredIds = useMemo(
    () => new Set(registrations.map((r) => r.swimmerId)),
    [registrations],
  );

  const groupSwimmers = useMemo(
    () =>
      groupIds
        .map((id) => swimmers.find((s) => s.id === id))
        .filter((s): s is Swimmer => !!s),
    [groupIds, swimmers],
  );
  const available = useMemo(
    () => swimmers.filter((s) => !groupIds.includes(s.id)),
    [swimmers, groupIds],
  );

  async function autoLinkNewSwimmer(swimmerId: string, parents: Parent[]) {
    try {
      for (let i = 0; i < parents.length; i++) {
        await linkParentMut.mutateAsync({
          swimmerId,
          parentId: parents[i].id,
          sortOrder: i + 1,
        });
      }
      setLinkedSwimmerIds((s) => {
        const next = new Set(s);
        next.add(swimmerId);
        return next;
      });
      toast.success(
        parents.length === 1
          ? "Parent auto-linked to added swimmer."
          : "Parents auto-linked to added swimmer.",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to auto-link parents.";
      toast.error(msg);
    }
  }

  function addChild(id: string) {
    if (!id || groupIds.includes(id)) return;
    setGroupIds((g) => [...g, id]);
    if (linkedParents.length > 0 && !linkedSwimmerIds.has(id)) {
      autoLinkNewSwimmer(id, linkedParents);
    }
  }
  function removeChild(id: string) {
    setGroupIds((g) => {
      const next = g.filter((x) => x !== id);
      if (next.length === 0) {
        setLinkedParents([]);
        setLinkedSwimmerIds(new Set());
      }
      return next;
    });
    setLinkedSwimmerIds((s) => {
      if (!s.has(id)) return s;
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }

  function handleParentsLinked(parents: Parent[], swimmerIds: string[]) {
    setLinkedParents(parents);
    setLinkedSwimmerIds(new Set(swimmerIds));
  }

  const loading =
    swimmersQ.isLoading || registrationsQ.isLoading || paymentsQ.isLoading;
  const errored =
    swimmersQ.isError || registrationsQ.isError || paymentsQ.isError;

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

        {loading ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground text-center">
              Loading roster…
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  1. Select your swimmer{groupIds.length > 1 ? "s" : ""}
                </CardTitle>
                <CardDescription>
                  Adding more than one child lets you pay for all of them with a single M-Pesa
                  transaction.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupSwimmers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {groupSwimmers.map((s) => (
                      <span
                        key={s.id}
                        className="inline-flex items-center gap-1 rounded-full bg-sky-100 text-sky-900 text-xs font-medium pl-3 pr-1 py-1"
                      >
                        {s.name}
                        {registeredIds.has(s.id) ? " ✓" : ""}
                        <button
                          type="button"
                          onClick={() => removeChild(s.id)}
                          className="rounded-full hover:bg-sky-200 p-0.5"
                          aria-label={`Remove ${s.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {available.length > 0 ? (
                  <Select value="" onValueChange={addChild}>
                    <SelectTrigger className="h-11">
                      <SelectValue
                        placeholder={
                          groupSwimmers.length === 0
                            ? "Choose swimmer…"
                            : "+ Add another child…"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {registeredIds.has(s.id) ? " ✓" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : groupSwimmers.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No more swimmers available to add.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Roster is empty — ask the event coordinator to add you.
                  </p>
                )}
              </CardContent>
            </Card>

            {groupSwimmers.length > 0 && (
              <ParentSection
                swimmers={groupSwimmers}
                onLinked={handleParentsLinked}
              />
            )}

            {groupSwimmers.map((s, i) => (
              <RegistrationSection
                key={"reg-" + s.id}
                swimmer={s}
                number={i + 3}
                existing={registrations.find((r) => r.swimmerId === s.id)}
                parents={linkedParents}
              />
            ))}

            {groupSwimmers.length > 0 && (
              <PaymentSection
                swimmers={groupSwimmers}
                sectionNumber={groupSwimmers.length + 3}
                registrations={registrations}
                payments={payments}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

type RegFormState = {
  age: number | "";
  gender: "Male" | "Female" | "";
  ownsCellphone: "Yes" | "No" | "";
  dietary: string;
  allergies: string;
  healthConditions: string;
  specialRequests: string;
};

const FIELD_LABELS: Record<string, string> = {
  age: "Age",
  gender: "Gender",
  ownsCellphone: "Owns a cellphone",
};

// Kenya mobile normalizer — mirrors the parents_phone_normalized_chk constraint.
function normalizeKePhone(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  if (/^254[0-9]{9}$/.test(digits)) return digits;
  if (/^0[0-9]{9}$/.test(digits)) return "254" + digits.slice(1);
  if (/^[17][0-9]{8}$/.test(digits)) return "254" + digits;
  return null;
}

function RegistrationSection({
  swimmer,
  number,
  existing,
  parents,
}: {
  swimmer: Swimmer;
  number: number;
  existing?: Registration;
  parents: Parent[];
}) {
  const [form, setForm] = useState<RegFormState>({
    age: existing?.age ?? swimmer.age ?? "",
    gender: existing?.gender ?? swimmer.gender ?? "",
    ownsCellphone: existing?.ownsCellphone ?? "",
    dietary: existing?.dietary ?? "",
    allergies: existing?.allergies ?? "",
    healthConditions: existing?.healthConditions ?? "",
    specialRequests: existing?.specialRequests ?? "",
  });
  const parentsLinked = parents.length > 0;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const bannerRef = useRef<HTMLDivElement>(null);
  const [hasSaved, setHasSaved] = useState<boolean>(!!existing);
  const [collapsed, setCollapsed] = useState<boolean>(!!existing);
  const saveMut = useSaveRegistration();

  function update<K extends keyof RegFormState>(k: K, v: RegFormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!parentsLinked) {
      toast.error("Save parents first.");
      return;
    }
    const p1 = parents[0];
    const p2 = parents[1];
    const payload: Record<string, unknown> = {
      swimmerId: swimmer.id,
      updatedAt: new Date().toISOString(),
      age: form.age === "" ? undefined : form.age,
      gender: form.gender === "" ? undefined : form.gender,
      guardianGender: p1.gender ?? undefined,
      parentSleepover: p1.stayingOvernight,
      ownsCellphone: form.ownsCellphone === "" ? undefined : form.ownsCellphone,
      parent1Name: p1.fullName,
      parent2Name: p2?.fullName ?? "",
      primaryPhone: p1.phone,
      secondaryPhone: p2?.phone ?? "",
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
    try {
      await saveMut.mutateAsync(parsed.data);
      setHasSaved(true);
      setCollapsed(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save.";
      toast.error(msg);
    }
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
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="text-base">
              {number}. Registration — {swimmer.name}
            </CardTitle>
            {!collapsed && (
              <CardDescription>
                {existing
                  ? "Details on file. Update anything that's changed."
                  : "Fill in the details below. You can come back later to complete payment."}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasSaved && <SavedCrumb label="Registration saved" />}
            {hasSaved && collapsed && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setCollapsed(false)}
              >
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {!collapsed && (
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
                    value={form.age === "" ? "" : form.age}
                    onChange={(e) => {
                      const v = e.target.value;
                      update("age", v === "" ? "" : parseInt(v, 10));
                    }}
                    className={`h-11 ${errRing("age")}`}
                  />
                  {errText("age")}
                </div>
                <div>
                  <Label>Gender</Label>
                  <Select
                    value={form.gender}
                    onValueChange={(v) => update("gender", v as "Male" | "Female")}
                  >
                    <SelectTrigger className={`h-11 ${errRing("gender")}`}>
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
                  <Label>Swimmer owns a cellphone?</Label>
                  <Select
                    value={form.ownsCellphone}
                    onValueChange={(v) => update("ownsCellphone", v as "Yes" | "No")}
                  >
                    <SelectTrigger className={`h-11 ${errRing("ownsCellphone")}`}>
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
                    Allergies{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
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

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="submit"
                size="lg"
                className="w-full sm:w-auto h-11"
                disabled={saveMut.isPending || !parentsLinked}
              >
                {saveMut.isPending ? "Saving…" : "Save details"}
              </Button>
              {!parentsLinked && (
                <p className="text-xs text-muted-foreground">
                  Save the parent/guardian section above first.
                </p>
              )}
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  );
}

type ParentFormRow = {
  phone: string;
  fullName: string;
  gender: "Male" | "Female" | "";
  stayingOvernight: "Yes" | "No" | "Yet to decide" | "";
  matchedParentId?: string;
};

function emptyParentRow(): ParentFormRow {
  return { phone: "", fullName: "", gender: "", stayingOvernight: "" };
}

function ParentSection({
  swimmers,
  onLinked,
}: {
  swimmers: Swimmer[];
  onLinked: (parents: Parent[], swimmerIds: string[]) => void;
}) {
  const parentsQ = useParents();
  const saveParent = useSaveParent();
  const linkParent = useLinkParent();

  const parentsList = parentsQ.data ?? [];
  const [parent1, setParent1] = useState<ParentFormRow>(emptyParentRow);
  const [parent2, setParent2] = useState<ParentFormRow | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const busy = saveParent.isPending || linkParent.isPending;

  function tryPrefill(row: ParentFormRow): ParentFormRow {
    const norm = normalizeKePhone(row.phone);
    if (!norm) return { ...row, matchedParentId: undefined };
    const hit = parentsList.find((p) => p.phone === norm);
    if (!hit) return { ...row, matchedParentId: undefined };
    return {
      phone: row.phone,
      fullName: hit.fullName,
      gender: hit.gender ?? "",
      stayingOvernight: hit.stayingOvernight,
      matchedParentId: hit.id,
    };
  }

  function updateParent1<K extends keyof ParentFormRow>(k: K, v: ParentFormRow[K]) {
    setParent1((prev) => ({ ...prev, [k]: v, matchedParentId: undefined }));
  }
  function updateParent2<K extends keyof ParentFormRow>(k: K, v: ParentFormRow[K]) {
    setParent2((prev) => (prev ? { ...prev, [k]: v, matchedParentId: undefined } : prev));
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!parent1.fullName.trim()) errs.p1FullName = "Full name required";
    if (!parent1.gender) errs.p1Gender = "Gender required";
    if (!parent1.stayingOvernight) errs.p1Sleepover = "Answer required";
    if (!normalizeKePhone(parent1.phone)) errs.p1Phone = "Enter a valid Kenyan number";
    if (parent2) {
      if (!parent2.fullName.trim()) errs.p2FullName = "Full name required";
      if (!parent2.stayingOvernight) errs.p2Sleepover = "Answer required";
      if (!normalizeKePhone(parent2.phone)) errs.p2Phone = "Enter a valid Kenyan number";
    }
    return errs;
  }

  async function persistOne(
    row: ParentFormRow,
    normalizedPhone: string,
  ): Promise<Parent> {
    if (row.matchedParentId) {
      const hit = parentsList.find((p) => p.id === row.matchedParentId);
      if (hit) return hit;
    }
    return await saveParent.mutateAsync({
      fullName: row.fullName.trim(),
      gender: row.gender === "" ? null : row.gender,
      phone: normalizedPhone,
      stayingOvernight: (row.stayingOvernight || "Yet to decide") as
        | "Yes"
        | "No"
        | "Yet to decide",
    });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Please complete the highlighted fields.");
      return;
    }
    try {
      const p1Row = await persistOne(parent1, normalizeKePhone(parent1.phone)!);
      let p2Row: Parent | null = null;
      if (parent2) {
        p2Row = await persistOne(parent2, normalizeKePhone(parent2.phone)!);
      }
      const linked: Parent[] = p2Row ? [p1Row, p2Row] : [p1Row];
      const linkedSwimmerIds: string[] = [];
      for (const s of swimmers) {
        await linkParent.mutateAsync({
          swimmerId: s.id,
          parentId: p1Row.id,
          sortOrder: 1,
        });
        if (p2Row) {
          await linkParent.mutateAsync({
            swimmerId: s.id,
            parentId: p2Row.id,
            sortOrder: 2,
          });
        }
        linkedSwimmerIds.push(s.id);
      }
      onLinked(linked, linkedSwimmerIds);
      setSavedCount(linked.length);
      setSaved(true);
      setCollapsed(true);
      toast.success(
        linked.length === 1
          ? "Parent saved and linked."
          : "Both parents saved and linked.",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save.";
      toast.error(msg);
    }
  }

  const errText = (k: string) =>
    errors[k] ? <p className="text-xs text-destructive mt-1">{errors[k]}</p> : null;
  const errRing = (k: string) =>
    errors[k] ? "border-destructive ring-1 ring-destructive/40" : "";

  const isMulti = swimmers.length > 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="text-base">2. Parent / guardian details</CardTitle>
            {!collapsed && (
              <CardDescription>
                {isMulti
                  ? "Same parents will be linked to all selected swimmers."
                  : "Enter the parent/guardian for this swimmer."}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saved && (
              <SavedCrumb
                label={
                  savedCount === 1
                    ? "1 parent linked"
                    : `${savedCount} parents linked`
                }
              />
            )}
            {saved && collapsed && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setCollapsed(false)}
              >
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent>
          <form onSubmit={onSave} className="space-y-6">
            <ParentRowFields
              title="Parent 1"
              row={parent1}
              onChange={updateParent1}
              onPhoneBlur={() => setParent1((r) => tryPrefill(r))}
              errText={errText}
              errRing={errRing}
              keyPrefix="p1"
              genderRequired
            />

            {parent2 !== null && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Parent 2
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setParent2(null);
                      setErrors((e) => {
                        const next = { ...e };
                        delete next.p2FullName;
                        delete next.p2Gender;
                        delete next.p2Phone;
                        delete next.p2Sleepover;
                        return next;
                      });
                    }}
                  >
                    Remove
                  </Button>
                </div>
                <ParentRowFields
                  title=""
                  row={parent2}
                  onChange={updateParent2}
                  onPhoneBlur={() => setParent2((r) => (r ? tryPrefill(r) : r))}
                  errText={errText}
                  errRing={errRing}
                  keyPrefix="p2"
                  genderRequired={false}
                />
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {parent2 === null && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setParent2(emptyParentRow())}
                >
                  + Add second parent/guardian
                </Button>
              )}
              <Button
                type="submit"
                size="lg"
                className="w-full sm:w-auto h-11"
                disabled={busy}
              >
                {busy ? "Saving…" : "Save parents"}
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  );
}

function ParentRowFields({
  title,
  row,
  onChange,
  onPhoneBlur,
  errText,
  errRing,
  keyPrefix,
  genderRequired,
}: {
  title: string;
  row: ParentFormRow;
  onChange: <K extends keyof ParentFormRow>(k: K, v: ParentFormRow[K]) => void;
  onPhoneBlur: () => void;
  errText: (k: string) => React.ReactNode;
  errRing: (k: string) => string;
  keyPrefix: "p1" | "p2";
  genderRequired: boolean;
}) {
  return (
    <section className="space-y-4">
      {title && (
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h3>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Cell number</Label>
          <Input
            className={`h-11 ${errRing(`${keyPrefix}Phone`)}`}
            inputMode="tel"
            value={row.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            onBlur={onPhoneBlur}
            placeholder="+254 7XX XXX XXX"
          />
          {row.matchedParentId && (
            <p className="text-[11px] text-emerald-700 mt-1">
              Matched existing parent — fields prefilled.
            </p>
          )}
          {errText(`${keyPrefix}Phone`)}
        </div>
        <div>
          <Label>Full name</Label>
          <Input
            className={`h-11 ${errRing(`${keyPrefix}FullName`)}`}
            value={row.fullName}
            onChange={(e) => onChange("fullName", e.target.value)}
          />
          {errText(`${keyPrefix}FullName`)}
        </div>
        <div>
          <Label>
            Gender
            {!genderRequired && (
              <span className="text-muted-foreground font-normal"> (optional)</span>
            )}
          </Label>
          <Select
            value={row.gender}
            onValueChange={(v) => onChange("gender", v as "Male" | "Female")}
          >
            <SelectTrigger className={`h-11 ${errRing(`${keyPrefix}Gender`)}`}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
            </SelectContent>
          </Select>
          {errText(`${keyPrefix}Gender`)}
        </div>
        <div>
          <Label>Staying the night with the team?</Label>
          <Select
            value={row.stayingOvernight}
            onValueChange={(v) =>
              onChange("stayingOvernight", v as "Yes" | "No" | "Yet to decide")
            }
          >
            <SelectTrigger className={`h-11 ${errRing(`${keyPrefix}Sleepover`)}`}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Yes">Yes</SelectItem>
              <SelectItem value="No">No</SelectItem>
              <SelectItem value="Yet to decide">Yet to decide</SelectItem>
            </SelectContent>
          </Select>
          {errText(`${keyPrefix}Sleepover`)}
        </div>
      </div>
    </section>
  );
}

function SavedCrumb({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
      <Check className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed — long-press to copy manually.");
    }
  }
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2">
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={copy}
        className="shrink-0 h-8"
        aria-label={`Copy ${label}`}
      >
        <Copy className="h-4 w-4" /> Copy
      </Button>
    </div>
  );
}

function PaymentSection({
  swimmers,
  sectionNumber,
  registrations,
  payments,
}: {
  swimmers: Swimmer[];
  sectionNumber: number;
  registrations: Registration[];
  payments: Payment[];
}) {
  const swimmerIds = swimmers.map((s) => s.id);
  const childCount = swimmers.length;
  const addMut = useAddPayment();

  const registeredSet = useMemo(
    () => new Set(registrations.map((r) => r.swimmerId)),
    [registrations],
  );
  const allRegistered = swimmerIds.every((id) => registeredSet.has(id));
  const notRegistered = swimmers.filter((s) => !registeredSet.has(s.id));

  const groupTotal = EVENT.totalKes * childCount;
  const groupPaid = useMemo(
    () => swimmerIds.reduce((sum, id) => sum + paidForSwimmer(payments, id), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [swimmerIds.join(","), payments],
  );
  const groupBalance = Math.max(0, groupTotal - groupPaid);
  const pct = Math.min(100, Math.round((groupPaid / groupTotal) * 100));

  const history = useMemo(() => {
    const seen = new Set<string>();
    const out: Payment[] = [];
    swimmerIds.forEach((id) => {
      paymentsForSwimmer(payments, id).forEach((p) => {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          out.push(p);
        }
      });
    });
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swimmerIds.join(","), payments]);

  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [type, setType] = useState<"Deposit" | "Partial" | "Final">(
    childCount > 1 ? "Final" : "Deposit",
  );
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(history.length > 0);
  const latestPayment = history[0];

  if (!allRegistered) {
    const missingNames = notRegistered.map((s) => s.name).join(", ");
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {sectionNumber}. Payment
            {childCount > 1 ? ` — ${childCount} children` : ` — ${swimmers[0].name}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <p className="text-sm text-muted-foreground">
            Complete registration first
            {notRegistered.length > 0 ? ` for ${missingNames}` : ""}.
          </p>
        </CardContent>
      </Card>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseInt(amount, 10);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (n > groupBalance) {
      setError(`Amount exceeds remaining balance (${formatKes(groupBalance)}).`);
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
      swimmerId: swimmerIds[0],
      swimmerIds,
      childCount,
      amount: n,
      reference: reference.trim(),
      type,
      createdAt: new Date().toISOString(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid payment.");
      return;
    }
    try {
      await addMut.mutateAsync({
        swimmerId: swimmerIds[0],
        swimmerIds,
        childCount,
        amount: n,
        reference: reference.trim(),
        type,
      });
      setAmount("");
      setReference("");
      setType(childCount > 1 ? "Final" : "Deposit");
      setAgreed(false);
      setError(null);
      setCollapsed(true);
      toast.success("Payment recorded ✓ — keep your M-Pesa message as proof.", { duration: 4000 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to record payment.";
      setError(msg);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="text-base">
              {sectionNumber}. Payment
              {childCount > 1 ? ` — ${childCount} children` : ` — ${swimmers[0].name}`}
            </CardTitle>
            {!collapsed && (
              <CardDescription>
                {childCount > 1
                  ? "One M-Pesa transaction covers all selected children."
                  : "Log each M-Pesa payment as you make it."}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {latestPayment && (
              <SavedCrumb
                label={
                  groupBalance === 0
                    ? `Fully paid · ${formatKes(groupTotal)}`
                    : `Payment recorded · ${formatKes(latestPayment.amount)}`
                }
              />
            )}
            {latestPayment && collapsed && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setCollapsed(false)}
              >
                {groupBalance > 0 ? "Record another" : "View details"}
              </Button>
            )}
          </div>
        </div>
        {collapsed && latestPayment && (
          <div className="mt-2 text-xs text-muted-foreground">
            {new Date(latestPayment.createdAt).toLocaleString()} · Ref{" "}
            <span className="font-mono font-medium text-foreground">
              {latestPayment.reference}
            </span>
            {groupBalance > 0 && <span> · Balance {formatKes(groupBalance)}</span>}
          </div>
        )}
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-6">
          {childCount > 1 && (
            <div className="rounded-lg border bg-slate-50 p-3 text-sm">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Paying for
              </div>
              <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
                {swimmers.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span>{s.name}</span>
                    <StatusBadge status={statusForSwimmer(payments, s.id)} />
                  </li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t text-sm flex items-center justify-between">
                <span className="text-muted-foreground">
                  {childCount} × {formatKes(EVENT.totalKes)}
                </span>
                <span className="font-semibold">Running total: {formatKes(groupTotal)}</span>
              </div>
            </div>
          )}

          <div className="rounded-lg border bg-sky-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-lg font-semibold">{formatKes(groupTotal)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Paid</div>
                <div className="text-lg font-semibold text-emerald-700">
                  {formatKes(groupPaid)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Balance</div>
                <div className="text-lg font-semibold">{formatKes(groupBalance)}</div>
              </div>
              {childCount === 1 && (
                <StatusBadge status={statusForSwimmer(payments, swimmerIds[0])} />
              )}
            </div>
            <Progress value={pct} className="h-2" />
          </div>

          {groupBalance > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Pay via M-Pesa</h4>
              <p className="text-xs text-muted-foreground">
                Send the amount below via M-Pesa Paybill, then enter the confirmation reference.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <CopyRow label="Paybill" value={PAYMENT.paybill} />
                <CopyRow label="Account" value={PAYMENT.accountCode} />
                <CopyRow label="Amount" value={String(groupBalance)} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Merchant: {PAYMENT.merchantName}
              </p>
            </div>
          )}

          {groupBalance > 0 ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="amount">Amount paid (KES)</Label>
                  <Input
                    id="amount"
                    className="h-11"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={groupBalance}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={String(groupBalance)}
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

              <Button
                type="submit"
                size="lg"
                className="w-full h-11"
                disabled={addMut.isPending}
              >
                {addMut.isPending ? "Recording…" : "Submit payment"}
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
                {history.map((p) => {
                  const n = p.childCount && p.childCount > 0 ? p.childCount : 1;
                  return (
                    <li
                      key={p.id}
                      className="p-3 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">{formatKes(p.amount)}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {new Date(p.createdAt).toLocaleString()} · Ref {p.reference}
                          {n > 1 ? ` · covers ${n} children` : ""}
                        </div>
                      </div>
                      <Badge variant="secondary">{p.type}</Badge>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      )}
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
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${map[status]}`}>
      {status}
    </span>
  );
}
