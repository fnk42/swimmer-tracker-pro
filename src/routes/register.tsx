import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  useMe,
  useMyParent,
  useMySwimmers,
  useMyRegistrations,
  useMyPayments,
  useSaveMyParent,
  useSaveMyRegistration,
  useAddMyPayment,
  paidForSwimmer,
} from "@/lib/api";
import type { Registration } from "@/lib/schemas";
import { EVENT, PAYMENT, TERMS_TEXT, formatKes } from "@/lib/event-config";
import { canonicalPhone } from "@/lib/phone";
import { GOLDEN_PIPIT_URL, GOLDEN_PIPIT_EMAIL } from "@/lib/links";

export const Route = createFileRoute("/register")({ component: MachakosFlow });

// Machakos, one screen at a time.
//
// The page this replaces is 1,459 lines carrying four numbered sections at
// once: pick your swimmers, parent details, the entry form, then payment. A
// parent on a phone met all of it in one scroll and had to work out where they
// were. This asks one question per screen, the way /welcome does, and wears
// the analytics look rather than the admin one.
//
// It is a PARALLEL route. /parent is untouched and still live, because
// families are registering and paying through it this week and a half-built
// wizard is worse than a working page that is ugly.
const STEPS = ["who", "details", "entry", "pay"] as const;
type Step = (typeof STEPS)[number];

const TITLE: Record<Step, string> = {
  who: "Which swimmers are you entering?",
  details: "Who should we contact?",
  entry: "About each swimmer",
  pay: "Pay for the entry",
};

type EntryForm = {
  age: string;
  gender: "Male" | "Female" | "";
  ownsCellphone: "Yes" | "No" | "";
  dietary: string;
  allergies: string;
  healthConditions: string;
  specialRequests: string;
};

function emptyEntry(): EntryForm {
  return {
    age: "",
    gender: "",
    ownsCellphone: "",
    dietary: "",
    allergies: "",
    healthConditions: "",
    specialRequests: "",
  };
}

