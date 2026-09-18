import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMe, useClaimable, useClaimSwimmer } from "@/lib/api";
import { FindSwimmer } from "@/components/FindSwimmer";
import { ConsentText } from "@/components/ConsentText";

export const Route = createFileRoute("/welcome")({
  component: Welcome,
});

// Registration, one step per screen.
//
// Everybody comes through here once, including the twenty families who
// registered for Machakos — their consent was never captured, so there is no
// record of what they agreed to. That is the thing this exists to fix, and it
// is why the flow does not care whether the account is new.
//
// Coaches and coordinators never land here: they are recognised by the
// allowlist and must never be held behind a form.
const STEPS = ["you", "second", "children", "consent"] as const;
type Step = (typeof STEPS)[number];

function Welcome() {
  const navigate = useNavigate();
  const me = useMe();
  const [step, setStep] = useState<Step>("you");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [secondName, setSecondName] = useState("");
  const [secondEmail, setSecondEmail] = useState("");
  const [claimed, setClaimed] = useState(0);
  const [consentData, setConsentData] = useState(false);
  const [consentCommunity, setConsentCommunity] = useState(false);

  // Prefill from the Machakos record where we have it, so a returning family is
  // confirming what the club already holds rather than retyping it.
  useEffect(() => {
    const p = me.data?.parent;
    if (!p) return;
    setFullName((v) => v || p.fullName || "");
    setPhone((v) => v || p.phone || "");
  }, [me.data]);

  useEffect(() => {
    if (!me.isLoading && !me.data?.signedIn) navigate({ to: "/" });
    if (me.data?.isAdmin) navigate({ to: "/admin" });
  }, [me.isLoading, me.data, navigate]);

  const idx = STEPS.indexOf(step);
  const canAdvance = useMemo(() => {
    if (step === "you") {
      return fullName.trim().length > 1 && phone.replace(/\D/g, "").length >= 9 && !!relationship;
    }
    if (step === "consent") return consentData && consentCommunity;
    return true;
  }, [step, fullName, phone, relationship, consentData, consentCommunity]);

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          relationship,
          consentData,
          consentCommunity,
          secondParent:
            secondName.trim() && secondEmail.trim()
              ? { name: secondName.trim(), email: secondEmail.trim() }
              : null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "Could not finish setting up your account.");
        return;
      }
      await me.refetch();
      // Straight into the analytics, same as a returning sign-in.
      window.location.href = "/tracker";
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ng-sora relative flex min-h-screen flex-col">
      <div className="ng-water" aria-hidden />
      <div className="ng-caustics" aria-hidden />

      <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-12 pt-10">
        <img
          src="/nextgen-logo.png"
          alt="NextGen Multi Sport Academy"
          className="mb-6 h-12 w-auto"
          width={395}
          height={265}
        />

        {/* progress — four steps, so it is worth showing how far in they are */}
        <div className="mb-7 flex items-center gap-2" aria-hidden>
          {STEPS.map((sName, i) => (
            <span
              key={sName}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{
                background: i <= idx ? "var(--ng-electric)" : "rgba(255,255,255,.18)",
              }}
            />
          ))}
        </div>
        <p className="ng-eyebrow mb-4">
          <span className="dot" aria-hidden />
          Step {idx + 1} of {STEPS.length}
        </p>

        <div className="ng-panel p-6 text-white sm:p-7">
          {step === "you" && (
            <>
              <h1 className="text-[23px] font-semibold">Let's set up your account</h1>
              <p className="mb-6 mt-1.5 text-[14px] leading-relaxed text-white/65">
                This is a one-off, even if you registered for the Nationals. We need it to know
                who to contact and which swimmers are yours.
              </p>

              <label className="ng-label" htmlFor="w-name">
                Your full name
              </label>
              <input
                id="w-name"
                className="ng-field"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />

              <label className="ng-label mt-4" htmlFor="w-phone">
                Phone number
              </label>
              <input
                id="w-phone"
                className="ng-field"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="07xx xxx xxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              <span className="ng-label mt-4 block">You are the</span>
              <div className="flex flex-wrap gap-2">
                {["mother", "father", "guardian"].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRelationship(r)}
                    aria-pressed={relationship === r}
                    className={
                      "min-h-[44px] rounded-xl px-4 text-[14.5px] font-medium capitalize transition-colors " +
                      (relationship === r
                        ? "bg-[var(--ng-electric)] text-white"
                        : "border border-white/25 bg-white/5 text-white/80 hover:bg-white/10")
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "second" && (
            <>
              <h1 className="text-[23px] font-semibold">Is there a second parent?</h1>
              <p className="mb-6 mt-1.5 text-[14px] leading-relaxed text-white/65">
                Optional. We will email them an invitation to set up their own access — their own
                sign-in, not a shared one, so the agreement they give is their own. Two adults can
                be on a swimmer.
              </p>

              <label className="ng-label" htmlFor="w-2name">
                Their name
              </label>
              <input
                id="w-2name"
                className="ng-field"
                autoComplete="off"
                value={secondName}
                onChange={(e) => setSecondName(e.target.value)}
              />

              <label className="ng-label mt-4" htmlFor="w-2email">
                Their email
              </label>
              <input
                id="w-2email"
                className="ng-field"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="them@example.com"
                value={secondEmail}
                onChange={(e) => setSecondEmail(e.target.value)}
              />
              <p className="mt-3 text-xs text-white/45">
                Leave both blank to skip. You can add them later.
              </p>
            </>
          )}

          {step === "children" && (
            <>
              <h1 className="text-[23px] font-semibold">Which swimmers are yours?</h1>
              <p className="mb-5 mt-1.5 text-[14px] leading-relaxed text-white/65">
                Search their name. A coordinator confirms each one before you can see named
                results, so this may say "waiting" for a little while.
              </p>
              <div className="rounded-xl bg-white/[.04] p-4">
                <FindSwimmer onClaimed={() => setClaimed((n) => n + 1)} dark />
              </div>
              {claimed > 0 && (
                <p className="mt-4 text-[13.5px] font-medium text-[var(--ng-cyan)]">
                  {claimed} swimmer{claimed === 1 ? "" : "s"} added. You can add more, or carry on.
                </p>
              )}
              <p className="mt-3 text-xs text-white/45">
                Not listed? Carry on and tell the coordinator — we will add them.
              </p>
            </>
          )}

          {step === "consent" && (
            <>
              <h1 className="text-[23px] font-semibold">How we use your child's data</h1>
              <p className="mb-5 mt-1.5 text-[14px] leading-relaxed text-white/65">
                Please read this. Both boxes need ticking — we cannot set up your account without
                them.
              </p>

              <ConsentText />

              <label className="mt-5 flex cursor-pointer gap-3 rounded-xl border border-white/15 bg-white/[.04] p-4">
                <input
                  id="w-consent-data"
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 flex-none accent-[var(--ng-electric)]"
                  checked={consentData}
                  onChange={(e) => setConsentData(e.target.checked)}
                />
                <span className="text-[13.8px] leading-relaxed text-white/85">
                  I am the parent or guardian of the swimmers I have selected, and I consent to
                  NextGen holding and using their data as described above.
                </span>
              </label>

              <label className="mt-3 flex cursor-pointer gap-3 rounded-xl border border-white/15 bg-white/[.04] p-4">
                <input
                  id="w-consent-community"
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 flex-none accent-[var(--ng-electric)]"
                  checked={consentCommunity}
                  onChange={(e) => setConsentCommunity(e.target.checked)}
                />
                <span className="text-[13.8px] leading-relaxed text-white/85">
                  I understand this data belongs to the NextGen community. These are other
                  people's children. I will not screenshot, share or republish it outside the
                  club, and I understand my access can be withdrawn.
                </span>
              </label>
            </>
          )}

          {error && <p className="mt-4 text-sm font-medium text-[#FFC24B]">{error}</p>}

          <div className="mt-6 flex items-center gap-3">
            {idx > 0 && (
              <button
                type="button"
                onClick={() => setStep(STEPS[idx - 1])}
                className="min-h-[44px] px-2 text-[14px] text-white/55 hover:text-white"
              >
                Back
              </button>
            )}
            <button
              type="button"
              disabled={!canAdvance || busy}
              onClick={() => (step === "consent" ? finish() : setStep(STEPS[idx + 1]))}
              className="ng-btn ng-btn-primary ml-auto min-h-[44px] flex-1 sm:flex-none sm:px-8"
            >
              {busy
                ? "Setting up…"
                : step === "consent"
                  ? "Agree and finish"
                  : step === "second" && !secondName && !secondEmail
                    ? "Skip"
                    : "Continue"}
            </button>
          </div>
        </div>
      </main>

      <footer className="relative px-5 pb-8 text-center text-[11.5px] text-white/35">
        <img
          src="/golden-pipit-bird-light.png"
          alt=""
          width={306}
          height={256}
          className="mr-2 inline-block h-[17px] w-auto align-[-3px] opacity-70"
        />
        A product of <span className="font-semibold text-white/55">Golden Pipit Solutions</span>
      </footer>
    </div>
  );
}
