// Session flag only. All swimmers / registrations / payments now live in
// Supabase and are read through src/lib/api.ts (React Query hooks against
// the /api/* routes). Anything that used to live here has moved.

const KEY_AUTHED = "ng_authed";

function isBrowser() {
  return typeof window !== "undefined";
}

export function isAuthed(): boolean {
  return isBrowser() && window.localStorage.getItem(KEY_AUTHED) === "true";
}

export function setAuthed(v: boolean) {
  if (!isBrowser()) return;
  if (v) window.localStorage.setItem(KEY_AUTHED, "true");
  else window.localStorage.removeItem(KEY_AUTHED);
}
