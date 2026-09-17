-- Registration, consent and the two-tier boundary.
--
-- Three things this adds:
--
--   1. A status on the parent↔swimmer link. Until now a link meant "approved",
--      because the only way to get one was to be imported from the Machakos
--      registration. Once parents can claim children themselves, a claim has to
--      start unproven: an unapproved claim must grant no access to named data.
--
--   2. A consent record per guardian, versioned. Consent that cannot be
--      evidenced — which version, accepted when, by which account — is not
--      consent. Withdrawal is recorded rather than deleted, so the history of
--      what was permitted when survives.
--
--   3. A queue for children who are not on the roster at all, so a parent can
--      say "my child swims here" without being able to create an athlete.
--
-- The existing 24 links are grandfathered to 'approved' — they came from the
-- registration itself, so the club already knew those families. Their CONSENT,
-- though, was never captured, so they have no row in consents and will be sent
-- through the new flow on their next sign-in.

begin;

-- ── 1. claims have a status ────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'claim_status') then
    create type claim_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

alter table public.swimmer_parents
  add column if not exists status       claim_status not null default 'approved',
  add column if not exists claimed_at   timestamptz  not null default now(),
  add column if not exists decided_at   timestamptz,
  add column if not exists decided_by   text,
  add column if not exists decided_note text;

-- Anything already here predates self-service and is trusted.
update public.swimmer_parents set status = 'approved' where status is null;

-- New claims should arrive pending; the default above only exists to keep the
-- grandfathered rows valid. The API passes status explicitly.
create index if not exists swimmer_parents_status_idx
  on public.swimmer_parents (status) where status <> 'approved';

-- An athlete belongs to one family. Two approved guardians is a household;
-- a third, or a guardian from another family, is a conflict for an admin.
-- (The two-adult cap is enforced by swimmer_parents_one_per_slot.)

-- ── 2. consent, versioned and evidenced ───────────────────────────────────
create table if not exists public.consents (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid not null references public.parents(id) on delete cascade,
  version      text not null,
  document     text not null default 'guardian_data_consent',
  accepted_at  timestamptz not null default now(),
  withdrawn_at timestamptz,
  ip_hash      text,
  user_agent   text
);

create index if not exists consents_parent_idx on public.consents (parent_id);

-- One live acceptance per document version per guardian. Re-accepting after a
-- withdrawal is a new row, so the sequence of events stays readable.
create unique index if not exists consents_live_key
  on public.consents (parent_id, document, version)
  where withdrawn_at is null;

-- ── 3. children who are not on the roster ─────────────────────────────────
create table if not exists public.athlete_claim_requests (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid not null references public.parents(id) on delete cascade,
  child_name   text not null,
  child_age    integer,
  note         text,
  status       claim_status not null default 'pending',
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   text,
  swimmer_id   uuid references public.swimmers(id) on delete set null
);

create index if not exists acr_status_idx
  on public.athlete_claim_requests (status) where status = 'pending';

-- ── 4. profile completion ─────────────────────────────────────────────────
-- Registration collects more than the Machakos form did, and the club needs to
-- know who has been through the new flow.
alter table public.parents
  add column if not exists relationship     text,
  add column if not exists profile_complete boolean not null default false,
  add column if not exists invited_by       uuid references public.parents(id) on delete set null,
  add column if not exists club_visibility  boolean not null default true;

comment on column public.parents.club_visibility is
  'Guardian has NOT asked to be kept out of the club-wide view. Setting this
   false hides their children from other families while leaving the club
   aggregates intact — the right to object, under the Data Protection Act.';

-- ── 5. who looked at an assessment ────────────────────────────────────────
-- Tier 2 is the club''s own judgement about a child. Reading one is recorded, so
-- "who has seen my child''s assessment" is an answerable question.
create table if not exists public.assessment_views (
  id            bigserial primary key,
  viewer_email  text not null,
  analytics_name text not null,
  viewed_at     timestamptz not null default now()
);

create index if not exists assessment_views_name_idx
  on public.assessment_views (analytics_name, viewed_at desc);

commit;
