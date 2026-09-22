-- Let an account exist before its owner has told us anything.
--
-- Sign-in used to be refused unless the address was already in `parents`, so
-- every row arrived complete, and `phone` could insist on a real Kenyan number.
-- Now any address can sign in and the account is opened at that moment, before
-- the parent has typed a name or a number — so the empty string has to be a
-- legal "not given yet".
--
-- The format rule is unchanged for every value that is actually a number, and
-- viewer() reads an empty phone as needsProfile, which is what sends the parent
-- to /welcome to fill it in. Nothing can leave that form with a blank number.
--
-- Strictly weaker than the constraint it replaces: every row that satisfied the
-- old rule satisfies this one, so it cannot fail on existing data.
alter table public.parents drop constraint if exists parents_phone_check;
alter table public.parents add constraint parents_phone_check
  check (phone = '' or phone ~ '^254[0-9]{9}$');
