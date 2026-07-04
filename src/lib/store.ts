// Admin session flag ONLY. Parent identity now lives in Supabase Auth (see
// `src/lib/auth.ts` — `useParentSession`). This module is kept for the
// admin path, which still signs in with a shared username/password and
// hits anon-key API routes at src/routes/api/*. Do not add parent-side
// state here.

const KEY_ROLE = "ng_role";

export type Role = "parent" | "admin";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getRole(): Role | null {
  if (!isBrowser()) return null;
  const v = window.localStorage.getItem(KEY_ROLE);
  return v === "parent" || v === "admin" ? v : null;
}

export function setRole(role: Role | null) {
  if (!isBrowser()) return;
  if (role) window.localStorage.setItem(KEY_ROLE, role);
  else window.localStorage.removeItem(KEY_ROLE);
}

export function isAuthed(): boolean {
  return getRole() !== null;
}

export function isAdmin(): boolean {
  return getRole() === "admin";
}
