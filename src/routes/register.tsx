import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMe, useMySwimmers, useMyRegistrations, useMyPayments } from "@/lib/api";
import { EVENT, formatKes } from "@/lib/event-config";
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

function MachakosFlow() {
  const navigate = useNavigate();
  const me = useMe();
  const mine = useMySwimmers();
  const regs = useMyRegistrations();
  const pays = useMyPayments();

  const [step, setStep] = useState<Step>("who");
  const [picked, setPicked] = useState<string[]>([]);

  // The same guards as /parent, for the same reasons: registration first, and
  // no Machakos page for a family with nobody in the team.
  useEffect(() => {
    if (me.isLoading) return;
    if (!me.data?.signedIn) { navigate({ to: "/" }); return; }
    if (!me.data.isAdmin && me.data.needsRegistration) { navigate({ to: "/welcome" }); return; }
    if (!me.data.isAdmin && me.data.sections && me.data.sections.events === false) {
      window.location.href = "/tracker";
    }
  }, [me.isLoading, me.data, navigate]);

  const swimmers = mine.data ?? [];
  const registered = useMemo(
    () => new Set((regs.data ?? []).map((r) => r.swimmerId)),
    [regs.data],
  );
  const paid = (pays.data ?? []).reduce((n, p) => n + Number(p.amount ?? 0), 0);
  const due = EVENT.totalKes * Math.max(picked.length, 1);
  const idx = STEPS.indexOf(step);

  const canAdvance =
    step === "who" ? picked.length > 0 : step === "pay" ? false : true;

  return (
    <div className="ng-sora relative flex min-h-screen flex-col">
      <div className="ng-water" aria-hidden />
      <div className="ng-caustics" aria-hidden />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-12 pt-10 text-white">
        <img src="/nextgen-logo.png" alt="NextGen Multi Sport Academy"
             className="w-auto object-contain" width={395} height={265}
             style={{ height: "clamp(56px, 6vw, 84px)" }} />

        <h1 className="ng-display mt-6 text-[clamp(26px,4.4vw,40px)]">
          {EVENT.name}
          <span className="block" style={{ color: "var(--ng-electric)" }}>
            {EVENT.startDate} – {EVENT.endDate}
          </span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/70">
          {formatKes(EVENT.totalKes)} per swimmer. One screen at a time — nothing is charged
          until the last one.
        </p>

        {/* Where they are, shown the way /welcome shows it. */}
        <div className="mt-7 flex items-center gap-2" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s} className="h-1 flex-1 rounded-full transition-colors"
                  style={{ background: i <= idx ? "var(--ng-electric)" : "rgba(255,255,255,.18)" }} />
          ))}
        </div>
        <p className="ng-eyebrow mt-4">
          <span className="dot" aria-hidden />Step {idx + 1} of {STEPS.length}
        </p>

        <div className="ng-panel mt-4 p-6 sm:p-7">
          <h2 className="text-[21px] font-semibold">{TITLE[step]}</h2>

          {step === "who" && (
            <>
              <p className="mb-5 mt-1.5 text-[14px] leading-relaxed text-white/65">
                Entering more than one child lets you pay for all of them with a single M-Pesa
                transaction.
              </p>
              {swimmers.length === 0 ? (
                <p className="rounded-xl bg-white/[.06] p-4 text-[13.5px] text-white/70">
                  No swimmers on your account yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {swimmers.map((s) => {
                    const on = picked.includes(s.id);
                    return (
                      <li key={s.id}>
                        <button type="button"
                                onClick={() =>
                                  setPicked((p) =>
                                    on ? p.filter((x) => x !== s.id) : [...p, s.id])}
                                className={
                                  "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors " +
                                  (on
                                    ? "border-[var(--ng-electric)] bg-[var(--ng-electric)]/15"
                                    : "border-white/15 bg-white/[.04] hover:bg-white/[.07]")
                                }>
                          <span className={
                            "flex h-5 w-5 flex-none items-center justify-center rounded-md border " +
                            (on ? "border-[var(--ng-electric)] bg-[var(--ng-electric)]" : "border-white/35")
                          }>
                            {on && <span className="text-[12px] font-bold text-white">✓</span>}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-semibold">{s.name}</span>
                            <span className="block text-[12.5px] text-white/55">
                              {registered.has(s.id) ? "Entry form already saved" : "Not entered yet"}
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
                  {formatKes(due)} total
                </p>
              )}
            </>
          )}

          {step !== "who" && (
            <p className="mt-2 rounded-xl border border-white/15 bg-white/[.04] p-4 text-[13.5px] leading-relaxed text-white/70">
              This screen is still being built. The live registration is on the{" "}
              <a href="/parent" className="font-semibold text-[var(--ng-cyan)] underline-offset-4 hover:underline">
                Events page
              </a>{" "}
              and is unaffected.
              {step === "pay" && paid > 0 && (
                <span className="mt-2 block text-white/55">
                  Recorded against your account so far: {formatKes(paid)}.
                </span>
              )}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button type="button" disabled={idx === 0}
                    onClick={() => setStep(STEPS[idx - 1])}
                    className="text-[13px] text-white/55 underline-offset-4 hover:text-white hover:underline disabled:opacity-30">
              Back
            </button>
            <button type="button" disabled={!canAdvance}
                    onClick={() => setStep(STEPS[idx + 1])}
                    className="ng-btn ng-btn-primary px-7">
              Continue
            </button>
          </div>
        </div>

        <footer className="mt-9 text-center text-xs text-white/40">
          A product of{" "}
          <a href={GOLDEN_PIPIT_URL} target="_blank" rel="noopener noreferrer"
             className="font-semibold text-white/55 underline-offset-4 hover:text-white hover:underline">
            Golden Pipit Solutions
          </a>
          <span className="mt-2 block text-white/35">{GOLDEN_PIPIT_EMAIL}</span>
        </footer>
      </main>
    </div>
  );
}
