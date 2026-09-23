import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GOLDEN_PIPIT_URL, GOLDEN_PIPIT_EMAIL } from "@/lib/links";
import { ConsentText } from "@/components/ConsentText";

export const Route = createFileRoute("/tester")({ component: TesterGate });

// The preview's own front door.
//
// Deliberately a separate route from "/", not a mode of it. A tester is not a
// parent: they have no child, never see Events, and their way in is a link the
// club hands out rather than something a visitor stumbles into. Keeping the two
// doors apart means neither has to explain the other.
type Step = "landing" | "register" | "code" | "agree";

const CONFIDENTIALITY = [
  "You are being given early access to an unreleased part of the NextGen platform. What it shows is the competition record of real children who swim for the club: their names, their ages, their race times and how those times are moving.",
  "You agree that you will not take screenshots or recordings, forward or republish anything you see, discuss a named child outside the club, or use this data for any purpose other than telling NextGen what you think of the product.",
  "Your access is personal. Do not share your sign-in code or let anyone else use your account. Access ends on 30 September 2026, or sooner if the club withdraws it.",
  "Everything you do here is logged against your name — every sign-in, every page. The club can see it.",
  "This agreement ends when NextGen Analytics is released publicly, except the obligation not to share what you saw during the preview, which continues.",
];

