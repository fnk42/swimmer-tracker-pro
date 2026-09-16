// SERVER ONLY. Signed session cookies — the replacement for Supabase Auth.
//
// A session is an HMAC-signed payload naming the parent row it belongs to.
// Nothing sensitive is stored in it and it cannot be forged without the secret,
// so a parent can never present themselves as a different parent. The browser
// holds no database credential; it only holds proof of who it is.
import { createHmac, timingSafeEqual, randomInt, createHash } from "node:crypto";

const COOKIE = "ng_session";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days — a term's worth of registration

export type Session =
  | { role: "parent"; parentId: string; email: string; exp: number }
  | { role: "admin"; exp: number };

// Omit<> over a union collapses to the keys the members share, which would
// silently drop parentId. Distribute it so each member keeps its own fields.
type NewSession =
  | { role: "parent"; parentId: string; email: string }
  | { role: "admin" };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short (needs 32+ chars). " +
        "Add it to .env and to the Vercel environment variables.",
    );
  }
  return s;
}

const b64 = (b: Buffer) => b.toString("base64url");
const sign = (data: string) => b64(createHmac("sha256", secret()).update(data).digest());

export function createSession(s: NewSession): string {
  const payload = { ...s, exp: Math.floor(Date.now() / 1000) + MAX_AGE_S } as Session;
  const body = b64(Buffer.from(JSON.stringify(payload)));
  return `${body}.${sign(body)}`;
}

export function readSession(token: string | undefined | null): Session | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body);
  // constant-time compare so a wrong signature cannot be probed byte by byte
  const a = Buffer.from(mac), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    if (!s.exp || s.exp < Math.floor(Date.now() / 1000)) return null;
    return s;
  } catch {
    return null;
  }
}

export function sessionFromRequest(request: Request): Session | null {
  const raw = request.headers.get("cookie") ?? "";
  const m = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return readSession(m ? decodeURIComponent(m[1]) : null);
}

export function cookieHeader(token: string | null): string {
  const base = `${COOKIE}=${token ? encodeURIComponent(token) : ""}; Path=/; HttpOnly; SameSite=Lax; Secure`;
  return token ? `${base}; Max-Age=${MAX_AGE_S}` : `${base}; Max-Age=0`;
}

// ---------- one-time codes ------------------------------------------------

/** Six digits, uniformly random. */
export function newCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Keyed hash — a stolen database dump yields no usable codes. */
export function hashCode(email: string, code: string): string {
  return createHash("sha256")
    .update(`${secret()}:${email.trim().toLowerCase()}:${code}`)
    .digest("hex");
}
