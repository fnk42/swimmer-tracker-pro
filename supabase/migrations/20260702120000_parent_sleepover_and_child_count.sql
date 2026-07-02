-- Change 2: rename the child sleepover column to a parent sleepover column
-- with three possible values (Yes / No / Yet to decide).
--
-- Change 1: allow a single payment row to cover multiple swimmers. `child_count`
-- records how many swimmers the payment covers; `swimmer_ids` (jsonb array)
-- records which swimmers were covered so admin can attribute amount / child_count
-- to each of them. No junction table.

-- --- registrations: parent_sleepover ---------------------------------------
alter table public.registrations
  drop constraint if exists registrations_sleepover_check;

alter table public.registrations
  rename column sleepover to parent_sleepover;

alter table public.registrations
  alter column parent_sleepover type text using parent_sleepover::text;

alter table public.registrations
  add constraint registrations_parent_sleepover_check
  check (parent_sleepover in ('Yes', 'No', 'Yet to decide'));

-- --- payments: child_count + swimmer_ids -----------------------------------
alter table public.payments
  add column if not exists child_count int not null default 1;

alter table public.payments
  add constraint payments_child_count_check check (child_count >= 1);

alter table public.payments
  add column if not exists swimmer_ids jsonb;

-- Backfill swimmer_ids for existing rows so admin status queries are consistent.
update public.payments
  set swimmer_ids = jsonb_build_array(swimmer_id)
  where swimmer_ids is null;

alter table public.payments
  alter column swimmer_ids set not null;

alter table public.payments
  alter column swimmer_ids set default '[]'::jsonb;
