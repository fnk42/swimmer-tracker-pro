-- Any phone number, not only a Kenyan mobile.
--
-- The rule insisted on 254XXXXXXXXX, which is right for a Safaricom line and
-- wrong for a grandparent on a landline, a parent abroad, or anybody who types
-- their number in a way the regex did not anticipate. Registration is not the
-- place to argue with somebody about their own phone number: take it, store
-- it, let a coordinator sort out anything odd.
--
-- Still not blank. The club has to be able to reach a parent, and '' is what
-- an account carries before its owner has filled anything in.
alter table public.parents drop constraint if exists parents_phone_check;
alter table public.parents add constraint parents_phone_check
  check (phone = '' or length(btrim(phone)) >= 7);
