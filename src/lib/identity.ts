// SERVER ONLY. Who a parent is, which is their phone number.
//
// An email address only carries the sign-in code. People have several, use
// whichever is to hand, and mistype them; none of that makes them a different
// parent. Their number does not move around like that, so it is the identity,
// and every address they sign in with points at one record.
//
// The practical consequence is that "is this the child's second adult or the
// first one making a mistake?" has an answer: two adults on a swimmer must be
// two different numbers.
import { one, q, tx } from "@/lib/db";
import { canonicalPhone } from "@/lib/phone";
import { newCode, hashCode } from "@/lib/session";
import { sendLoginCode } from "@/lib/mailer";
import { note } from "@/lib/activity";

export type AdoptResult =
  | { ok: true; parentId: string; merged: boolean; phone: string }
  | { ok: false; error: string; needsProof?: boolean };

const PROOF_TTL_MIN = 10;
const PROOF_MAX_ATTEMPTS = 5;
const PROOF_MAX_SENT = 3; // per 15 minutes, as for a sign-in code

/** "j•••@gmail.com" — enough to recognise your own address, not to learn one. */
function mask(email: string): string {
  const [user, domain] = email.split("@");
  return `${(user || "?")[0]}•••@${domain ?? ""}`;
}

/**
 * Attach a phone number to this account, folding the account into whichever
 * one already owns that number.
 *
 * Signing in with a second address opens a second, empty account — there is no
 * way to know at the door that it is the same person. The number is what says
 * so, and this is the moment it is given, so this is where the two are made
 * one. The older record survives, because it is the one the club's own records
 * and everybody's links were built against.
 *
 * Returns the id the caller should carry from now on: unchanged normally, the
 * surviving one after a fold. Callers holding a session must re-issue it when
 * `merged` is true, or they will be pointing at a row that no longer exists.
 */
