import { GOLDEN_PIPIT_PHONE, GOLDEN_PIPIT_PHONE_DISPLAY } from "@/lib/links";

// Said once, in the same words, on every door.
//
// Families are being asked to put real money and a child's health details into
// something that is a fortnight old. Saying so is not an apology — it sets the
// expectation that a bump is a bump rather than a sign the club has lost their
// payment, and it gives them a person to ring instead of a form to abandon.
// The number is a tel: link because most of them are on a phone.
export function DevNotice({ dark = true }: { dark?: boolean }) {
  return (
    <p
      className={
        "rounded-xl border px-4 py-3 text-[13.5px] leading-relaxed " +
        (dark
          ? "border-[#FFC24B]/35 bg-[#FFC24B]/10 text-white/80"
          : "border-amber-300/70 bg-amber-50 text-amber-900")
      }
    >
      This is a new web app undergoing development. Expect some bumps along the road until it is
      done. Reach out to F. Njenga (
      <a
        href={`tel:${GOLDEN_PIPIT_PHONE}`}
        className={
          "font-semibold underline-offset-4 hover:underline " +
          (dark ? "text-[#FFC24B]" : "text-amber-900")
        }
      >
        {GOLDEN_PIPIT_PHONE_DISPLAY}
      </a>
      ) for troubleshooting queries.
    </p>
  );
}
