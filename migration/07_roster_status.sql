-- Reinstating a swimmer the twelve-month rule has made dormant.
--
-- The rule lives in the pipeline (tools/roster.py) and is deliberately
-- mechanical: no NextGen race in twelve months and a swimmer stops counting
-- toward club figures. It is right far more often than it is wrong, but it
-- cannot know that a child was injured, sat a year of exams, or swam at a meet
-- whose results have not been collected yet.
--
-- This table is where the club overrules it. A row here is a decision by a
-- named coordinator, with the reason they gave, and tools/pull_reinstatements
-- writes it into data/roster_overrides.csv, which already wins over the rule.
--
-- Nothing is deleted. Reinstating and then re-archiving a swimmer leaves two
-- rows, because who decided what and when is the point of keeping it.

create table if not exists public.roster_decisions (
  id          uuid primary key default gen_random_uuid(),
  swimmer     text not null,                      -- analytics name, as in roster.csv
  decision    text not null check (decision in ('active', 'dormant')),
  reason      text,
  decided_by  text not null,
  created_at  timestamptz not null default now()
);

create index if not exists roster_decisions_swimmer_idx
  on public.roster_decisions (swimmer, created_at desc);

-- The view the app reads: one row per swimmer, their latest decision only.
create or replace view public.roster_decision_current as
  select distinct on (swimmer) swimmer, decision, reason, decided_by, created_at
    from public.roster_decisions
   order by swimmer, created_at desc;
