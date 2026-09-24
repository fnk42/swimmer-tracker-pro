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

/**
 * A stable key for any phone number, Kenyan or not.
 *
 * normalizeKePhone is the canonicaliser, and was also being used as a gate —
 * so a number it did not recognise was refused outright, which is no way to
 * treat somebody telling you how to reach them. It still runs first, because
 * a Kenyan mobile written five ways must land on one identity. Anything else
 * keeps its digits, which is enough to be a key and enough to dial.
 *
 * Returns null only when there are too few digits to be a phone number at all.
 */
export function canonicalPhone(input: string): string | null {
  const ke = normalizeKePhone(input);
  if (ke) return ke;
  const digits = (input || "").replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}
