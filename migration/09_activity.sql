-- Who is getting in, and who is not.
--
-- There was no record of a sign-in anywhere, so "are parents actually
-- reaching the Machakos entry?" could only be answered by asking them. This
-- is the answer: one row per event in the sign-in and registration path.
--
-- WHAT IT DELIBERATELY DOES NOT HOLD. No page views, no IP addresses, no user
-- agents, no third party. This is an operational log for the club's own
-- coordinators, not analytics, and it is the only kind of tracking that needs
-- no change to what parents have consented to.
--
-- Email is stored because that is the only handle a visitor has before they
-- have an account, and because a coordinator's whole job here is to ring the
-- person who could not get in. It is the same address the club already holds.

create table if not exists public.activity (
  id         bigserial primary key,
  kind       text not null,
  email      text,                          -- lower-cased; null for anonymous events
  parent_id  uuid references public.parents(id) on delete set null,
  detail     text,
  ok         boolean not null default true, -- false = the attempt failed
  created_at timestamptz not null default now()
);

-- The panel reads the newest first, and counts by kind and day.
create index if not exists activity_recent_idx on public.activity (created_at desc);
create index if not exists activity_kind_idx   on public.activity (kind, created_at desc);
create index if not exists activity_email_idx  on public.activity (lower(email), created_at desc);

-- Nothing here is worth keeping for ever. A coordinator wants this week.
-- Deleting on read would be surprising, so it is left to a periodic sweep:
--   delete from public.activity where created_at < now() - interval '180 days';
