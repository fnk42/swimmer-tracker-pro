import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useParentSession } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const { session, loading } = useParentSession();
  const [failed, setFailed] = useState(false);

  // Manual code-exchange fallback for the (rare) case where
  // detectSessionInUrl doesn't pick up the redirect parameters. Runs once
  // on mount; swallow errors so we still fall through to the normal
  // session-check flow below.
  useEffect(() => {
    const url = window.location.href;
    if (!url.includes("code=") && !url.includes("access_token=")) return;
    getSupabase()
      .auth.exchangeCodeForSession(url)
      .catch(() => {
        /* ignore — onAuthStateChange will still fire if the SDK handled it */
      });
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      const timer = setTimeout(() => setFailed(true), 1500);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await getSupabase()
        .from("parents")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("[auth/callback] parents lookup failed:", error);
        navigate({ to: "/auth/link-phone", replace: true });
        return;
      }
      if (data) {
        navigate({ to: "/parent", replace: true });
      } else {
        navigate({ to: "/auth/link-phone", replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
          {failed ? (
            <>
              <p className="text-sm font-medium">Sign-in didn't complete.</p>
              <p className="text-xs text-muted-foreground">
                Please try again from the sign-in page.
              </p>
              <Button variant="outline" className="mt-2" onClick={() => navigate({ to: "/" })}>
                Back to sign-in
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Signing you in…</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
