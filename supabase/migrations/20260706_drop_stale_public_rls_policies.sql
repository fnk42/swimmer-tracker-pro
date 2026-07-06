-- Drop stale public/unscoped RLS policies on registrations and payments.
--
-- Diagnosis (2026-07-06): after the parent-A cross-account leak, a
-- pg_policies inspection revealed five permissive policies on these two
-- tables with role=public and using(true) sitting alongside the
-- correctly-scoped authenticated policies from migration 20260704120000.
-- Postgres OR's permissive policies together, so one `using (true)`
-- silently erased every scoped restriction on the same command — hence
-- A's JWT returned every family's registration and payment rows, and the
-- registrations_update policy also opened cross-account writes.
--
-- The correctly-scoped policies remain in place and are NOT touched by
-- this migration:
--   * registrations_auth_select / _auth_insert / _auth_update
--   * payments_auth_select      / _auth_insert
--   * registrations_anon_all    / payments_anon_all   (admin via anon key)
--
-- Post-apply: re-run the isolation test — GET /registrations, GET
-- /payments and PATCH /registrations with parent A's JWT must return only
-- A's own rows / affect zero rows for cross-account writes.

drop policy if exists registrations_select on public.registrations;
drop policy if exists registrations_insert on public.registrations;
drop policy if exists registrations_update on public.registrations;
drop policy if exists payments_select      on public.payments;
drop policy if exists payments_insert      on public.payments;
