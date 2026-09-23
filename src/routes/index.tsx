import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  GOLDEN_PIPIT_URL,
  GOLDEN_PIPIT_EMAIL,
  GOLDEN_PIPIT_PHONE,
  GOLDEN_PIPIT_PHONE_DISPLAY,
} from "@/lib/links";
import { useEffect, useState } from "react";
import { useMe, useRequestCode, useVerifyCode } from "@/lib/api";
import { ProgressWall } from "@/components/ProgressWall";

export const Route = createFileRoute("/")({
  component: PortalLanding,
});

// The front door for the whole portal, not for any one meet.
//
// This used to be the Machakos sign-in, which made sense when the meet was the
// only thing here. It is now one sign-in that opens two things — the events a
// child is entered for, and that child's swimming since they joined — so the
// page says that rather than naming a meet that is over in November.
//
// Styling follows welcome.nextgenkenya.com: the same navy water, the same
// electric blue, Anton over Sora. A parent should recognise it as the club.
function PortalLanding() {
  const navigate = useNavigate();
  const me = useMe();
  const requestCode = useRequestCode();
  const verifyCode = useVerifyCode();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [devNote, setDevNote] = useState(false);

  useEffect(() => {
    if (me.isLoading || !me.data?.signedIn) return;
    // Coordinators land on the analytics; everyone else lands on Events,
    // which is the part that is actually finished and the reason parents are
    // here this month. Analytics is still one click away in the bar, and says
    // for itself that it is not ready. Coordinators are never held behind
    // registration.
    if (me.data.isAdmin) { window.location.href = "/tracker"; return; }
    if (me.data.needsRegistration) { navigate({ to: "/welcome" }); return; }
    navigate({ to: "/parent" });
  }, [me.isLoading, me.data, navigate]);

  // Whether the shared coordinator sign-in exists at all. The server answers
  // from one environment variable, so turning it off after testing is one
  // change and the link disappears with it.
  const [demoOn, setDemoOn] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [demoPw, setDemoPw] = useState("");
  const [demoBusy, setDemoBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/demo")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setDemoOn(!!j?.enabled))
      .catch(() => undefined);
  }, []);

  async function onDemo() {
    setDemoBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: demoPw }),
      });
      if (!r.ok) {
        const b = (await r.json()) as { error?: string };
        setError(b.error ?? "Could not sign in.");
        return;
      }
      window.location.href = "/tracker";
    } catch {
      setError("Could not sign in.");
    } finally {
      setDemoBusy(false);
    }
  }

  async function onSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await requestCode.mutateAsync(email.trim());
      setDevNote(!!r.devMode);
      setStep("code");
    } catch {
      setError("Could not send a code just now. Please try again in a moment.");
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await verifyCode.mutateAsync({ email: email.trim(), code: code.trim() });
      if (r.isAdmin) { window.location.href = "/tracker"; return; }
      const who = await fetch("/api/auth/me").then((x) => x.json()).catch(() => null);
      if (who?.needsRegistration) { navigate({ to: "/welcome" }); return; }
      navigate({ to: "/parent" });
    } catch {
      setError("That code is wrong or has expired. Check the email, or send a new code.");
    }
  }

  // Listed side by side with no distinction, these read as two things you get
   // on signing in. Only Events is: the performance pages are coach-only until
   // the consent drive closes, so a parent entering Machakos today and then
   // looking for their child's times would find a locked door and no
   // explanation. Say which is ready.
  const features = [
    {
      title: "Events",
      body: "What your child is entered for, what is still owed, and how to pay.",
      path: "M8 2v3m8-3v3M3.5 9.5h17M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
      soon: false,
    },
    {
      title: "NextGen Analytics",
      body: "How swimming at the club is developing — season by season, stroke by stroke, by age group. Opening to families once every guardian has been asked to consent.",
      path: "M4 19V10m5 9V5m5 14v-6m5 6V8",
      soon: true,
    },
  ];

  return (
    <div className="ng-sora relative flex min-h-screen flex-col">
      <div className="ng-water" aria-hidden />
      <div className="ng-caustics" aria-hidden />

      <main className="mx-auto grid w-full max-w-5xl items-center gap-12 px-5 pb-6 pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(340px,395px)] lg:pt-20">
        <div className="text-white">
          <img
            src="/nextgen-logo.png"
            alt="NextGen Multi Sport Academy"
            className="mb-7 h-[70px] w-auto"
            width={395}
            height={265}
          />
          <p className="ng-eyebrow mb-5">
            <span className="dot" aria-hidden />
            NextGen Multi Sport Academy
          </p>
          <h1 className="ng-display text-[clamp(38px,6.2vw,62px)]" style={{ textWrap: "balance" }}>
            One sign-in for
            <span className="block" style={{ color: "var(--ng-electric)" }}>
              your swimmer
            </span>
          </h1>
          <p className="mt-5 max-w-[48ch] text-[16.5px] leading-relaxed text-white/70">
            Sign in to see the events your child is entered for, and to enter them for
            Machakos. The performance pages are coming next.
          </p>

          <ul className="ng-panel mt-9 max-w-[520px] px-6 py-1">
            {features.map((f, i) => (
              <li
                key={f.title}
                className={"flex gap-4 py-4 " + (i === 0 ? "border-b border-white/10" : "")}
              >
                <span className="ng-ic" aria-hidden>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d={f.path} />
                  </svg>
                </span>
                <span>
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[15.5px] font-semibold text-white">{f.title}</span>
                    {f.soon ? (
                      <span className="rounded-full border border-[color:var(--ng-electric)]/45
                                       bg-[color:var(--ng-electric)]/12 px-2 py-[1px]
                                       text-[10.5px] font-semibold uppercase tracking-wide
                                       text-[color:var(--ng-electric)]">
                        Coming soon
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10
                                       px-2 py-[1px] text-[10.5px] font-semibold uppercase
                                       tracking-wide text-emerald-300">
                        Live now
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm text-white/65">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="ng-panel p-7 text-white">
          {demoOn && showDemo ? (
            /* Its own screen, not a drawer under the parent form.
               It used to be rendered inside that form, below a filled-in email
               box, which made one sign-in look like two halves of another. */
            <div>
              <h2 className="text-[20px] font-semibold">Coordinator sign-in</h2>
              <p className="mb-6 mt-1.5 text-[13.5px] leading-relaxed text-white/65">
                For the club's coaches and coordinators. This is a shared password, not an
                email code — parents do not need it.
              </p>
              <label className="ng-label" htmlFor="demopw">Coordinator password</label>
              <input
                id="demopw"
                className="ng-field"
                type="password"
                autoComplete="off"
                autoFocus
                value={demoPw}
                onChange={(e) => setDemoPw(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void onDemo(); } }}
                placeholder="Password"
              />
              {error && <p className="mt-3 text-sm font-medium text-[#FFC24B]">{error}</p>}
              <button
                type="button"
                onClick={() => void onDemo()}
                disabled={demoBusy || !demoPw}
                className="ng-btn ng-btn-primary mt-4 w-full"
              >
                {demoBusy ? "Signing in\u2026" : "Sign in"}
              </button>
              <p className="mt-4 text-xs leading-relaxed text-white/45">
                Every use is recorded in the activity log.
              </p>
              <button
                type="button"
                onClick={() => { setShowDemo(false); setDemoPw(""); setError(null); }}
                className="mt-5 w-full border-t border-white/10 pt-4 text-xs text-white/45
                           underline-offset-4 hover:text-white hover:underline"
              >
                I am a parent — sign in with my email instead
              </button>
            </div>
          ) : step === "email" ? (
            <form onSubmit={onSendCode}>
              <h2 className="text-[20px] font-semibold">Sign in</h2>
              <p className="mb-6 mt-1.5 text-[13.5px] leading-relaxed text-white/65">
                Any email address — new to the club or not. We send a six-digit code, so there
                is no password to remember. First time here? Sign in the same way and we will
                set you up.
              </p>
              <label className="ng-label" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                className="ng-field"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {error && <p className="mt-3 text-sm font-medium text-[#FFC24B]">{error}</p>}
              <button
                type="submit"
                className="ng-btn ng-btn-primary mt-4 w-full"
                disabled={requestCode.isPending}
              >
                {requestCode.isPending ? "Sending…" : "Send me a code"}
              </button>
              <p className="mt-4 text-xs leading-relaxed text-white/45">
                If an address is not recognised, nothing is sent. Your details are visible only to
                you and the club's coordinators.
              </p>

              {/* Only rendered when DEMO_PASSWORD is set on the server, so the
                  page never advertises a door that is not there. */}
              {demoOn && !showDemo && (
                <button
                  type="button"
                  onClick={() => {
                    // Leave nothing of the parent form behind. An address still
                    // sitting in the box above made the coordinator password
                    // look like part of the same sign-in.
                    setShowDemo(true);
                    setError(null);
                    setEmail("");
                    setCode("");
                    setStep("email");
                  }}
                  className="mt-3 w-full text-xs text-white/45 underline-offset-4
                             hover:text-white hover:underline"
                >
                  Coordinator sign-in
                </button>
              )}
            </form>
          ) : (
            <form onSubmit={onVerify}>
              <h2 className="text-[20px] font-semibold">Check your email</h2>
              <p className="mb-6 mt-1.5 text-[13.5px] leading-relaxed text-white/65">
                A six-digit code is on its way to{" "}
                <span className="font-semibold text-white">{email}</span>. It expires in 10
                minutes. If it is not there, check your spam folder.
              </p>
              <label className="ng-label" htmlFor="code">
                Six-digit code
              </label>
              <input
                id="code"
                className="ng-field text-center text-lg tracking-[0.4em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
              {devNote && (
                <p className="mt-3 rounded-lg border border-[#FFC24B]/40 bg-[#FFC24B]/10 p-2 text-xs text-[#FFC24B]">
                  Email is not configured on this deployment, so the code was printed to the server
                  log.
                </p>
              )}
              {error && <p className="mt-3 text-sm font-medium text-[#FFC24B]">{error}</p>}
              <button
                type="submit"
                className="ng-btn ng-btn-primary mt-4 w-full"
                disabled={verifyCode.isPending}
              >
                {verifyCode.isPending ? "Checking…" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
                className="mt-3 w-full text-xs text-white/50 underline-offset-4 hover:text-white hover:underline"
              >
                Use a different email, or send a new code
              </button>
            </form>
          )}
        </div>
      </main>

      <div className="relative mx-auto w-full max-w-5xl px-5 pb-16">
        <ProgressWall />
      </div>

      <footer className="relative px-5 pb-8 text-center text-[11.5px] text-white/35">
        <img
          src="/golden-pipit-bird-light.png"
          alt=""
          width={306}
          height={256}
          className="mr-2 inline-block h-[17px] w-auto align-[-3px] opacity-70"
        />
        A product of{" "}
        <a
          href={GOLDEN_PIPIT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-white/55 underline-offset-4 hover:text-white hover:underline"
        >
          Golden Pipit Solutions
        </a>
        <span className="mt-2 block text-white/40">
          <a href={`mailto:${GOLDEN_PIPIT_EMAIL}`}
             className="underline-offset-4 hover:text-white/70 hover:underline">
            {GOLDEN_PIPIT_EMAIL}
          </a>
          <span className="px-2 text-white/25">·</span>
          <a href={`tel:${GOLDEN_PIPIT_PHONE}`}
             className="underline-offset-4 hover:text-white/70 hover:underline">
            {GOLDEN_PIPIT_PHONE_DISPLAY}
          </a>
        </span>
      </footer>
    </div>
  );
}
