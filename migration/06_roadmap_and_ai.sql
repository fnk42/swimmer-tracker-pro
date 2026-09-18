-- Roadmap, comments, page notes, and the guardian's choice about the
-- coaching assistant.
--
-- The assistant is the first thing that sends a child's data outside NextGen,
-- so the consent document changed and every guardian re-accepts. That gate is
-- version-based and already exists. What is new here is a per-guardian opt-out:
-- a parent can agree to everything else and still keep their child out of
-- anything the assistant is asked.
--
-- Eligibility is deliberately strict. A child is sent to the assistant only
-- when every approved guardian has accepted the current version AND none has
-- opted out. A child with no guardian at all is never sent — which today is
-- most of them, and is the point: the re-consent drive is what opens it up.

begin;

-- ── 1. the assistant opt-out ───────────────────────────────────────────────
alter table public.consents
  add column if not exists ai_opt_out boolean not null default false;

comment on column public.consents.ai_opt_out is
  'Guardian agreed to the document but excluded this child from the coaching '
  'assistant. Their data is never sent to a third-party model.';

-- ── 2. the roadmap ─────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'roadmap_status') then
    create type roadmap_status as enum ('idea', 'planned', 'building', 'shipped', 'parked');
  end if;
end $$;

create table if not exists public.roadmap_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  detail      text,
  status      roadmap_status not null default 'idea',
  -- Who asked for it. Boit raises most of these and should see his name on them.
  raised_by   text,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  shipped_at  timestamptz,
  -- Provenance for anything claiming to be shipped: a real commit, so the
  -- board cannot drift from what is actually deployed.
  commit_sha  text,
  sort_order  integer not null default 0
);

create index if not exists roadmap_status_idx on public.roadmap_items (status, sort_order);

create table if not exists public.item_comments (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.roadmap_items(id) on delete cascade,
  author     text not null,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists item_comments_item_idx on public.item_comments (item_id, created_at);

-- ── 3. notes left while using the app ──────────────────────────────────────
-- A note carries the page it was written on. "The filter is confusing" is
-- worth very little; the same words with /tracker#/swimmers attached are
-- actionable.
create table if not exists public.page_notes (
  id         uuid primary key default gen_random_uuid(),
  route      text not null,
  body       text not null,
  author     text not null,
  is_coach   boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  item_id    uuid references public.roadmap_items(id) on delete set null
);

create index if not exists page_notes_open_idx on public.page_notes (resolved_at, created_at desc);

commit;
