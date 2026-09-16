import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { isAdmin, setRole } from "@/lib/store";
import { useMe, useSignOut } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { EVENT } from "@/lib/event-config";
import { LogOut } from "lucide-react";

export function AppHeader() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const me = useMe();
  const signOut = useSignOut();
  const session = me.data?.signedIn ? me.data : null;
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    // Hide the Admin tab whenever a Supabase session exists — a
    // Google-signed-in parent should never see it, even if ng_role="admin"
    // is still sitting in localStorage from an earlier coordinator login
    // in the same browser.
    setAdmin(isAdmin() && !session);
  }, [path, session]);

  async function logout() {
    await signOut.mutateAsync();
    setRole(null);
    navigate({ to: "/" });
  }

  const tabBase = "text-sm px-3 py-1.5 rounded-md transition-colors";
  const tabActive = "bg-slate-800 text-white font-medium";
  const tabIdle = "text-slate-300 hover:bg-slate-800 hover:text-white";

  return (
    <header className="border-b border-slate-800 bg-slate-900 sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
        <Link to="/parent" className="flex items-center gap-3 min-w-0">
          <img
            src="/nextgen-logo.png"
            alt="NextGen Swim Club"
            className="h-9 w-auto shrink-0"
            width={395}
            height={265}
          />
          <span className="hidden sm:inline text-[11px] text-slate-400 truncate">
            {EVENT.name} · {EVENT.location}
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          <Link to="/parent" className={`${tabBase} ${path === "/parent" ? tabActive : tabIdle}`}>
            Parent
          </Link>
          {admin && (
            <Link to="/admin" className={`${tabBase} ${path === "/admin" ? tabActive : tabIdle}`}>
              Admin
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="ml-2 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </nav>
      </div>
    </header>
  );
}