function MachakosFlow() {
  const navigate = useNavigate();
  const me = useMe();
  const myParent = useMyParent();
  const mine = useMySwimmers();
  const regs = useMyRegistrations();
  const pays = useMyPayments();

  const saveParent = useSaveMyParent();
  const saveReg = useSaveMyRegistration();
  const addPayment = useAddMyPayment();

  const [step, setStep] = useState<Step>("who");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Step 2 — the one contact on the account.
  const [pName, setPName] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pGender, setPGender] = useState<"Male" | "Female" | "">("");
  const [pSleepover, setPSleepover] = useState<"Yes" | "No" | "Yet to decide" | "">("");
  const [parentLoaded, setParentLoaded] = useState(false);

  // Step 3 — one swimmer at a time, not a stack of forms.
  const [entryIdx, setEntryIdx] = useState(0);
  const [entries, setEntries] = useState<Record<string, EntryForm>>({});

  // Step 4.
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [payType, setPayType] = useState<"Deposit" | "Partial" | "Final">("Deposit");
  const [agreed, setAgreed] = useState(false);
  const [receipt, setReceipt] = useState<{ amount: number; reference: string } | null>(null);

  // A page that throws you somewhere else without saying why is a page nobody
  // can report a fault on — you cannot tell a bug from a rule. So the only
  // silent redirect left is the signed-out one, where there is nothing to
  // read anyway. Everything else stops here and says what it is waiting for.
  useEffect(() => {
    if (me.isLoading) return;
    if (!me.data?.signedIn) navigate({ to: "/" });
  }, [me.isLoading, me.data, navigate]);

  const held: { reason: string; body: string; to: string; cta: string } | null =
    me.isLoading || !me.data?.signedIn || me.data.isAdmin
      ? null
      : me.data.needsRegistration
        ? {
            reason: "needsRegistration",
            body: "Your account is not finished yet. The entry form needs your name and number first — it takes a minute.",
            to: "/welcome",
            cta: "Finish registering",
          }
        : me.data.sections && me.data.sections.events === false
          ? {
              reason: "sections.events === false",
              body: "Machakos entries are open to swimmers in the travelling team. If your child should be on it, tell Boit and he will add them.",
              to: "/tracker",
              cta: "Go to Analytics",
            }
          : null;

  // Named in the console so the next person who reports "it bounced me" can be
  // answered from the page rather than guessed at.
  const heldReason = held?.reason;
  useEffect(() => {
    if (heldReason) console.info(`[register] held: ${heldReason}`);
  }, [heldReason]);

  const swimmers = useMemo(() => mine.data ?? [], [mine.data]);
  const registered = useMemo(
    () => new Map((regs.data ?? []).map((r) => [r.swimmerId, r])),
    [regs.data],
  );

  // One child on the account is not a question worth asking.
  useEffect(() => {
    if (swimmers.length === 1 && picked.length === 0) setPicked([swimmers[0].id]);
  }, [swimmers, picked.length]);

  // Fill the contact from the record once, so a parent coming back a second
  // time is confirming rather than retyping.
  useEffect(() => {
    if (parentLoaded || !myParent.data) return;
    setPName(myParent.data.fullName ?? "");
    setPPhone(myParent.data.phone ?? "");
    setPGender(myParent.data.gender ?? "");
    setPSleepover(myParent.data.stayingOvernight ?? "");
    setParentLoaded(true);
  }, [myParent.data, parentLoaded]);

  const pickedSwimmers = useMemo(
    () => swimmers.filter((s) => picked.includes(s.id)),
    [swimmers, picked],
  );
  const current = pickedSwimmers[entryIdx];

  // Reading an entry form falls back to the saved registration, then to what
  // the roster already knows, then to blank.
  function entryFor(swimmerId: string): EntryForm {
    const held = entries[swimmerId];
    if (held) return held;
    const saved = registered.get(swimmerId);
    const s = swimmers.find((x) => x.id === swimmerId);
    return {
      age: saved?.age != null ? String(saved.age) : s?.age != null ? String(s.age) : "",
      gender: saved?.gender ?? s?.gender ?? "",
      ownsCellphone: saved?.ownsCellphone ?? "",
      dietary: saved?.dietary ?? "",
      allergies: saved?.allergies ?? "",
      healthConditions: saved?.healthConditions ?? "",
      specialRequests: saved?.specialRequests ?? "",
    };
  }

  function setEntry<K extends keyof EntryForm>(swimmerId: string, k: K, v: EntryForm[K]) {
    setEntries((all) => ({ ...all, [swimmerId]: { ...entryFor(swimmerId), [k]: v } }));
  }

  const groupTotal = EVENT.totalKes * Math.max(picked.length, 1);
  const groupPaid = useMemo(
    () => picked.reduce((sum, id) => sum + paidForSwimmer(pays.data ?? [], id), 0),
    [picked, pays.data],
  );
  const balance = Math.max(0, groupTotal - groupPaid);
  const idx = STEPS.indexOf(step);
  const busy = saveParent.isPending || saveReg.isPending || addPayment.isPending;

  // Each step answers for itself whether Continue means anything yet.
  const form = current ? entryFor(current.id) : emptyEntry();
  const canAdvance =
    step === "who"
      ? picked.length > 0
      : step === "details"
        ? pName.trim().length > 1 && !!canonicalPhone(pPhone) && !!pGender && !!pSleepover
        : step === "entry"
          ? !!form.age && !!form.gender && !!form.ownsCellphone
          : balance > 0 && !!amount && !!reference.trim() && agreed;

  async function onContinue() {
    setError(null);
    try {
      if (step === "who") {
        setEntryIdx(0);
        setStep("details");
        return;
      }

      if (step === "details") {
        // Saving here rather than at the end means a parent who drops out on
        // the entry form is still reachable by phone, which is how most of
        // this actually gets resolved.
        await saveParent.mutateAsync({
          id: myParent.data?.id,
          fullName: pName.trim(),
          gender: pGender === "" ? null : pGender,
          phone: canonicalPhone(pPhone)!,
          stayingOvernight: (pSleepover || "Yet to decide") as "Yes" | "No" | "Yet to decide",
        });
        setStep("entry");
        return;
      }

      if (step === "entry" && current) {
        const saved = registered.get(current.id);
        const payload: Registration = {
          swimmerId: current.id,
          age: parseInt(form.age, 10),
          gender: form.gender as "Male" | "Female",
          guardianGender: (pGender || "Female") as "Male" | "Female",
          parentSleepover: (pSleepover || "Yet to decide") as "Yes" | "No" | "Yet to decide",
          ownsCellphone: form.ownsCellphone as "Yes" | "No",
          parent1Name: pName.trim(),
          // The second parent is their own account now, not a field on this
          // form. Anything already on the record is carried, not cleared.
          parent2Name: saved?.parent2Name ?? "",
          primaryPhone: canonicalPhone(pPhone)!,
          secondaryPhone: saved?.secondaryPhone ?? "",
          dietary: form.dietary,
          allergies: form.allergies,
          healthConditions: form.healthConditions,
          specialRequests: form.specialRequests,
          updatedAt: new Date().toISOString(),
        };
        await saveReg.mutateAsync(payload);
        if (entryIdx < pickedSwimmers.length - 1) {
          setEntryIdx(entryIdx + 1);
        } else {
          setAmount(String(balance));
          setPayType(picked.length > 1 ? "Final" : "Deposit");
          setStep("pay");
        }
        return;
      }

      if (step === "pay") {
        const n = parseInt(amount, 10);
        if (!Number.isFinite(n) || n <= 0) {
          setError("Enter the amount you sent.");
          return;
        }
        if (n > balance) {
          setError(`That is more than the balance of ${formatKes(balance)}.`);
          return;
        }
        const rec = await addPayment.mutateAsync({
          swimmerId: picked[0],
          swimmerIds: picked,
          childCount: picked.length,
          amount: n,
          reference: reference.trim(),
          type: payType,
        });
        // Postgres hands numeric back as a string, so this arrives as
        // "7000.00" and printed as KES 7000.00 until it is made a number.
        setReceipt({ amount: Number(rec.amount), reference: rec.reference });
        setAgreed(false);
        setAmount("");
        setReference("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save. Please try again.");
    }
  }

  function onBack() {
    setError(null);
    if (step === "entry" && entryIdx > 0) {
      setEntryIdx(entryIdx - 1);
      return;
    }
    if (step === "pay") {
      setEntryIdx(Math.max(0, pickedSwimmers.length - 1));
      setStep("entry");
      return;
    }
    setStep(STEPS[Math.max(0, idx - 1)]);
  }

  return (
    <Shell>
      {held ? (
        <div className="ng-panel mt-4 p-6 sm:p-7">
          <h2 className="text-[21px] font-semibold">Not yet</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-white/70">{held.body}</p>
          <a href={held.to} className="ng-btn ng-btn-primary mt-6">
            {held.cta}
          </a>
        </div>
      ) : (
        <>
          {/* Where they are, shown the way /welcome shows it. */}
          <div className="mt-7 flex items-center gap-2" aria-hidden>
            {STEPS.map((s, i) => (
              <span
                key={s}
                className="h-1 flex-1 rounded-full transition-colors"
                style={{ background: i <= idx ? "var(--ng-electric)" : "rgba(255,255,255,.18)" }}
              />
            ))}
          </div>
          <p className="ng-eyebrow mt-4">
            <span className="dot" aria-hidden />
            Step {idx + 1} of {STEPS.length}
          </p>

          <div className="ng-panel mt-4 p-6 sm:p-7">
            <h2 className="text-[21px] font-semibold">{TITLE[step]}</h2>

            {step === "who" && (
              <>
                <p className="mb-5 mt-1.5 text-[14px] leading-relaxed text-white/65">
                  Entering more than one child lets you pay for all of them with a single M-Pesa
                  transaction.
                </p>
                {mine.isLoading ? (
                  <p className="rounded-xl bg-white/[.06] p-4 text-[13.5px] text-white/60">
                    Fetching your swimmers…
                  </p>
                ) : swimmers.length === 0 ? (
                  // Where "add a swimmer" actually lives depends on who is
                  // asking. A coordinator sign-in has no family of its own, and
                  // /welcome turns coordinators away at the door — sending them
                  // there is a dead end, which is how this was found.
                  <p className="rounded-xl bg-white/[.06] p-4 text-[13.5px] leading-relaxed text-white/70">
                    {me.data?.isAdmin ? (
                      <>
                        This is a coordinator sign-in, so there are no swimmers on it. Entries for
                        the whole squad are in the{" "}
                        <a
                          href="/admin"
                          className="font-semibold text-[var(--ng-cyan)] underline-offset-4 hover:underline"
                        >
                          admin view
                        </a>
                        .
                      </>
                    ) : (
                      <>
                        No swimmers on your account yet. Add them on the{" "}
                        <a
                          href="/welcome"
                          className="font-semibold text-[var(--ng-cyan)] underline-offset-4 hover:underline"
                        >
                          registration page
                        </a>{" "}
                        first.
                      </>
                    )}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {swimmers.map((s) => {
                      const on = picked.includes(s.id);
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() =>
                              setPicked((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))
                            }
                            className={
                              "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors " +
                              (on
                                ? "border-[var(--ng-electric)] bg-[var(--ng-electric)]/15"
                                : "border-white/15 bg-white/[.04] hover:bg-white/[.07]")
                            }
                          >
                            <span
                              className={
                                "flex h-5 w-5 flex-none items-center justify-center rounded-md border " +
                                (on
                                  ? "border-[var(--ng-electric)] bg-[var(--ng-electric)]"
                                  : "border-white/35")
                              }
                            >
                              {on && <span className="text-[12px] font-bold text-white">✓</span>}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[15px] font-semibold">{s.name}</span>
                              <span className="block text-[12.5px] text-white/55">
                                {registered.has(s.id)
                                  ? "Entry form already saved"
                                  : "Not entered yet"}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {picked.length > 0 && (
                  <p className="mt-4 text-[13.5px] font-medium text-[var(--ng-cyan)]">
                    {picked.length} swimmer{picked.length === 1 ? "" : "s"} ·{" "}
                    {formatKes(groupTotal)} total
                  </p>
                )}
              </>
            )}

            {step === "details" && (
              <>
                <p className="mb-5 mt-1.5 text-[14px] leading-relaxed text-white/65">
                  The number the coaches will use in Machakos if they need you during the trip.
                </p>

                <label className="ng-label" htmlFor="r-name">
                  Your full name
                </label>
                <input
                  id="r-name"
                  className="ng-field"
                  value={pName}
                  autoComplete="name"
                  onChange={(e) => setPName(e.target.value)}
                />

                <label className="ng-label mt-4" htmlFor="r-phone">
                  Phone number
                </label>
                <input
                  id="r-phone"
                  className="ng-field"
                  value={pPhone}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="07xx xxx xxx"
                  onChange={(e) => setPPhone(e.target.value)}
                />

                <span className="ng-label mt-5 block">You are the swimmer's</span>
                <div className="mt-1.5 flex gap-2">
                  {(["Female", "Male"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setPGender(g)}
                      aria-pressed={pGender === g}
                      className={
                        "min-h-[44px] flex-1 rounded-xl px-4 text-[14.5px] font-medium transition-colors " +
                        (pGender === g
                          ? "bg-[var(--ng-electric)] text-white"
                          : "border border-white/25 bg-white/5 text-white/80 hover:bg-white/10")
                      }
                    >
                      {g === "Female" ? "Mother / female guardian" : "Father / male guardian"}
                    </button>
                  ))}
                </div>

                {/* Sleeping arrangements are worked out per room, so "yet to
                  decide" is a real answer and not a way of dodging one. */}
                <span className="ng-label mt-5 block">Are you staying overnight in Machakos?</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(["Yes", "No", "Yet to decide"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPSleepover(v)}
                      aria-pressed={pSleepover === v}
                      className={
                        "min-h-[44px] flex-1 rounded-xl px-4 text-[14.5px] font-medium transition-colors " +
                        (pSleepover === v
                          ? "bg-[var(--ng-electric)] text-white"
                          : "border border-white/25 bg-white/5 text-white/80 hover:bg-white/10")
                      }
                    >
                      {v}
                    </button>
                  ))}
                </div>

                <p className="mt-5 text-[13px] leading-relaxed text-white/45">
                  A second parent signs in with their own email and adds themselves — we do not
                  collect them as a field here.
                </p>
              </>
            )}

            {step === "entry" && current && (
              <>
                <p className="mt-1.5 text-[14px] leading-relaxed text-white/65">
                  <span className="font-semibold text-white">{current.name}</span>
                  {pickedSwimmers.length > 1 && (
                    <span className="text-white/50">
                      {" "}
                      · swimmer {entryIdx + 1} of {pickedSwimmers.length}
                    </span>
                  )}
                  {registered.has(current.id) && (
                    <span className="mt-1 block text-[13px] text-[var(--ng-cyan)]">
                      Already on file — change anything that has moved on.
                    </span>
                  )}
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="ng-label" htmlFor="r-age">
                      Age at the event
                    </label>
                    <input
                      id="r-age"
                      className="ng-field"
                      type="number"
                      min={4}
                      max={25}
                      inputMode="numeric"
                      value={form.age}
                      onChange={(e) => setEntry(current.id, "age", e.target.value)}
                    />
                  </div>
                  <div>
                    <span className="ng-label">Gender</span>
                    <div className="flex gap-2">
                      {(["Female", "Male"] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => setEntry(current.id, "gender", g)}
                          aria-pressed={form.gender === g}
                          className={
                            "min-h-[46px] flex-1 rounded-xl px-4 text-[14.5px] font-medium transition-colors " +
                            (form.gender === g
                              ? "bg-[var(--ng-electric)] text-white"
                              : "border border-white/25 bg-white/5 text-white/80 hover:bg-white/10")
                          }
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <span className="ng-label mt-5 block">
                  Does {current.name.split(" ")[0]} carry a phone?
                </span>
                <div className="mt-1.5 flex gap-2">
                  {(["Yes", "No"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setEntry(current.id, "ownsCellphone", v)}
                      aria-pressed={form.ownsCellphone === v}
                      className={
                        "min-h-[44px] flex-1 rounded-xl px-4 text-[14.5px] font-medium transition-colors " +
                        (form.ownsCellphone === v
                          ? "bg-[var(--ng-electric)] text-white"
                          : "border border-white/25 bg-white/5 text-white/80 hover:bg-white/10")
                      }
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[12.5px] text-white/45">
                  Phones are collected and stored overnight, then handed back in the morning.
                </p>

                <div className="mt-6 space-y-4">
                  {(
                    [
                      ["dietary", "Dietary needs"],
                      ["allergies", "Allergies"],
                      ["healthConditions", "Health conditions we should know about"],
                      ["specialRequests", "Anything else"],
                    ] as const
                  ).map(([k, label]) => (
                    <div key={k}>
                      <label className="ng-label" htmlFor={`r-${k}`}>
                        {label}{" "}
                        <span className="font-normal normal-case tracking-normal text-white/40">
                          optional
                        </span>
                      </label>
                      <textarea
                        id={`r-${k}`}
                        className="ng-field"
                        rows={2}
                        value={form[k]}
                        onChange={(e) => setEntry(current.id, k, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}

            {step === "pay" &&
              (receipt ? (
                <>
                  <p className="mt-2 rounded-xl border border-[var(--ng-electric)]/40 bg-[var(--ng-electric)]/10 p-4 text-[14px] leading-relaxed">
                    Recorded: <span className="font-semibold">{formatKes(receipt.amount)}</span>,
                    reference <span className="font-mono font-semibold">{receipt.reference}</span>.
                    Keep the M-Pesa message — it is the proof, this is only the record.
                  </p>
                  <p className="mt-4 text-[14px] text-white/70">
                    {balance > 0
                      ? `Balance remaining: ${formatKes(balance)}.`
                      : "Paid in full. Nothing further is owed for this entry."}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {balance > 0 && (
                      <button
                        type="button"
                        className="ng-btn ng-btn-ghost"
                        onClick={() => {
                          setReceipt(null);
                          setAmount(String(balance));
                        }}
                      >
                        Record another payment
                      </button>
                    )}
                    <a href="/tracker" className="ng-btn ng-btn-primary">
                      Back to Analytics
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-white/[.06] p-4">
                    <Figure label="Total" value={formatKes(groupTotal)} />
                    <Figure label="Paid" value={formatKes(groupPaid)} tone="var(--ng-cyan)" />
                    <Figure label="Balance" value={formatKes(balance)} />
                  </div>

                  {balance > 0 ? (
                    <>
                      <p className="mt-5 text-[14px] leading-relaxed text-white/65">
                        Send the balance on M-Pesa, then enter the confirmation code it sends back.
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <Copyable label="Paybill" value={PAYMENT.paybill} />
                        <Copyable label="Account" value={PAYMENT.accountCode} />
                        <Copyable label="Amount" value={String(balance)} />
                      </div>

                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="ng-label" htmlFor="r-amount">
                            Amount sent (KES)
                          </label>
                          <input
                            id="r-amount"
                            className="ng-field"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={balance}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="ng-label" htmlFor="r-ref">
                            M-Pesa reference
                          </label>
                          <input
                            id="r-ref"
                            className="ng-field"
                            value={reference}
                            placeholder="e.g. QGH7X8Y2ZA"
                            onChange={(e) => setReference(e.target.value.toUpperCase())}
                          />
                        </div>
                      </div>

                      <span className="ng-label mt-5 block">This payment is a</span>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {(["Deposit", "Partial", "Final"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setPayType(t)}
                            aria-pressed={payType === t}
                            className={
                              "min-h-[44px] flex-1 rounded-xl px-4 text-[14.5px] font-medium transition-colors " +
                              (payType === t
                                ? "bg-[var(--ng-electric)] text-white"
                                : "border border-white/25 bg-white/5 text-white/80 hover:bg-white/10")
                            }
                          >
                            {t === "Partial" ? "Part payment" : t}
                          </button>
                        ))}
                      </div>

                      <span className="ng-label mt-6 block">Rules and expectations</span>
                      <div className="max-h-56 overflow-y-auto rounded-xl border border-white/15 bg-white/[.04] p-4">
                        <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-white/75">
                          {TERMS_TEXT}
                        </pre>
                      </div>
                      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-white/15 bg-white/[.04] p-4">
                        <input
                          type="checkbox"
                          checked={agreed}
                          onChange={(e) => setAgreed(e.target.checked)}
                          className="mt-0.5 h-5 w-5 flex-none accent-[var(--ng-electric)]"
                        />
                        <span className="text-[14px] leading-snug text-white/80">
                          I have read and agree to the rules above on behalf of{" "}
                          {pickedSwimmers.length === 1 ? pickedSwimmers[0].name : "my swimmers"}.
                        </span>
                      </label>
                    </>
                  ) : (
                    <p className="mt-5 text-[14px] leading-relaxed text-white/70">
                      Paid in full. Nothing further is owed for this entry.
                    </p>
                  )}
                </>
              ))}

            {error && (
              <p className="mt-5 rounded-xl border border-[#FFC24B]/40 bg-[#FFC24B]/10 p-3 text-[13.5px] text-[#FFC24B]">
                {error}
              </p>
            )}

            {!(step === "pay" && receipt) && (
              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  disabled={idx === 0 && entryIdx === 0}
                  onClick={onBack}
                  className="text-[13px] text-white/55 underline-offset-4 hover:text-white hover:underline disabled:opacity-30"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!canAdvance || busy}
                  onClick={onContinue}
                  className="ng-btn ng-btn-primary px-7"
                >
                  {busy ? "Saving…" : step === "pay" ? "Record payment" : "Continue"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}

// The water, the logo and the dates, which every screen of this wears.
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="ng-sora relative flex min-h-screen flex-col">
      <div className="ng-water" aria-hidden />
      <div className="ng-caustics" aria-hidden />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-12 pt-10 text-white">
        <img
          src="/nextgen-logo.png"
          alt="NextGen Multi Sport Academy"
          className="w-auto object-contain"
          width={395}
          height={265}
          style={{ height: "clamp(56px, 6vw, 84px)" }}
        />

        <h1 className="ng-display mt-6 text-[clamp(26px,4.4vw,40px)]">
          {EVENT.name}
          <span className="block" style={{ color: "var(--ng-electric)" }}>
            {EVENT.startDate} – {EVENT.endDate}
          </span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/70">
          {formatKes(EVENT.totalKes)} per swimmer. One screen at a time — nothing is charged until
          the last one.
        </p>

        {children}

        <footer className="mt-9 text-center text-xs text-white/40">
          A product of{" "}
          <a
            href={GOLDEN_PIPIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-white/55 underline-offset-4 hover:text-white hover:underline"
          >
            Golden Pipit Solutions
          </a>
          <span className="mt-2 block text-white/35">{GOLDEN_PIPIT_EMAIL}</span>
        </footer>
      </main>
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-white/45">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
    </div>
  );
}

// Paybill numbers get mistyped on a phone, so let them be tapped rather than
// read across to the M-Pesa keypad.
function Copyable({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard blocked — the number is on screen either way */
        }
      }}
      className="rounded-xl border border-white/15 bg-white/[.04] p-3 text-left transition-colors hover:bg-white/[.08]"
    >
      <span className="block text-[11px] uppercase tracking-wider text-white/45">{label}</span>
      <span className="mt-0.5 block font-mono text-[15px] font-semibold">{value}</span>
      <span className="mt-0.5 block text-[11px] text-[var(--ng-cyan)]">
        {copied ? "Copied" : "Tap to copy"}
      </span>
    </button>
  );
}
