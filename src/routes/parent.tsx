import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { TermsPanel } from "@/components/TermsPanel";
import { FindSwimmer } from "@/components/FindSwimmer";
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

import { normalizeKePhone } from "@/lib/phone";
import {
  useSwimmers,
  useMyRegistrations,
  useMyPayments,
  useMyParent,
  useMySwimmerParents,
  useSaveMyRegistration,
  useSaveMyParent,
  useLinkMyParent,
  useAddMyPayment,
  paidForSwimmer,
  paymentsForSwimmer,
  statusForSwimmer,
  useMe,
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
  const me = useMe();
  const session = me.data?.signedIn ? me.data : null;
  const sessionLoading = me.isLoading;
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [linkedParents, setLinkedParents] = useState<Parent[]>([]);
  const [linkedSwimmerIds, setLinkedSwimmerIds] = useState<Set<string>>(() => new Set());
  const [restored, setRestored] = useState(false);
  const linkParentMut = useLinkMyParent();
  const swimmersQ = useSwimmers();
  const registrationsQ = useMyRegistrations();
  const paymentsQ = useMyPayments();
  const myParentQ = useMyParent();
  const mySwimmerParentsQ = useMySwimmerParents();

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) navigate({ to: "/" });
  }, [sessionLoading, session, navigate]);

  // Keep linkedParents in sync with the DB record so the RegistrationSection
  // gate (parentsLinked = parents.length > 0) reflects DB truth, not just
  // this session's local state. Without this, a returning parent whose row
  // already exists sees "Details saved ✓" but "Save details" stays disabled.
  useEffect(() => {
    const me = myParentQ.data;
    if (!me) return;
    setLinkedParents((prev) => (prev.some((p) => p.id === me.id) ? prev : [me]));
  }, [myParentQ.data]);

  // Rehydrate the group + linked-swimmer state once all "me" queries settle.
  // Runs at most once per session — user edits after this shouldn't be
  // overwritten if a background refetch happens.
  useEffect(() => {
    if (restored) return;
    if (myParentQ.isLoading || mySwimmerParentsQ.isLoading || swimmersQ.isLoading) {
      return;
    }
    const me = myParentQ.data;
    const links = mySwimmerParentsQ.data ?? [];
    if (me && links.length > 0) {
      const knownSwimmers = new Set((swimmersQ.data ?? []).map((s) => s.id));
      const mySwimmerIds = links
        .filter((l) => l.parentId === me.id && knownSwimmers.has(l.swimmerId))
        .map((l) => l.swimmerId);
      if (mySwimmerIds.length > 0) {
        setGroupIds(mySwimmerIds);
        setLinkedSwimmerIds(new Set(mySwimmerIds));
      }
    }
    setRestored(true);
  }, [
    restored,
    myParentQ.isLoading,
    myParentQ.data,
    mySwimmerParentsQ.isLoading,
    mySwimmerParentsQ.data,
    swimmersQ.isLoading,
    swimmersQ.data,
  ]);

  const swimmers = swimmersQ.data ?? [];
  const registrations = registrationsQ.data ?? [];
  const payments = paymentsQ.data ?? [];

  const registeredIds = useMemo(
    () => new Set(registrations.map((r) => r.swimmerId)),
    [registrations],
  );

  const groupSwimmers = useMemo(
    () => groupIds.map((id) => swimmers.find((s) => s.id === id)).filter((s): s is Swimmer => !!s),
    [groupIds, swimmers],
  );
  // Only this parent's own children.
  //
  // It used to offer the whole Machakos squad, so the quickest way onto
  // somebody else's child was a mis-tap in a long alphabetical list — and
  // because everything here is about entering and paying, the mistake landed
  // next to a payment. Finding a child who is not yet on the account is what
  // the search below is for, and that now refuses anyone another parent has
  // already registered.
  const myLinkedIds = useMemo(() => {
    const me = myParentQ.data;
    const links = mySwimmerParentsQ.data ?? [];
    return new Set(
      me ? links.filter((l) => l.parentId === me.id).map((l) => l.swimmerId) : [],
    );
  }, [myParentQ.data, mySwimmerParentsQ.data]);

  const available = useMemo(
    () =>
      swimmers
        .filter((s) => !groupIds.includes(s.id))
        .filter((s) => myLinkedIds.has(s.id) || linkedSwimmerIds.has(s.id))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [swimmers, groupIds, myLinkedIds, linkedSwimmerIds],
  );

  // Chosen from the picker and waiting on the parent to say yes. Nothing is
  // linked while this is set.
  const [pendingChild, setPendingChild] = useState<{ id: string; name: string } | null>(null);

  async function linkSwimmer(swimmerId: string, swimmerName: string, parents: Parent[]) {
    try {
      for (let i = 0; i < parents.length; i++) {
        // parentId and sortOrder now come from the signed session server-side;
        // a parent can only ever link a swimmer to themselves.
        await linkParentMut.mutateAsync({ swimmerId });
      }
      setLinkedSwimmerIds((s) => {
        const next = new Set(s);
        next.add(swimmerId);
        return next;
      });
      toast.success(`${swimmerName} added to your account.`);
    } catch (err) {
      const info = extractErr(err);
      console.warn("[parent] link failed:", info);
      const userMessage = info.isRlsDenied
        ? "Couldn't link this swimmer — your account isn't authorised for it. Sign out and back in, or contact the coordinator."
        : info.message || "Could not add that swimmer.";
      toast.error(userMessage);
      // Roll back the optimistic pick from addChild so the UI doesn't
      // show a "selected" chip next to a refusal toast. Also clear from
      // linkedSwimmerIds defensively (in case a partial success snuck in).
      setGroupIds((g) => g.filter((x) => x !== swimmerId));
      setLinkedSwimmerIds((s) => {
        if (!s.has(swimmerId)) return s;
        const next = new Set(s);
        next.delete(swimmerId);
        return next;
      });
    }
  }

  // Picking a name from the list used to link the child to the account on the
  // spot and say so in a toast — "auto-linked" — after the fact. The list is
  // the whole Machakos squad, so one mis-tap put a parent on somebody else's
  // child, with their entry and their balance, and the toast read as though
  // the system had meant it. Nothing is linked now until it is confirmed.
  function addChild(id: string) {
    if (!id || groupIds.includes(id)) return;
    // Already ours: this only puts them in the group being registered, which
    // is reversible and grants nothing new, so there is nothing to confirm.
    if (linkedParents.length === 0 || linkedSwimmerIds.has(id)) {
      setGroupIds((g) => [...g, id]);
      return;
    }
    const picked = swimmers.find((x) => x.id === id);
    setPendingChild({ id, name: picked?.name ?? "that swimmer" });
  }

  function confirmPendingChild() {
    const p = pendingChild;
    if (!p) return;
    setPendingChild(null);
    setGroupIds((g) => (g.includes(p.id) ? g : [...g, p.id]));
    void linkSwimmer(p.id, p.name, linkedParents);
  }
  function removeChild(id: string) {
    // Don't clear linkedParents when the picker empties — the DB record
    // for the signed-in parent doesn't cease to exist just because they
    // deselected the last swimmer. The sync effect above will restore it
    // from useMyParent regardless, but avoiding the clobber keeps the
    // gate correct without a re-render round-trip.
    setGroupIds((g) => g.filter((x) => x !== id));
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
    sessionLoading ||
    swimmersQ.isLoading ||
    registrationsQ.isLoading ||
    paymentsQ.isLoading ||
    myParentQ.isLoading ||
    mySwimmerParentsQ.isLoading;
  const errored = swimmersQ.isError || registrationsQ.isError || paymentsQ.isError;

  if (!sessionLoading && !session) return null;

  return (
    <div className="min-h-screen bg-secondary">
      <AppHeader />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Register & pay</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {EVENT.name} · {EVENT.startDate} – {EVENT.endDate} · Total {formatKes(EVENT.totalKes)}{" "}
            per swimmer
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
                        className="inline-flex items-center gap-1 rounded-full bg-accent text-accent-foreground text-xs font-medium pl-3 pr-1 py-1"
                      >
                        {s.name}
                        {registeredIds.has(s.id) ? " ✓" : ""}
                        <button
                          type="button"
                          onClick={() => removeChild(s.id)}
                          className="rounded-full hover:bg-accent p-0.5"
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
                          groupSwimmers.length === 0 ? "Choose swimmer…" : "+ Add another child…"
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
                ) : null}

                {pendingChild && (
                  <div className="rounded-lg border border-border bg-secondary px-3.5 py-3">
                    <p className="text-[13px] leading-relaxed">
                      Add <b>{pendingChild.name}</b> to your account? Please confirm you are
                      their parent or guardian. They will be entered and paid for under your
                      name.
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button size="sm" onClick={confirmPendingChild}>
                        Yes, {pendingChild.name} is my child
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setPendingChild(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Whether or not they already hold a swimmer, a parent needs a
                    way onto a child's record — the second adult in a household
                    starts here with nothing linked at all. */}
                <div className="border-t border-border pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {swimmers.length === 0 ? "Find your swimmer" : "Add another child"}
                  </p>
                  {/* Confirmed explicitly here: a parent is adding a child
                      mid-task, beside a payment, and the link is live the
                      moment it is made. */}
                  <FindSwimmer confirmBeforeAdd />
                </div>
              </CardContent>
            </Card>

            {groupSwimmers.length > 0 && (
              <ParentSection swimmers={groupSwimmers} onLinked={handleParentsLinked} />
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
  const saveMut = useSaveMyRegistration();

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
  const errRing = (k: string) => (errors[k] ? "border-destructive ring-1 ring-destructive/40" : "");
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
  // Parent-side is single-parent: the signed-in Google user owns exactly one
  // parents row (partial unique index on parents.user_id enforces this).
  // Secondary contact info still fits on the registration row itself
  // (parent2_name + secondary_phone) — the admin flow handles second-parent
  // records separately if needed.
  const myParentQ = useMyParent();
  const saveParent = useSaveMyParent();
  const linkParent = useLinkMyParent();

  const existing = myParentQ.data ?? null;
  const [parent1, setParent1] = useState<ParentFormRow>(() =>
    existing ? fromParent(existing) : emptyParentRow(),
  );
  const [initialized, setInitialized] = useState<boolean>(!!existing);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<boolean>(!!existing);
  const [collapsed, setCollapsed] = useState<boolean>(!!existing);
  const busy = saveParent.isPending || linkParent.isPending;

  // Populate the form once useMyParent finishes loading with a real row.
  useEffect(() => {
    if (initialized || !existing) return;
    setParent1(fromParent(existing));
    setSaved(true);
    setCollapsed(true);
    setInitialized(true);
  }, [existing, initialized]);

  function updateParent1<K extends keyof ParentFormRow>(k: K, v: ParentFormRow[K]) {
    setParent1((prev) => ({ ...prev, [k]: v }));
  }

  function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!parent1.fullName.trim()) errs.p1FullName = "Full name required";
    if (!parent1.gender) errs.p1Gender = "Gender required";
    if (!parent1.stayingOvernight) errs.p1Sleepover = "Answer required";
    if (!normalizeKePhone(parent1.phone)) errs.p1Phone = "Enter a valid Kenyan number";
    return errs;
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
      const normalized = normalizeKePhone(parent1.phone)!;
      const p1Row = await saveParent.mutateAsync({
        id: existing?.id,
        fullName: parent1.fullName.trim(),
        gender: parent1.gender === "" ? null : parent1.gender,
        phone: normalized,
        stayingOvernight: (parent1.stayingOvernight || "Yet to decide") as
          | "Yes"
          | "No"
          | "Yet to decide",
      });
      const linkedSwimmerIds: string[] = [];
      for (const s of swimmers) {
        try {
          await linkParent.mutateAsync({ swimmerId: s.id });
          linkedSwimmerIds.push(s.id);
        } catch (linkErr) {
          const info = extractErr(linkErr);
          console.warn(`[parent] link failed for ${s.name}:`, info);
          if (info.isRlsDenied) {
            toast.error(
              `${s.name}: your account isn't authorised to link this swimmer. Sign out and back in, or contact the coordinator.`,
            );
          } else {
            toast.error(`${s.name}: ${info.message || "link failed"}`);
          }
        }
      }
      onLinked([p1Row], linkedSwimmerIds);
      setSaved(true);
      setCollapsed(true);
      if (linkedSwimmerIds.length > 0) {
        toast.success("Parent saved and linked.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save.";
      toast.error(msg);
    }
  }

  const errText = (k: string) =>
    errors[k] ? <p className="text-xs text-destructive mt-1">{errors[k]}</p> : null;
  const errRing = (k: string) => (errors[k] ? "border-destructive ring-1 ring-destructive/40" : "");

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
                  ? "You'll be linked to all selected swimmers."
                  : "Confirm your details as the parent/guardian."}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {saved && <SavedCrumb label="Details saved" />}
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
              title=""
              row={parent1}
              onChange={updateParent1}
              errText={errText}
              errRing={errRing}
              keyPrefix="p1"
              genderRequired
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button type="submit" size="lg" className="w-full sm:w-auto h-11" disabled={busy}>
                {busy ? "Saving…" : existing ? "Update parent details" : "Save parent details"}
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  );
}

