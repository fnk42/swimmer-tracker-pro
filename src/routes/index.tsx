import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
    // Everyone lands on the analytics. It is the thing people actually come
    // back for, and it is the best-looking page we have — Events is one click
    // away in the bar. Coordinators are never held behind registration.
    if (me.data.isAdmin) { window.location.href = "/tracker"; return; }
    if (me.data.needsRegistration) { navigate({ to: "/welcome" }); return; }
    window.location.href = "/tracker";
  }, [me.isLoading, me.data, navigate]);

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
      // Plain anchor navigation: /tracker is its own HTML document, not a route.
      window.location.href = "/tracker";
    } catch {
      setError("That code is wrong or has expired. Check the email, or send a new code.");
    }
  }

  const features = [
    {
      title: "Events",
      body: "What your child is entered for, what is still owed, and how to pay.",
      path: "M8 2v3m8-3v3M3.5 9.5h17M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
    },
    {
      title: "Performance",
      body: "How swimming at the club is developing — season by season, stroke by stroke, by age group.",
      path: "M4 19V10m5 9V5m5 14v-6m5 6V8",
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
            See the events your child is entered for, and how their swimming has developed over
            their time at the club — every race, every season.
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
                  <span className="block text-[15.5px] font-semibold text-white">{f.title}</span>
                  <span className="block text-sm text-white/65">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="ng-panel p-7 text-white">
          {step === "email" ? (
            <form onSubmit={onSendCode}>
              <h2 className="text-[20px] font-semibold">Sign in</h2>
              <p className="mb-6 mt-1.5 text-[13.5px] leading-relaxed text-white/65">
                Use the email address the club has for you. We send a six-digit code — there is
                no password to remember.
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
            </form>
          ) : (
            <form onSubmit={onVerify}>
              <h2 className="text-[20px] font-semibold">Check your email</h2>
              <p className="mb-6 mt-1.5 text-[13.5px] leading-relaxed text-white/65">
                If <span className="font-semibold text-white">{email}</span> is known to the club,
                a six-digit code is on its way. It expires in 10 minutes.
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
        A product of <span className="font-semibold text-white/55">Golden Pipit Solutions</span>
      </footer>
    </div>
  );
}
