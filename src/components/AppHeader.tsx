import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { setAuthed } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { EVENT } from "@/lib/event-config";
import { Waves, LogOut } from "lucide-react";

export function AppHeader() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  function logout() {
    setAuthed(false);
    navigate({ to: "/" });
  }

  return (
    <header className="border-b bg-white sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-full bg-sky-600 text-white grid place-content-center shrink-0">
            <Waves className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{EVENT.clubName}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {EVENT.name} · {EVENT.location}
            </div>
          </div>
        </div>
        <nav className="ml-auto flex items-center gap-1">
          <Link
            to="/parent"
            className={`text-sm px-3 py-1.5 rounded-md ${
              path === "/parent" ? "bg-sky-50 text-sky-700 font-medium" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            Parent
          </Link>
          <Link
            to="/admin"
            className={`text-sm px-3 py-1.5 rounded-md ${
              path === "/admin" ? "bg-sky-50 text-sky-700 font-medium" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            Admin
          </Link>
          <Button variant="ghost" size="sm" onClick={logout} className="ml-2">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </nav>
      </div>
    </header>
  );
}
