import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useParentSession } from "@/lib/auth";
import { useLinkByPhone } from "@/lib/api";
import { normalizeKePhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EVENT } from "@/lib/event-config";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/link-phone")({
  component: LinkPhonePage,
});

function LinkPhonePage() {
  const navigate = useNavigate();
  const { session, loading } = useParentSession();
  const [phone, setPhone] = useState("");
  const [inlineError, setInlineError] = useState<string | null>(null);
  const linkMut = useLinkByPhone();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/", replace: true });
  }, [loading, session, navigate]);

  async function onContinue(e: React.FormEvent) {
    e.preventDefault();
    setInlineError(null);
    const normalized = normalizeKePhone(phone);
    if (!normalized) {
      toast.error("Enter a valid Kenyan number.");
      return;
    }
    try {
      const result = await linkMut.mutateAsync({ phone: normalized });
      if (result.status === "linked") {
        toast.success("Phone linked.");
        navigate({ to: "/parent", replace: true });
        return;
      }
      if (result.status === "no_match") {
        toast.info("No matching registration found — we'll create your record on the next screen.");
        navigate({ to: "/parent", replace: true });
        return;
      }
      // owned_by_other
      setInlineError("This phone is already linked to another account. Contact the coordinator.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(msg);
    }
  }

  function onSkip() {
    navigate({ to: "/parent", replace: true });
  }

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-10 flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading…</p>
          </CardContent>
        </Card>
      </div>
    );
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
            <p className="text-sm text-muted-foreground">
              Signed in as {session.user.email ?? "your Google account"}
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Confirm your phone</CardTitle>
              <CardDescription>
                If your child is already on the roster, this links your account to that
                registration. If not, we'll set things up on the next screen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onContinue} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Cell number</Label>
                  <Input
                    id="phone"
                    inputMode="tel"
                    placeholder="+254 7XX XXX XXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoFocus
                  />
                </div>
                {inlineError && <p className="text-sm text-destructive">{inlineError}</p>}
                <Button type="submit" className="w-full h-11" disabled={linkMut.isPending}>
                  {linkMut.isPending ? "Checking…" : "Continue"}
                </Button>
                <button
                  type="button"
                  onClick={onSkip}
                  className="w-full text-xs text-muted-foreground hover:text-foreground pt-1"
                >
                  Skip — I'll set this up during registration
                </button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
