-- Parent-side Google Sign-In (Supabase Auth). Adds the columns / indexes the
-- OAuth flow needs on the parents table, then enables RLS on the four tables
-- that hold parent-owned data and installs matching policies.
--
-- Two-role model:
--   * anon           — used by the TanStack API routes for the admin path
--                       (admin login stays on localStorage/ng_role). Full access.
--   * authenticated  — a Google-signed-in parent, calling Supabase directly
--                       from the browser with their JWT. Scoped to their own
--                       parents.user_id (chained through swimmer_parents).
--
-- The partial unique index on parents.user_id prevents a signed-in attacker
-- from walking the phone list and claiming multiple unclaimed rows.
-- The `authenticated update` policy on parents lets a signed-in user claim
-- an unlinked row exactly once (unique index enforces "exactly once").

-- --- schema ---------------------------------------------------------------

alter table public.parents
  add column if not exists email text;

create index if not exists parents_email_idx on public.parents (email);

create unique index if not exists parents_user_id_uniq
  on public.parents (user_id)
  where user_id is not null;

-- --- enable RLS ----------------------------------------------------------

alter table public.parents          enable row level security;
alter table public.swimmer_parents  enable row level security;
alter table public.registrations    enable row level security;
alter table public.payments         enable row level security;

-- Public/browsable tables intentionally NOT locked down:
--   * swimmers (parents must browse the roster to pick their kids)

-- --- parents policies ----------------------------------------------------

drop policy if exists parents_anon_all       on public.parents;
drop policy if exists parents_auth_select    on public.parents;
drop policy if exists parents_auth_insert    on public.parents;
drop policy if exists parents_auth_update    on public.parents;

create policy parents_anon_all on public.parents
  for all
  to anon
  using (true)
  with check (true);

create policy parents_auth_select on public.parents
  for select
  to authenticated
  using (user_id = auth.uid());

create policy parents_auth_insert on public.parents
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Allow a signed-in user to (a) update their own row or (b) claim an
-- unclaimed row by setting user_id = themselves. Combined with the partial
-- unique index above, they can only ever hold one row.
create policy parents_auth_update on public.parents
  for update
  to authenticated
  using (user_id = auth.uid() or user_id is null)
  with check (user_id = auth.uid());

-- No authenticated delete — parents cannot delete rows.

-- --- swimmer_parents policies --------------------------------------------

drop policy if exists swimmer_parents_anon_all    on public.swimmer_parents;
drop policy if exists swimmer_parents_auth_select on public.swimmer_parents;
drop policy if exists swimmer_parents_auth_insert on public.swimmer_parents;
drop policy if exists swimmer_parents_auth_delete on public.swimmer_parents;

create policy swimmer_parents_anon_all on public.swimmer_parents
  for all
  to anon
  using (true)
  with check (true);

create policy swimmer_parents_auth_select on public.swimmer_parents
  for select
  to authenticated
  using (
    parent_id in (
      select id from public.parents where user_id = auth.uid()
    )
  );

-- Insert must (a) target one of the caller's own parents rows, AND (b) not
-- claim a swimmer that some other parent has already linked. The second
-- clause is what prevents a Google-signed-in attacker from linking
-- themselves to another parent's kid and reading/modifying that
-- registration or payment.
create policy swimmer_parents_auth_insert on public.swimmer_parents
  for insert
  to authenticated
  with check (
    parent_id in (
      select id from public.parents where user_id = auth.uid()
    )
    and not exists (
      select 1
      from public.swimmer_parents existing
      where existing.swimmer_id = swimmer_parents.swimmer_id
    )
  );

create policy swimmer_parents_auth_delete on public.swimmer_parents
  for delete
  to authenticated
  using (
    parent_id in (
      select id from public.parents where user_id = auth.uid()
    )
  );

-- --- registrations policies ---------------------------------------------

drop policy if exists registrations_anon_all    on public.registrations;
drop policy if exists registrations_auth_select on public.registrations;
drop policy if exists registrations_auth_insert on public.registrations;
drop policy if exists registrations_auth_update on public.registrations;

create policy registrations_anon_all on public.registrations
  for all
  to anon
  using (true)
  with check (true);

create policy registrations_auth_select on public.registrations
  for select
  to authenticated
  using (
    swimmer_id in (
      select sp.swimmer_id
      from public.swimmer_parents sp
      join public.parents p on p.id = sp.parent_id
      where p.user_id = auth.uid()
    )
  );

create policy registrations_auth_insert on public.registrations
  for insert
  to authenticated
  with check (
    swimmer_id in (
      select sp.swimmer_id
      from public.swimmer_parents sp
      join public.parents p on p.id = sp.parent_id
      where p.user_id = auth.uid()
    )
  );

create policy registrations_auth_update on public.registrations
  for update
  to authenticated
  using (
    swimmer_id in (
      select sp.swimmer_id
      from public.swimmer_parents sp
      join public.parents p on p.id = sp.parent_id
      where p.user_id = auth.uid()
    )
  )
  with check (
    swimmer_id in (
      select sp.swimmer_id
      from public.swimmer_parents sp
      join public.parents p on p.id = sp.parent_id
      where p.user_id = auth.uid()
    )
  );

-- --- payments policies ---------------------------------------------------

drop policy if exists payments_anon_all    on public.payments;
drop policy if exists payments_auth_select on public.payments;
drop policy if exists payments_auth_insert on public.payments;

create policy payments_anon_all on public.payments
  for all
  to anon
  using (true)
  with check (true);

-- Payments carry both a primary swimmer_id column and a swimmer_ids jsonb
-- array; the array is always a superset of the parent's own swimmers (a
-- parent only ever pays for their own kids). MVP filters on the single
-- swimmer_id column to keep the policy simple. Revisit if the app ever
-- allows a payment to cover swimmers across multiple owners.
create policy payments_auth_select on public.payments
  for select
  to authenticated
  using (
    swimmer_id in (
      select sp.swimmer_id
      from public.swimmer_parents sp
      join public.parents p on p.id = sp.parent_id
      where p.user_id = auth.uid()
    )
  );

create policy payments_auth_insert on public.payments
  for insert
  to authenticated
  with check (
    swimmer_id in (
      select sp.swimmer_id
      from public.swimmer_parents sp
      join public.parents p on p.id = sp.parent_id
      where p.user_id = auth.uid()
    )
  );
