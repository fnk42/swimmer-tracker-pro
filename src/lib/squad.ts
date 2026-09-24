// Who is in the Machakos team, as one sentence of SQL.
//
// This rule lived in three routes: the roster, the claim search and the
// session. Three copies of a rule are three chances for one to drift, and this
// one decides whether a family sees the Events tab at all — so a swimmer could
// be in the team according to one route and not according to another, and the
// symptom would be a parent who can search for their child but cannot enter
// them.
//
// "In the team" is not only the flag. A swimmer with an entry form already
// filled in is in it too, because the club has been taking entries since
// before the flag existed and those families must not be locked out of the
// page they already used.
export function inSquadSql(alias = ""): string {
  const p = alias ? `${alias}.` : "";
  return `(${p}event_squad or ${p}id in (select swimmer_id from public.registrations))`;
}
