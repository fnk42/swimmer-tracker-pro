-- Invited testers: people who look at the analytics before parents do.
--
-- Deliberately not parents. A tester has no child, claims nothing, and must
-- never touch the Events side — so they get their own table and their own
-- scope rather than a flag on `parents`, where one forgotten check would put
-- them inside a family's registration.
--
-- What earns access is the signed agreement, not the registration. Registering
-- only creates the row; `agreed_at` is what viewer() looks for, so somebody who
-- signs up and never reads the agreement sees nothing.
create table if not exists public.testers (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  full_name      text not null default '',
  -- Free text, optional: "coach at another club", "parent at Kisumu Aquatics".
  -- Context for the coordinator, never used for access.
  how_known      text not null default '',
  agreed_at      timestamptz,
  agreed_version text,
  -- The preview is over on this date whatever anybody remembers agreeing to.
  -- "Until it is rolled out publicly" is a promise nobody enforces; a date is.
  expires_at     timestamptz not null default timestamptz '2026-09-30 23:59:59+03',
  revoked_at     timestamptz,
  revoked_by     text,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz
);
create unique index if not exists testers_email_uniq on public.testers(lower(email));

-- The shared board. Separate from item_comments and page_notes, which are the
-- coordinators' own roadmap: testers should not be reading Boit's working
-- notes, and he should not have to wade through theirs.
--
-- Everyone testing sees every item, with names. That is the point — it stops
-- five people filing the same bug, and a name against a comment keeps it civil.
create table if not exists public.tester_feedback (
  id         uuid primary key default gen_random_uuid(),
  tester_id  uuid references public.testers(id) on delete set null,
  -- Kept alongside tester_id so an item survives a tester being removed: the
  -- club still needs the bug report after the preview ends.
  author     text not null default '',
  kind       text not null default 'broken'
             check (kind in ('broken','confusing','idea')),
  body       text not null,
  -- Where they were and what they had filtered, captured by the page.
  route      text not null default '',
  context    text not null default '',
  status     text not null default 'open'
             check (status in ('open','seen','fixed','wontfix')),
  reply      text,
  replied_by text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists tester_feedback_created_idx
  on public.tester_feedback(created_at desc);

-- "Me too", so a coordinator can tell one person's itch from everyone's.
create table if not exists public.tester_feedback_agrees (
  feedback_id uuid not null references public.tester_feedback(id) on delete cascade,
  tester_id   uuid not null references public.testers(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (feedback_id, tester_id)
);
