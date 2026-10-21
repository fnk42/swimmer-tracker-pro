-- Coaches' assessments of a child: what was filmed, what is going well, what to
-- work on (Felix, 21 Oct 2026).
--
-- Keyed by the analytics name, the same key the swimmer cards and the guardian
-- links use. The body is the form as the coach filled it (item ids from
-- src/lib/assessment-template.ts with good / work marks), not finished prose:
-- the report is written from the template when it is read, so improving a
-- sentence improves every report already on file.
--
-- A draft is seen by coaches and admins only. Shared, it is also seen by that
-- child's own parents, which is what the data protection notice promises.
create table if not exists public.coach_assessments (
  id uuid primary key default gen_random_uuid(),
  analytics_name text not null,
  area text not null,
  filmed_on date not null,
  body jsonb not null,
  shared boolean not null default false,
  coach_email text not null,
  coach_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_assessments_child
  on public.coach_assessments (analytics_name, filmed_on desc);

-- Server-side only, like the rest of the tables the app reads with its own
-- connection: no row is reachable through the public API.
alter table public.coach_assessments enable row level security;