function fromParent(p: Parent): ParentFormRow {
  return {
    phone: p.phone,
    fullName: p.fullName,
    gender: p.gender ?? "",
    stayingOvernight: p.stayingOvernight,
  };
}

// Supabase PostgrestError isn't a JS Error subclass, so `err instanceof Error`
// misses it and callers fall back to a generic label. Extract code + message
// off whatever shape actually came out. Returns { code, message, isRlsDenied }
// so callers can choose between "you don't have permission" and the raw
// message from Postgres.
type ExtractedErr = { code: string | null; message: string; isRlsDenied: boolean };

function extractErr(err: unknown): ExtractedErr {
  // apiFetch already turns a failed response into an Error carrying the
  // server's own sentence, so there is nothing left to unwrap. The old
  // Postgres/RLS code inspection went with Supabase.
  const message =
    err instanceof Error && err.message
      ? err.message
      : typeof err === "string"
        ? err
        : "Something went wrong. Please try again.";
  return { code: null, message, isRlsDenied: false };
}

function ParentRowFields({
  title,
  row,
  onChange,
  errText,
  errRing,
  keyPrefix,
  genderRequired,
}: {
  title: string;
  row: ParentFormRow;
  onChange: <K extends keyof ParentFormRow>(k: K, v: ParentFormRow[K]) => void;
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
            placeholder="+254 7XX XXX XXX"
          />
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
            onValueChange={(v) => onChange("stayingOvernight", v as "Yes" | "No" | "Yet to decide")}
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
          {row.stayingOvernight === "Yes" && (
            <p className="mt-1.5 rounded-md border border-border bg-accent px-2.5 py-1.5 text-[11px] leading-snug text-accent-foreground">
              Parent accommodation is available at an additional cost. We're finalising the
              price now — once it's set, you'll be able to pay for it right here in this
              same app, and we'll let you know when it's ready.
            </p>
          )}
          {errText(`${keyPrefix}Sleepover`)}
        </div>
      </div>
    </section>
  );
}

