import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useMe, useSignOut } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { EVENT } from "@/lib/event-config";
import { LogOut } from "lucide-react";

// One sign-in, so one bar to move between what that sign-in gives you.
//
// Two top-level sections rather than a flat row of pages: Analytics is the
// club's whole competitive record and stands on its own, while Events is a
// list that will grow — Machakos is simply the one that is open now, so it sits
// in a menu from the start rather than being promoted to a tab that has to be
// demoted later.
//
// Which sections appear comes from the session (/api/auth/me), not from
// anything decided here.
export function AppHeader() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const me = useMe();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  // Boit is both a coordinator and a parent, so the coordinator view sits
  // alongside the parent one rather than replacing it.
  const admin = !!me.data?.isAdmin;
  const sections = me.data?.sections ?? { performance: true, events: true };
  const onEvents = path === "/parent" || path === "/admin";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Same reason as the tracker bar: a tester belongs back at the tester door.
  // Which door, though, is what they came in by — not whether they happen to
  // lack a parent row. Gladys has one and is still a tester when she arrives
  // through the tester link, and sending her out through the front door loses
  // her the only page she was asked to look at.
  const isTester = me.data?.via === "tester" || (!!me.data?.isTester && !me.data?.parent);

  async function logout() {
    await signOut.mutateAsync();
    navigate({ to: isTester ? "/tester" : "/" });
  }

  // The tab you are on wears the club's electric blue — the same fill the
  // chosen swimmers get on the Nationals page. At 15% white it was nearly
  // invisible on a phone, which is where most parents read this.
  const tabBase = "text-sm px-3 py-1.5 rounded-md transition-colors";
  const tabActive =
    "bg-[var(--ng-electric)] text-white font-semibold shadow-[0_2px_10px_rgba(22,166,232,.38)] " +
    "hover:bg-[var(--ng-electric-deep)]";
  const tabIdle = "text-white/70 hover:bg-white/10 hover:text-white";
  const itemCls = "block rounded-md px-3 py-2 hover:bg-secondary";

  return (
    <header
      className="sticky top-0 z-30 border-b border-white/10 backdrop-blur-md"
      style={{ background: "rgba(7,20,39,.82)" }}
    >
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4 ng-sora">
        <Link to="/parent" className="flex items-center gap-3 min-w-0">
          <img
            src="/nextgen-logo.png"
            alt="NextGen Swim Club"
            className="h-9 w-auto shrink-0"
            width={395}
            height={265}
          />
          <span className="hidden sm:inline text-[11px] text-white/45 truncate tracking-wide">
            NextGen Multi Sport Academy
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1" aria-label="Portal sections">
          {sections.performance && (
            // Plain anchor, not a router Link: /tracker is served as its own
            // HTML document by the server, not a React route.
            <a href="/tracker" className={`${tabBase} ${tabIdle}`}>
              Analytics
            </a>
          )}

          {sections.events && !isTester && (
            <div className="relative" ref={menu}>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-haspopup="menu"
                className={`${tabBase} ${onEvents ? tabActive : tabIdle} flex items-center gap-1.5`}
              >
                Events
                <span aria-hidden className="text-[10px] leading-none">
                  ▾
                </span>
              </button>

              {open && (
                <div
                  role="menu"
                  className="absolute right-0 z-40 mt-1.5 w-64 rounded-xl border border-border bg-white p-1.5 shadow-lg"
                >
                  <div className="px-3 pt-1.5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {EVENT.location}
                  </div>
                  <Link
                    role="menuitem"
                    to="/parent"
                    onClick={() => setOpen(false)}
                    className={itemCls}
                  >
                    <span className="block text-sm font-medium text-foreground">{EVENT.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {EVENT.startDate} – {EVENT.endDate} · register &amp; pay
                    </span>
                  </Link>
                  {admin && (
                    <Link
                      role="menuitem"
                      to="/admin"
                      onClick={() => setOpen(false)}
                      className={itemCls}
                    >
                      <span className="block text-sm font-medium text-foreground">Admin view</span>
                      <span className="block text-xs text-muted-foreground">
                        Every registration and payment
                      </span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="ml-2 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </nav>
      </div>
    </header>
  );
}
