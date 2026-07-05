// Parent-side identity via Supabase Auth. Admin identity still lives in
// localStorage `ng_role` (see `src/lib/store.ts`) — this module is parents-only.
import { useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { setRole } from "./store";
import { toast } from "sonner";

export async function signInWithGoogle(): Promise<void> {
  // Clear any lingering admin flag in localStorage BEFORE redirecting to
  // Google. Without this, an operator who tested coordinator sign-in and
  // then hit "Continue with Google" ends up on /parent with ng_role still
  // set to "admin" — which surfaces the Admin tab and lets them into
  // /admin as a Google-signed-in parent. Belt-and-braces with the
  // AppHeader session check.
  setRole(null);
  const supabase = getSupabase();
  const redirectTo = window.location.origin + "/auth/callback";
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      // Force Google's account chooser every time. Without this Google
      // silently reuses the browser's most recent session, which is the
      // wrong default on shared family devices where one parent may have
      // just used another parent's account.
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) {
    console.error("[auth] signInWithOAuth failed:", error);
    toast.error(error.message || "Google sign-in failed. Please try again.");
  }
  // On success the browser is redirected to Google; nothing else to do here.
}

export async function signOutParent(): Promise<void> {
  try {
    await getSupabase().auth.signOut();
  } catch (err) {
    console.error("[auth] signOut failed:", err);
  }
}

export function getAccessToken(): Promise<string | null> {
  return getSupabase()
    .auth.getSession()
    .then(({ data }) => data.session?.access_token ?? null)
    .catch(() => null);
}

export type ParentSession = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

// React hook. Loads the initial session, then subscribes to auth state
// changes so pages re-render when the parent signs in / out from any tab.
export function useParentSession(): ParentSession {
  const [state, setState] = useState<ParentSession>({
    session: null,
    user: null,
    loading: true,
  });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const supabase = getSupabase();
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted.current) return;
        setState({
          session: data.session,
          user: data.session?.user ?? null,
          loading: false,
        });
      })
      .catch(() => {
        if (!mounted.current) return;
        setState({ session: null, user: null, loading: false });
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted.current) return;
      setState({
        session,
        user: session?.user ?? null,
        loading: false,
      });
    });
    return () => {
      mounted.current = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
