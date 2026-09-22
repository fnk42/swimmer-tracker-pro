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
import { normalizeKePhone } from "@/lib/phone";

export type AdoptResult =
  | { ok: true; parentId: string; merged: boolean; phone: string }
  | { ok: false; error: string };

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
export async function adoptPhone(parentId: string, rawPhone: string): Promise<AdoptResult> {
  const phone = normalizeKePhone(rawPhone);
  if (!phone) {
    return { ok: false, error: "Enter a Kenyan mobile number, like 0712 345 678" };
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
