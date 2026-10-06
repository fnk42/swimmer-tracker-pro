// Said once, in the same words, on every door.
//
// Families are being asked to put real money and a child's details into
// something new. Saying so sets the expectation that a bump is a bump rather
// than a sign the club has lost their payment. "Report an issue" opens the note
// form, which arrives with the page it was sent from. No personal phone number:
// these pages are shared on WhatsApp, and a public page is not the place for one.
export const REPORT_ISSUE_EVENT = "nextgen:report-issue";

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
      This app is in active development.{" "}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(REPORT_ISSUE_EVENT))}
        className={
          "font-semibold underline underline-offset-4 " +
          (dark ? "text-[#FFC24B]" : "text-amber-900")
        }
      >
        Report an issue
      </button>
    </p>
  );
}
