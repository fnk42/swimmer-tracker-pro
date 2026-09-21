-- Correcting a swimmer's details by hand.
--
-- Everything the archive knows about a swimmer is derived from meet exports:
-- the name the organisers typed, and a birth date taken from the export's own
-- field where it has one, or decoded from the six digits at the front of the
-- athlete ID where it does not. Neither is reliable on its own.
--
--   19 current swimmers have no usable date at all — a PDF-only meet carries
--      no athlete ID, so nothing can be inferred.
--   97 rest on the athlete ID, which was wrong for 3 of the 288 swimmers in
--      the first export to carry both, and wrong on the day for others
--      (Bengi Allan's ID reads day 02; his birthday is the 21st).
--    1 is in open dispute: Salah, Ahmed has two dates two years apart and his
--      recorded age jumps two years between consecutive meets.
--
-- A birth date decides which age band a swimmer is judged in, so a wrong one
-- moves their whole assessment. This table is where the club fixes that.
--
-- Append-only, like roster_decisions. Correcting a correction leaves both
-- rows, because who changed what and when is the record.

create table if not exists public.swimmer_details (
  id          uuid primary key default gen_random_uuid(),
  swimmer     text not null,                      -- analytics name, as in roster.csv
  dob         date,                               -- null means "no longer asserting one"
  sex         text check (sex is null or sex in ('F','M')),
  note        text,
  edited_by   text not null,
  created_at  timestamptz not null default now()
);

create index if not exists swimmer_details_swimmer_idx
  on public.swimmer_details (swimmer, created_at desc);

-- One row per swimmer: their latest edit only.
create or replace view public.swimmer_details_current as
  select distinct on (swimmer) swimmer, dob, sex, note, edited_by, created_at
    from public.swimmer_details
   order by swimmer, created_at desc;
