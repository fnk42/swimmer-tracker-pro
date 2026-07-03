import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AUTH, EVENT } from "@/lib/event-config";
import { isAuthed, setAuthed } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Waves } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthed()) navigate({ to: "/parent" });
  }, [navigate]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (username.trim() === AUTH.username && password === AUTH.password) {
      setAuthed(true);
      setError(null);
      navigate({ to: "/parent" });
    } else {
      setError("Incorrect username or password.");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="h-12 w-12 rounded-full bg-sky-600 text-white grid place-content-center mb-4">
            <Waves className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{EVENT.clubName}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {EVENT.name} · {EVENT.location}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
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
  );
}
