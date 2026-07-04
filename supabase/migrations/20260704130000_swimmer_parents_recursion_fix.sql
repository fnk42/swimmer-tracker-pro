-- Fix infinite recursion (Postgres error 42P17) in swimmer_parents_auth_insert.
--
-- The previous version of the policy had:
--
--   not exists (
--     select 1 from public.swimmer_parents existing
--     where existing.swimmer_id = swimmer_parents.swimmer_id
--   )
--
-- inside its WITH CHECK. The subquery reads swimmer_parents while a policy on
-- swimmer_parents is being evaluated — Postgres 15+ conservatively rejects
-- the self-reference as recursive even though the referenced SELECT policy
-- chain does actually terminate. Result: EVERY authenticated insert into
-- swimmer_parents failed, including legitimate first-time claims. Confirmed
-- live with a signed-in parent whose parents row is correctly owned.
--
-- Fix: extract the "is this swimmer already claimed by a different Google
-- identity?" check into a SECURITY DEFINER helper. The function runs as its
-- owner (in Supabase, that's supabase_admin — BYPASSRLS), so its inner query
-- reads the underlying tables directly without invoking swimmer_parents's
-- own SELECT policy. Recursion detector is not tripped.
--
-- Semantics of "claimed":
--   * A swimmer_parents row exists for the target swimmer,
--   * AND that row's parent has user_id IS NOT NULL,
--   * AND that user_id != auth.uid().
--
-- Rows attached to admin-created placeholder parents (parents.user_id IS NULL)
-- do NOT count as "claimed" — a Google-signed-in parent can still link that
-- swimmer to their own parents row. The swimmer ends up with two
-- swimmer_parents rows; the admin path can reconcile via the anon-key flow.
--
-- Rows attached to the caller's own parents row (parents.user_id = auth.uid())
-- also don't block themselves — useLinkMyParent handles idempotency
-- client-side by short-circuiting on a match, but the policy is deliberately
-- friendly here so a race or a second save doesn't get rejected.
--
-- Audit note: no other RLS policy on parents / swimmer_parents / registrations
-- / payments references its own table in a subquery. This is the only
-- recursion site.

-- --- drop the broken policy first ---------------------------------------

drop policy if exists swimmer_parents_auth_insert on public.swimmer_parents;

-- --- SECURITY DEFINER helper -------------------------------------------

create or replace function public.swimmer_is_claimed(swimmer uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.swimmer_parents sp
    join public.parents p on p.id = sp.parent_id
    where sp.swimmer_id = swimmer
      and p.user_id is not null
      and p.user_id <> auth.uid()
  );
$$;

comment on function public.swimmer_is_claimed(uuid) is
  'Returns true if the given swimmer is already linked to a Google-identified '
  'parent OTHER than the caller. Runs SECURITY DEFINER so the underlying '
  'read bypasses swimmer_parents''s RLS (which would otherwise trigger '
  'Postgres''s recursion detector when called from swimmer_parents_auth_insert).';

-- Function bypasses RLS via SECURITY DEFINER + owner privileges. Lock down
-- direct execution so only the intended callers can invoke it.
revoke execute on function public.swimmer_is_claimed(uuid) from public;
grant execute on function public.swimmer_is_claimed(uuid) to authenticated;
-- Anon doesn't need it: the swimmer_parents_anon_all policy grants
-- unconditional access on the coordinator/admin path, which never
-- evaluates the authenticated policy tree.

-- --- rebuild the authenticated INSERT policy ---------------------------

create policy swimmer_parents_auth_insert on public.swimmer_parents
  for insert
  to authenticated
  with check (
    parent_id in (
      select id from public.parents where user_id = auth.uid()
    )
    and not public.swimmer_is_claimed(swimmer_id)
  );
