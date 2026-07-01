# NextGen Swim — Handoff Runbook

This MVP is a TanStack Start + Vite app. Data lives in the browser
(`localStorage`) until you wire it up to Supabase. Login is a shared
password: **`nextgen` / `swim2026`** (change in `src/lib/event-config.ts`).

---

## 1. Get the code out of Lovable (one-time, ~5 min)

1. In the Lovable editor, click **+ (bottom left of chat) → GitHub → Connect
   project**. Authorize the Lovable GitHub App if prompted.
2. Pick the GitHub account/org, then **Create Repository**. Lovable pushes the
   current codebase and turns on two-way sync.
3. Locally: `git clone <your-new-repo-url>`.

From now on: edit locally (Claude Code, VS Code, whatever) → `git push` →
Lovable stays in sync automatically. You only spend Lovable credits when you
come back into Lovable to make a change.

---

## 2. Deploy to Vercel on a nextgen subdomain (~10 min)

1. Log in to Vercel → **Add New → Project → Import Git Repository** → pick
   the repo you just created.
2. Framework preset: **Vite** (auto-detected). Leave build command and
   output directory at their defaults. Click **Deploy**.
3. Once the first deploy succeeds, go to **Project → Settings → Domains**.
4. Add your subdomain, e.g. `swim.nextgen.co.ke`. Vercel shows either a
   CNAME record (`cname.vercel-dns.com`) or A record.
5. Log in to whoever hosts DNS for `nextgen.co.ke` and add that record.
   SSL provisions automatically within a few minutes.
6. Share `https://swim.nextgen.co.ke` with Dr. Boit along with the login
   credentials above.

Every `git push` to `main` = automatic redeploy on Vercel in ~30 seconds.
No Lovable credits used.

---

## 3. Swap the logo (when you have the real file)

See `src/assets/README.md`. TL;DR: drop the file in as
`src/assets/logo-placeholder.svg`, or rename and update the import in
`src/components/AppHeader.tsx`.

---

## 4. When you're ready to wire real email + shared data

The current MVP simulates the convener email with a toast. The proper
version needs a real backend so:

- Parent registrations persist across devices / browsers.
- The convener email actually gets sent on payment submit.
- Admin can see live data from all parents.

Recommended path (all doable from Claude Code, no Lovable needed):

1. **Add Supabase**: create a project at supabase.com, add the URL + anon key
   to Vercel env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
2. **Create three tables**: `swimmers`, `registrations`, `payments`
   (mirror the shapes in `src/lib/schemas.ts`). Enable Row-Level Security.
3. **Replace `src/lib/store.ts`** — swap the `localStorage` calls for
   Supabase client calls. The rest of the app doesn't need to change because
   everything already goes through this one module.
4. **Add a server function** for payment submit that:
   - Inserts the payment row.
   - Calls Resend (or any transactional email API) with the payment details,
     swimmer name, current balance, and the parent contact info — to
     `boit@…` (whichever address the convener wants).
5. **Keep the shared-password login as-is** for now, or upgrade to Supabase
   Auth (magic link per parent) later.

Env vars needed for that stage:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `RESEND_API_KEY` (server-side only)
- `CONVENER_EMAIL`

---

## 5. Files you'll edit most often

- `src/lib/event-config.ts` — event name, dates, total KES, shared password,
  convener email, T&Cs text, seeded swimmer roster.
- `src/routes/parent.tsx` — parent flow (select swimmer → register → pay).
- `src/routes/admin.tsx` — admin dashboard.
- `src/components/AppHeader.tsx` — logo + club name.
- `src/assets/` — logo lives here.
