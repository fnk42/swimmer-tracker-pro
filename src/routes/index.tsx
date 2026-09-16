import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { EVENT } from "@/lib/event-config";
import { useMe, useRequestCode, useVerifyCode } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

// One sign-in for everyone. A six-digit code to the address already on the
// registration; coordinators are recognised by that same address, so there is
// no second password to circulate and nothing secret in this bundle.
function LoginPage() {
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
    navigate({ to: me.data.isAdmin ? "/admin" : "/parent" });
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
      navigate({ to: r.isAdmin ? "/admin" : "/parent" });
    } catch {
      setError("That code is wrong or has expired. Check the email, or send a new code.");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <img
            src="/nextgen-logo-dark.png"
            alt="NextGen Swim Club"
            className="mx-auto h-28 w-auto mb-6"
            width={395}
            height={265}
          />
          <div className="text-center mb-8 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{EVENT.name}</h1>
            <p className="text-sm text-muted-foreground">{EVENT.location}</p>
            <p className="text-xs text-muted-foreground">
              {EVENT.startDate} – {EVENT.endDate}
            </p>
          </div>

          <Card>
            {step === "email" ? (
              <>
                <CardHeader>
                  <CardTitle>Sign in</CardTitle>
                  <CardDescription>
                    Enter the email address on your child's registration. We'll send you a
                    six-digit code.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={onSendCode} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email address</Label>
                      <Input
                        id="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button
                      type="submit"
                      className="w-full h-11"
                      disabled={requestCode.isPending}
                    >
                      {requestCode.isPending ? "Sending…" : "Send me a code"}
                    </Button>
                  </form>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader>
                  <CardTitle>Check your email</CardTitle>
                  <CardDescription>
                    If <span className="font-medium">{email}</span> is on a registration, a
                    six-digit code is on its way. It expires in 10 minutes.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={onVerify} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="code">Six-digit code</Label>
                      <Input
                        id="code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        placeholder="000000"
                        className="text-center text-lg tracking-[0.4em]"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        required
                      />
                    </div>
                    {devNote && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                        Development mode — email is not configured, so the code was printed to
                        the server console.
                      </p>
                    )}
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button type="submit" className="w-full h-11" disabled={verifyCode.isPending}>
                      {verifyCode.isPending ? "Checking…" : "Sign in"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setStep("email"); setCode(""); setError(null); }}
                      className="w-full text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                    >
                      Use a different email, or send a new code
                    </button>
                  </form>
                </CardContent>
              </>
            )}
            <CardContent className="pt-0">
              <p className="text-xs text-muted-foreground text-center">
                Your details are visible only to you and the coordinators.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
