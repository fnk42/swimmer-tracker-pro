-- An item posted by an admin rather than a tester.
--
-- The board is read by everyone testing, so a post from the club has to be
-- distinguishable from one tester telling the others something. The name alone
-- does not do it: a tester has no way to know which of the names on the board
-- belongs to whoever builds the thing.
--
-- Kept as its own column rather than inferred from a null tester_id, because
-- tester_id also goes null when a tester's account is removed — and a bug
-- report outliving its author must not start claiming it came from the club.
alter table public.tester_feedback
  add column if not exists from_club boolean not null default false;
