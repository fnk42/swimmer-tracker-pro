-- Adds the parent/guardian gender captured on the registration form so admin
-- can build headcounts and chaperone-pairing summaries. Kept nullable so
-- pre-existing rows aren't rejected; the app requires it for new writes.

alter table public.registrations
  add column if not exists guardian_gender text;

alter table public.registrations
  add constraint registrations_guardian_gender_check
  check (guardian_gender is null or guardian_gender in ('Male', 'Female'));
