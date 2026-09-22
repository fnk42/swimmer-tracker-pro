-- The phone number identifies a parent. The email only carries the code.
--
-- A parent may have two or three email addresses and use whichever one is to
-- hand; that is not three parents. Their number is the thing that is actually
-- theirs, so it becomes the identity, and every address they sign in with
-- points at the same record.
--
-- This also makes the second adult on a child possible again without it being
-- a hole: mum and dad may both hold a swimmer, and what distinguishes them —
-- what proves the second is a different person rather than the first making a
-- mistake — is that the numbers differ.

-- 1. Emails, many per parent. The primary address stays on parents.email for
--    display; this is what sign-in resolves against.
create table if not exists public.parent_emails (
  email     text primary key,
  parent_id uuid not null references public.parents(id) on delete cascade,
  added_at  timestamptz not null default now()
);
create index if not exists parent_emails_parent_idx on public.parent_emails(parent_id);

insert into public.parent_emails (email, parent_id)
select lower(email), id from public.parents where email is not null
on conflict (email) do nothing;

-- 2. Fold parents who are plainly the same person: same number, more than one
--    row. The oldest row wins, because it is the one the club's own records
--    were built against. Links and consents move; a link that would duplicate
--    one the survivor already has is dropped rather than collided.
create temporary table dupes on commit drop as
select p.id as loser, k.keeper
  from public.parents p
  join (
    select phone, min(created_at) as first_seen,
           (array_agg(id order by created_at))[1] as keeper
      from public.parents
     where phone <> ''
     group by phone
    having count(*) > 1
  ) k on k.phone = p.phone
 where p.id <> k.keeper;

update public.parent_emails pe set parent_id = d.keeper
  from dupes d where pe.parent_id = d.loser;

update public.swimmer_parents sp set parent_id = d.keeper
  from dupes d
 where sp.parent_id = d.loser
   and not exists (select 1 from public.swimmer_parents x
                    where x.swimmer_id = sp.swimmer_id and x.parent_id = d.keeper);
delete from public.swimmer_parents sp using dupes d where sp.parent_id = d.loser;

update public.consents co set parent_id = d.keeper
  from dupes d
 where co.parent_id = d.loser
   and not exists (select 1 from public.consents x
                    where x.parent_id = d.keeper and x.document = co.document
                      and x.version = co.version and x.withdrawn_at is null);
delete from public.consents co using dupes d where co.parent_id = d.loser;

update public.activity a set parent_id = d.keeper from dupes d where a.parent_id = d.loser;

delete from public.parents p using dupes d where p.id = d.loser;

-- 3. One number, one parent. Blank is exempt: an account exists from the
--    moment someone signs in, before they have given a number.
create unique index if not exists parents_phone_uniq
  on public.parents(phone) where phone <> '';