function TesterGate() {
  const [step, setStep] = useState<Step>("landing");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devNote, setDevNote] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [howKnown, setHowKnown] = useState("");
  const [code, setCode] = useState("");
  const [returning, setReturning] = useState(false);

  const [agreeConf, setAgreeConf] = useState(false);
  const [agreeData, setAgreeData] = useState(false);

  // Already signed in? Skip to whichever step is actually outstanding.
  useEffect(() => {
    fetch("/api/tester/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.isTester) return;
        if (d.revoked || d.expired) {
          setError(
            d.revoked
              ? "Your preview access has been withdrawn. Speak to the club."
              : "The preview has ended. Thank you for testing.",
          );
          return;
        }
        if (d.agreed) window.location.href = "/tracker";
        else { setEmail(d.email ?? ""); setStep("agree"); }
      })
      .catch(() => undefined);
  }, []);

  async function sendCode(isReturning: boolean) {
    setBusy(true);
    setError(null);
    try {
      const url = isReturning ? "/api/auth/request-code" : "/api/tester/register";
      const body = isReturning ? { email: email.trim() } : { email: email.trim(), fullName, howKnown };
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? "Could not send a code."); return; }
      setDevNote(!!d.devMode);
      setReturning(isReturning);
      setStep("code");
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError("That code is wrong or has expired."); return; }
      if (!d.isTester) { window.location.href = "/tracker"; return; }
      const me = await fetch("/api/tester/me").then((x) => x.json()).catch(() => null);
      if (me?.agreed) window.location.href = "/tracker";
      else setStep("agree");
    } catch {
      setError("Could not sign you in.");
    } finally {
      setBusy(false);
    }
  }

  async function agree() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/tester/agree", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confidentiality: agreeConf, consent: agreeData }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? "Could not record your agreement."); return; }
      window.location.href = "/tracker";
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ng-sora relative flex min-h-screen flex-col">
      <div className="ng-water" aria-hidden />
      <div className="ng-caustics" aria-hidden />

      <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-12 pt-10">
        <img src="/nextgen-logo.png" alt="NextGen Multi Sport Academy"
             className="mb-6 h-12 w-auto" width={395} height={265} />

        {step === "landing" && (
          <>
            <p className="ng-eyebrow mb-4"><span className="dot" aria-hidden />Closed preview</p>
            <h1 className="text-[30px] font-semibold leading-tight text-white">
              NextGen Analytics
            </h1>
            <p className="mb-6 mt-2 text-[14.5px] leading-relaxed text-white/65">
              You have been invited to look at how the club measures swimmer development before it
              is shown to parents. It is a working preview — expect rough edges, and tell us about
              them.
            </p>

            <div className="mb-6 rounded-xl border border-[#FFC24B]/35 bg-[#FFC24B]/10 p-4">
              <p className="text-[12.5px] font-bold uppercase tracking-wide text-[#FFC24B]">
                This is real data about real children
              </p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/78">
                Nothing you see here may leave the preview — no screenshots, no forwarding, no
                discussing a named child outside the club. You will be asked to agree to this in
                writing before anything is shown.
              </p>
            </div>

            <div className="ng-panel p-6">
              <h2 className="text-[19px] font-semibold text-white">Register as a tester</h2>
              <p className="mb-4 mt-1 text-[13.5px] leading-relaxed text-white/65">
                Your name, your email, and the agreement. About a minute.
              </p>
              <button type="button" className="ng-btn ng-btn-primary w-full"
                      onClick={() => { setStep("register"); setError(null); }}>
                Register as a tester
              </button>
              <button type="button"
                      className="mt-3 w-full border-t border-white/10 pt-4 text-xs text-white/50
                                 underline-offset-4 hover:text-white hover:underline"
                      onClick={() => { setStep("register"); setReturning(true); setError(null); }}>
                Already registered? Sign in as a tester
              </button>
            </div>
            {error && <p className="mt-4 text-sm font-medium text-[#FFC24B]">{error}</p>}
          </>
        )}

        {step === "register" && (
          <div className="ng-panel p-6">
            <h1 className="text-[22px] font-semibold text-white">
              {returning ? "Sign in as a tester" : "Thanks for helping us test"}
            </h1>
            <p className="mb-5 mt-1.5 text-[13.5px] leading-relaxed text-white/65">
              {returning
                ? "The email address you registered with. We send a six-digit code — there is no password."
                : "Just your name and an email address. Your name sits next to your feedback so we know who to thank — and who to ask when something needs a second look. Parents never see it."}
            </p>

            {!returning && (
              <>
                <label className="ng-label" htmlFor="t-name">Your full name</label>
                <input id="t-name" className="ng-field" autoComplete="name" value={fullName}
                       onChange={(e) => setFullName(e.target.value)} />
              </>
            )}

            <label className="ng-label mt-4" htmlFor="t-email">Email address</label>
            <input id="t-email" className="ng-field" type="email" autoComplete="email"
                   value={email} onChange={(e) => setEmail(e.target.value)} />

            {!returning && (
              <>
                <label className="ng-label mt-4" htmlFor="t-how">
                  How do you know the club? <span className="font-normal normal-case tracking-normal text-white/40">optional</span>
                </label>
                <input id="t-how" className="ng-field" value={howKnown}
                       onChange={(e) => setHowKnown(e.target.value)}
                       placeholder="Coach at another club" />
              </>
            )}

            {error && <p className="mt-3 text-sm font-medium text-[#FFC24B]">{error}</p>}

            <button type="button" className="ng-btn ng-btn-primary mt-5 w-full"
                    disabled={busy || !email.trim() || (!returning && fullName.trim().length < 2)}
                    onClick={() => void sendCode(returning)}>
              {busy ? "Sending…" : "Send me a code"}
            </button>
            <button type="button" onClick={() => { setStep("landing"); setError(null); }}
                    className="mt-3 w-full text-xs text-white/45 underline-offset-4 hover:text-white hover:underline">
              Back
            </button>
          </div>
        )}

        {step === "code" && (
          <div className="ng-panel p-6">
            <h1 className="text-[22px] font-semibold text-white">Check your email</h1>
            <p className="mb-5 mt-1.5 text-[13.5px] leading-relaxed text-white/65">
              A six-digit code is on its way to <span className="font-semibold text-white">{email}</span>.
              It expires in 10 minutes. If it is not there, check your spam folder.
            </p>
            <label className="ng-label" htmlFor="t-code">Six-digit code</label>
            <input id="t-code" className="ng-field text-center text-lg tracking-[0.4em]"
                   inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
                   placeholder="000000" value={code}
                   onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            {devNote && (
              <p className="mt-3 rounded-lg border border-[#FFC24B]/40 bg-[#FFC24B]/10 p-2 text-xs text-[#FFC24B]">
                Email is not configured on this deployment, so the code was printed to the server log.
              </p>
            )}
            {error && <p className="mt-3 text-sm font-medium text-[#FFC24B]">{error}</p>}
            <button type="button" className="ng-btn ng-btn-primary mt-5 w-full"
                    disabled={busy || code.length !== 6} onClick={() => void verify()}>
              {busy ? "Checking…" : "Sign in"}
            </button>
            <button type="button" onClick={() => { setStep("register"); setCode(""); setError(null); }}
                    className="mt-3 w-full text-xs text-white/45 underline-offset-4 hover:text-white hover:underline">
              Use a different email, or send a new code
            </button>
          </div>
        )}

        {step === "agree" && (
          <div className="ng-panel p-6">
            <h1 className="text-[22px] font-semibold text-white">Before you see anything</h1>
            <p className="mb-4 mt-1.5 text-[13.5px] leading-relaxed text-white/65">
              Both boxes must be ticked. Your agreement is stored with your name and the date.
            </p>

            <div className="max-h-[38vh] overflow-y-auto rounded-xl border border-white/15
                            bg-black/20 p-4 text-[13.2px] leading-relaxed text-white/80">
              <h2 className="text-[14.5px] font-semibold text-white">
                Preview confidentiality agreement
              </h2>
              {CONFIDENTIALITY.map((para) => (
                <p key={para.slice(0, 24)} className="mt-2.5">{para}</p>
              ))}
            </div>

            <label htmlFor="ag-conf"
                   className="mt-4 flex cursor-pointer gap-3 rounded-xl border border-white/15 bg-white/[.04] p-4">
              <input id="ag-conf" type="checkbox" checked={agreeConf}
                     onChange={(e) => setAgreeConf(e.target.checked)}
                     className="mt-0.5 h-5 w-5 flex-none accent-[var(--ng-electric)]" />
              <span className="text-[13.6px] leading-relaxed text-white/85">
                I have read the confidentiality agreement and I agree to it. I understand this is
                data about other people's children.
              </span>
            </label>

            <details className="mt-3 rounded-xl border border-white/12 bg-white/[.03] p-4">
              <summary className="cursor-pointer text-[13.5px] font-medium text-white/80">
                Read the data consent document
              </summary>
              <div className="mt-3"><ConsentText /></div>
            </details>

            <label htmlFor="ag-data"
                   className="mt-3 flex cursor-pointer gap-3 rounded-xl border border-white/15 bg-white/[.04] p-4">
              <input id="ag-data" type="checkbox" checked={agreeData}
                     onChange={(e) => setAgreeData(e.target.checked)}
                     className="mt-0.5 h-5 w-5 flex-none accent-[var(--ng-electric)]" />
              <span className="text-[13.6px] leading-relaxed text-white/85">
                I accept the data consent document — how NextGen holds and uses this data.
              </span>
            </label>

            {error && <p className="mt-3 text-sm font-medium text-[#FFC24B]">{error}</p>}
            <button type="button" className="ng-btn ng-btn-primary mt-5 w-full"
                    disabled={busy || !agreeConf || !agreeData} onClick={() => void agree()}>
              {busy ? "Saving…" : "Agree and open NextGen Analytics"}
            </button>
          </div>
        )}

        <footer className="mt-10 text-center text-xs text-white/40">
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