function SavedCrumb({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-xs font-medium text-emerald-700">
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
  const addMut = useAddMyPayment();

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
            <span className="font-mono font-medium text-foreground">{latestPayment.reference}</span>
            {groupBalance > 0 && <span> · Balance {formatKes(groupBalance)}</span>}
          </div>
        )}
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-6">
          {childCount > 1 && (
            <div className="rounded-lg border bg-secondary p-3 text-sm">
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

          <div className="rounded-lg border bg-accent/60 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-lg font-semibold">{formatKes(groupTotal)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Paid</div>
                <div className="text-lg font-semibold text-emerald-700">{formatKes(groupPaid)}</div>
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
              <p className="text-[11px] text-muted-foreground">Merchant: {PAYMENT.merchantName}</p>
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

              <Button type="submit" size="lg" className="w-full h-11" disabled={addMut.isPending}>
                {addMut.isPending ? "Recording…" : "Submit payment"}
              </Button>
            </form>
          ) : (
            <div className="rounded-md border bg-emerald-50/70 border-emerald-200 p-4 text-sm text-emerald-700">
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
                    <li key={p.id} className="p-3 flex items-center justify-between gap-3 text-sm">
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
    Unpaid: "bg-secondary text-foreground",
    Partial: "bg-amber-100/70 text-amber-700",
    Paid: "bg-emerald-100/70 text-emerald-700",
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${map[status]}`}>{status}</span>
  );
}
