-- The approval step is gone: a parent's claim takes effect when they make it.
--
-- The control is now the two-adult cap (api/me/link, plus the unique index from
-- 04_two_parents.sql), and a coordinator unlinking anyone who should not be
-- there. Holding every claim for a human meant a parent who had done everything
-- right still could not see their own child until somebody happened to look,
-- which on a registration weekend is indistinguishable from being locked out.
--
-- Claims already waiting under the old rule are honoured rather than left in a
-- state nothing will ever clear — they were made by parents who had no way of
-- knowing a human was meant to look at them. Stamped so the record still says
-- these were never actually read by a coordinator.
--
-- Safe against the cap: this only promotes rows that already exist, and
-- 04_two_parents.sql's unique index already refuses a third adult.
update public.swimmer_parents
   set status = 'approved',
       decided_at = now(),
       decided_note = 'auto-approved 2026-09-22 when the approval step was removed'
 where status = 'pending';
