// Kenya mobile normalizer — mirrors the parents_phone_normalized_chk constraint.
// Accepts: "254XXXXXXXXX" (canonical), "07XXXXXXXX" / "01XXXXXXXX" (local
// leading-zero), or "7XXXXXXXX" / "1XXXXXXXX" (no country code, no leading
// zero). Returns the canonical 254-prefixed form, or null when the input
// doesn't fit any of those shapes.
export function normalizeKePhone(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  if (/^254[0-9]{9}$/.test(digits)) return digits;
  if (/^0[0-9]{9}$/.test(digits)) return "254" + digits.slice(1);
  if (/^[17][0-9]{8}$/.test(digits)) return "254" + digits;
  return null;
}
