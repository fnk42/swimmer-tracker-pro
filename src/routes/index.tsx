import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AUTH, EVENT } from "@/lib/event-config";
import { getRole, isAuthed, setRole } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthed()) {
      navigate({ to: getRole() === "admin" ? "/admin" : "/parent" });
    }
  }, [navigate]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim();
    if (u === AUTH.admin.username && password === AUTH.admin.password) {
      setRole("admin");
      setError(null);
      navigate({ to: "/admin" });
      return;
    }
    if (u === AUTH.parent.username && password === AUTH.parent.password) {
      setRole("parent");
      setError(null);
      navigate({ to: "/parent" });
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
            <h1 className="text-2xl font-semibold tracking-tight">
              {EVENT.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {EVENT.location}
            </p>
            <p className="text-xs text-muted-foreground">
              {EVENT.startDate} – {EVENT.endDate}
            </p>
          </div>

          <Card>
          <CardHeader>
            <CardTitle>Parent sign-in</CardTitle>
            <CardDescription>Use the shared credentials sent by the convener.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
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
                Sign in
              </Button>
              <p className="text-xs text-muted-foreground text-center pt-2">
                MVP scaffold · shared credentials · data synced via Supabase
              </p>
            </form>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}
