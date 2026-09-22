import { q } from "@/lib/db";

// Recording what happens on the way in.
//
// The one rule: THIS MUST NEVER BREAK A SIGN-IN. A log that can stop a parent
// entering their child is worse than no log, so every call swallows its own
// errors and is awaited only where the caller is already awaiting the
// database. If the table is missing or the write fails, the sign-in proceeds
// and the failure goes to the server log.

export type Kind =
  | "code_requested"      // a visitor asked for a sign-in code
  | "code_undelivered"    // the email did not send — the one to act on
  | "code_wrong"          // a code was entered and rejected
  | "signed_in"           // a session was created
  | "registration_done"   // a parent finished the registration form
  | "consent_given"       // a guardian accepted the current consent document
  | "swimmer_claimed"     // a parent put a child on their account
  | "swimmer_unlinked";   // a parent took a child back off their own account

export async function note(
  kind: Kind,
  opts: { email?: string | null; parentId?: string | null; detail?: string; ok?: boolean } = {},
): Promise<void> {
  try {
    await q(
      `insert into public.activity (kind, email, parent_id, detail, ok)
       values ($1, $2, $3::uuid, $4, $5)`,
      [
        kind,
        opts.email ? opts.email.trim().toLowerCase() : null,
        opts.parentId ?? null,
        opts.detail ?? null,
        opts.ok !== false,
      ],
    );
  } catch (err) {
    // Deliberately swallowed. See the note above.
    console.error(`[activity] could not record ${kind}:`, err);
  }
}
