## Goal
Get the MVP ready to hand to Dr. Boit on a nextgen subdomain, with you owning the code and iterating for free in Claude Code. Fix the broken registration save, swap in a placeholder logo, and leave the email wiring for later.

## 1. Fix registration "Save does nothing"
The form initializes empty fields as `"" as unknown as number` / `"" as "Male"`. Zod then rejects them with errors on `age`, `gender`, `sleepover`, `ownsCellphone`, `parent1Name`, `primaryPhone` — the toast says "fix the highlighted fields" but the red messages sit far down the long form so it looks like nothing happened.

Fixes in `src/routes/parent.tsx`:
- Initialize with real empty types (`age: undefined`, enums as `""` in a widened state type) and only pass defined values to `safeParse`.
- Scroll to the first error on submit and show a red summary banner at the top of the card listing which fields are missing.
- Show a subtle red ring on invalid inputs, not just helper text below.

## 2. Placeholder logo
- Add `src/assets/logo-placeholder.svg` (a labeled "NextGen logo — replace me" mark).
- Wire it into `AppHeader` next to the title.
- Leave a `README` note in `src/assets/` telling future-you (in Claude Code) exactly which file to drop in and what dimensions work.

## 3. Handoff to GitHub → Vercel → subdomain
No code change here, just the runbook I'll include in a new `HANDOFF.md` at the repo root:

1. In Lovable: **+ menu → GitHub → Connect project → Create Repository** under your GitHub org. Two-way sync turns on automatically.
2. Clone locally: `git clone <repo>` — now Claude Code edits push straight to GitHub, and Lovable stays in sync without spending credits.
3. On Vercel: **New Project → Import Git Repository → pick the repo**. Framework preset "Vite" (TanStack Start template builds cleanly). Set the production branch to `main`. Deploy.
4. In Vercel → Project → Settings → Domains: add `swim.nextgen.<tld>` (or whichever subdomain you want). Vercel shows one CNAME record.
5. At the DNS host for `nextgen.<tld>`: add that CNAME pointing to `cname.vercel-dns.com`. SSL provisions automatically within a few minutes.
6. Share `https://swim.nextgen.<tld>` with Dr. Boit plus the login `nextgen` / `swim2026`.

From that point on: every edit you make in Claude Code → `git push` → Vercel redeploys in ~30s. Lovable credits are only spent if you come back here to make a change.

## 4. Email — deferred, but noted
Leaving the current toast in place. `HANDOFF.md` will include a short "when you're ready to wire real email" section pointing you at: enable Supabase in the self-hosted repo, add a `payments` server function that inserts into a table + calls Resend with the payment/registration details, keep the same shared-password gate on the frontend.

## Files touched
- `src/routes/parent.tsx` — fix registration save + error surfacing
- `src/components/AppHeader.tsx` — render logo
- `src/assets/logo-placeholder.svg` (new)
- `src/assets/README.md` (new) — how to replace the logo
- `HANDOFF.md` (new) — GitHub + Vercel + subdomain runbook

## Not doing this round
- Enabling Lovable Cloud / Supabase (you asked to defer email + persistence to post-handoff).
- Multi-device data sync — data stays in localStorage until you wire Supabase in Claude Code.
- Real logo file — placeholder only, you swap it in later.
