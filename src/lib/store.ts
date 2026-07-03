// Session flag only. All swimmers / registrations / payments now live in
// Supabase and are read through src/lib/api.ts (React Query hooks against
// the /api/* routes). Anything that used to live here has moved.

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
