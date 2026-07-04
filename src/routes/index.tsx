import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AUTH, EVENT } from "@/lib/event-config";
import { getRole, setRole } from "@/lib/store";
import { signInWithGoogle, useParentSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.19 3.32v2.75h3.54c2.07-1.91 3.29-4.72 3.29-8.08z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.67l-3.54-2.75c-.98.66-2.24 1.05-3.74 1.05-2.87 0-5.3-1.94-6.17-4.55H2.18v2.86A11 11 0 0 0 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.83 14.08A6.6 6.6 0 0 1 5.48 12c0-.72.12-1.42.35-2.08V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.44 1.18 4.94l3.65-2.86z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.65 2.86C6.7 7.32 9.13 5.38 12 5.38z"
        fill="#EA4335"
      />
    </svg>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useParentSession();
  const [adminOpen, setAdminOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (session) {
      navigate({ to: "/parent" });
      return;
    }
    // If Supabase is still mid-code-exchange (e.g. the OAuth redirect
    // landed here instead of /auth/callback), don't apply the ng_role
    // fallback — that would race the session into existence and shove
    // a signed-in parent onto /admin.
    if (typeof window !== "undefined") {
      const url = window.location.href;
      const hasCode = url.includes("code=") || url.includes("access_token=");
      if (hasCode) return;
    }
    if (getRole() === "admin") {
      navigate({ to: "/admin" });
    }
  }, [loading, session, navigate]);

  async function onGoogleClick() {
    setGooglePending(true);
    try {
      await signInWithGoogle();
    } finally {
      setGooglePending(false);
    }
  }

  function onAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim();
    if (u === AUTH.admin.username && password === AUTH.admin.password) {
      setRole("admin");
      setError(null);
      navigate({ to: "/admin" });
      return;
    }
    setError("Incorrect username or password.");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center">
          <img
            src="/nextgen-logo.png"
            alt="NextGen Swim Club"
            className="h-9 w-auto"
            width={395}
            height={265}
          />
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{EVENT.name}</h1>
            <p className="text-sm text-muted-foreground">{EVENT.location}</p>
            <p className="text-xs text-muted-foreground">
              {EVENT.startDate} – {EVENT.endDate}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>
                Parents sign in with the Google account you'd like tied to your child's
                registration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                type="button"
                variant="outline"
                onClick={onGoogleClick}
                disabled={googlePending}
                className="w-full h-11 gap-2"
              >
                <GoogleIcon />
                {googlePending ? "Redirecting…" : "Continue with Google"}
              </Button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setAdminOpen((v) => !v)}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                >
                  {adminOpen ? "Hide coordinator sign-in" : "Coordinator sign-in"}
                </button>
              </div>

              {adminOpen && (
                <form onSubmit={onAdminSubmit} className="space-y-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" className="w-full h-11">
                    Coordinator sign in
                  </Button>
                </form>
              )}

              <p className="text-xs text-muted-foreground text-center pt-2">
                Data synced via Supabase · your details are only visible to you and the coordinator.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
