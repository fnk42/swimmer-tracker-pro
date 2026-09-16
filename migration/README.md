# Machakos 2026 — migrating off Supabase

Why: the Supabase free tier pauses a project after about a week idle, and the
project has to be un-paused by hand. For a registration portal parents visit
occasionally that is fatal — the first parent after a quiet week meets a broken
site and nobody finds out. Pro (~$25/month) fixes the pausing but is a recurring
cost the club does not want.

Target: **Neon** (free Postgres, auto-resumes on connection — no manual un-pause)
behind the **existing Vercel deployment**. Hosting does not change and does not
cost anything today.

---

## What changes

| | Before | After |
|---|---|---|
| Database | Supabase Postgres | Neon Postgres |
| Browser → database | direct, using a public `anon` key | never — browser talks only to server routes |
| Access control | RLS policies + `auth.uid()` | server routes; the connection string stays on the server |
| Parent identity | Google OAuth via Supabase Auth | email (all 20 parents already have one) |
| Admin gate | `localStorage.ng_role === 'admin'` | signed server-side session cookie |
| Hosting | Vercel | Vercel (unchanged) |

## Why the security model changes, not just the database

The live database grants the **anon** role — whose key ships inside the public
JavaScript bundle — `USING (true)` on four tables:

```
parents_anon_all          SELECT/INSERT/UPDATE/DELETE  all parents
registrations_anon_all    …                            all registrations
payments_anon_all         …                            all payments
swimmer_parents_anon_all  …                            all links
plus: "anon can delete swimmers / registrations / payments"
```

Anyone who opened the site, took the key from the browser's network tab and made
one request could read every parent's phone number and email, every child's
recorded allergies and health conditions, and every payment — or delete them.
The per-parent `authenticated` policies underneath are written correctly; these
`anon` grants sit above and override them in practice.

They exist because the admin side has no real login, so the app needed a key that
could see everything. That is the same root cause as the `localStorage` admin
gate. Moving the database is the natural moment to fix both, and the fix is
simpler than what it replaces: if the browser holds no database key, there is
nothing to abuse.

## Files here

| File | What it is |
|---|---|
| `extract.py` | Regenerates the two SQL files from the Supabase backup |
| `01_schema.sql` | Tables, constraints, indexes — Neon-ready. Safe to commit |
| `02_data.sql` | **129 rows of real personal data. Gitignored. Never commit** |

Regenerate at any time:

```bash
python3 migration/extract.py ~/Downloads/db_cluster-17-08-2026@01-17-33.backup
```

## Data being carried over (as at the 17 Aug backup)

| Table | Rows |
|---|---|
| swimmers | 46 |
| parents | 20 |
| swimmer_parents | 24 |
| registrations | 24 |
| payments | 15 (KES 170,460) |

Last real activity was 4 August, and the backup was taken on 17 August, so the
backup is complete — nothing was lost when the project paused.

## Steps

1. **Create a Neon project** (free). Copy the connection string.
2. `psql <connection-string> -f migration/01_schema.sql`
3. `psql <connection-string> -f migration/02_data.sql`
4. Verify row counts match the table above.
5. Replace the Supabase client with server-side database access.
6. Replace Supabase Auth with server-side sessions.
7. Point Vercel at the new env vars, deploy to a preview URL, test end to end.
8. Promote to production. `machakosnationals2026.nextgenkenya.com` is unchanged.
9. Rotate the shared passwords — the old ones have been shared in plain text.

Steps 1–4 are quick. Steps 5–6 are the actual work.