export async function adoptPhone(
  parentId: string,
  rawPhone: string,
  // Who is asking, and the code they were sent if this number turned out to
  // belong to somebody else's account. See the proof step below.
  who: { email: string; proof?: string },
): Promise<AdoptResult> {
  const phone = canonicalPhone(rawPhone);
  if (!phone) {
    return { ok: false, error: "Enter a phone number we can reach you on" };
  }

  const owner = await one<{ id: string }>(
    `select id from public.parents where phone = $1 and id <> $2`,
    [phone, parentId],
  );

  if (!owner) {
    await q(`update public.parents set phone = $2, updated_at = now() where id = $1`,
      [parentId, phone]);
    return { ok: true, parentId, merged: false, phone };
  }

  // The number is already somebody's. Folding into that account hands it
  // every address this one signs in with, so typing a number is not enough
  // to do it — anybody can type a number. Prove you can read that account's
  // email first (Felix, 27 Sep 2026).
  //
  // Signed in with one of its own addresses already proves it: that is the
  // club's imported parent arriving for the first time, and the common case.
  const ownerEmails = (
    await q<{ email: string }>(
      `select lower(email) as email from public.parent_emails where parent_id = $1
       union
       select lower(email) from public.parents where id = $1 and coalesce(email,'') <> ''`,
      [owner.id],
    )
  ).map((r) => r.email);
  const asker = who.email.trim().toLowerCase();

  if (!ownerEmails.includes(asker)) {
    // Where the proof goes: the account's own address, never one we were
    // given just now.
    const target =
      (await one<{ email: string }>(
        `select lower(email) as email from public.parents where id = $1 and coalesce(email,'') <> ''`,
        [owner.id],
      ))?.email ?? ownerEmails[0];
    if (!target) {
      return {
        ok: false,
        error:
          "That number is already on a NextGen account we cannot reach by email. " +
          "Message Felix or Boit and we will join the two for you.",
      };
    }

    const proof = (who.proof ?? "").trim();
    if (!proof) {
      const recent = await one<{ n: number }>(
        `select count(*)::int n from public.auth_codes
          where lower(email) = $1 and created_at > now() - interval '15 minutes'`,
        [target],
      );
      if ((recent?.n ?? 0) < PROOF_MAX_SENT) {
        const code = newCode();
        await q(
          `insert into public.auth_codes (email, code_hash, expires_at)
           values ($1, $2, now() + interval '${PROOF_TTL_MIN} minutes')`,
          [target, hashCode(target, code)],
        );
        const sent = await sendLoginCode(target, code);
        if (!sent.delivered) console.error(`[identity] proof code for ${target} NOT delivered`);
      }
      await note("code_requested", {
        email: target,
        parentId: owner.id,
        detail: `to confirm ${asker} may join this account by its number`,
      });
      return {
        ok: false,
        needsProof: true,
        error:
          `That number is already on a NextGen account. We have sent a code to ` +
          `${mask(target)} — enter it to show it is yours and join that account.`,
      };
    }

    const row = await one<{ id: string }>(
      `select id from public.auth_codes
        where lower(email) = $1 and code_hash = $2
          and consumed_at is null and expires_at > now() and attempts < $3
        order by created_at desc limit 1`,
      [target, hashCode(target, proof), PROOF_MAX_ATTEMPTS],
    );
    if (!row) {
      await q(
        `update public.auth_codes set attempts = attempts + 1
          where id = (select id from public.auth_codes
                       where lower(email) = $1 and consumed_at is null and expires_at > now()
                       order by created_at desc limit 1)`,
        [target],
      );
      return {
        ok: false,
        needsProof: true,
        error: `That code is wrong or has expired. Check the email to ${mask(target)}.`,
      };
    }
    await q(`update public.auth_codes set consumed_at = now() where id = $1`, [row.id]);
  }

  const keep = owner.id;
  await tx(async (c) => {
    // Every address this account signed in with now reaches the survivor.
    await c.query(
      `update public.parent_emails set parent_id = $2 where parent_id = $1`,
      [parentId, keep],
    );
    await c.query(
      `update public.parents set email = coalesce(nullif(email,''), (
          select email from public.parent_emails where parent_id = $1 limit 1))
        where id = $1`,
      [keep],
    );

    // Links and consents move unless the survivor already has them; a
    // duplicate would trip the unique index rather than merge quietly.
    await c.query(
      `update public.swimmer_parents sp set parent_id = $2
        where sp.parent_id = $1
          and not exists (select 1 from public.swimmer_parents x
                           where x.swimmer_id = sp.swimmer_id and x.parent_id = $2)`,
      [parentId, keep],
    );
    await c.query(`delete from public.swimmer_parents where parent_id = $1`, [parentId]);

    await c.query(
      `update public.consents co set parent_id = $2
        where co.parent_id = $1
          and not exists (select 1 from public.consents x
                           where x.parent_id = $2 and x.document = co.document
                             and x.version = co.version and x.withdrawn_at is null)`,
      [parentId, keep],
    );
    await c.query(`delete from public.consents where parent_id = $1`, [parentId]);

    await c.query(`update public.activity set parent_id = $2 where parent_id = $1`,
      [parentId, keep]);
    await c.query(`delete from public.parents where id = $1`, [parentId]);
  });

  return { ok: true, parentId: keep, merged: true, phone };
}

/**
 * The numbers of the adults already on this swimmer, other than this parent.
 *
 * A blank number is left out: an account that has not given one yet cannot be
 * shown to be a different person, and the caller treats that as unknown rather
 * than as a match.
 */
export async function otherAdultPhones(
  swimmerId: string,
  exceptParentId: string,
): Promise<string[]> {
  const rows = await q<{ phone: string }>(
    `select p.phone
       from public.swimmer_parents sp
       join public.parents p on p.id = sp.parent_id
      where sp.swimmer_id = $1 and sp.parent_id <> $2 and p.phone <> ''`,
    [swimmerId, exceptParentId],
  );
  return rows.map((r) => r.phone);
}
