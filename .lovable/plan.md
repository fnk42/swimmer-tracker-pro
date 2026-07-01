
## Scope

Frontend scaffolding only. Tailwind + Inter, 4/8 spacing, mobile-first, localStorage persistence. Simulated email (toast). You'll rewire to your own Supabase via Claude Code / Vercel later.

## Event

Placeholder: **Swimming Nationals — Machakos County, Fri 15 – Sun 17 August 2026**. Total per swimmer: **KES 20,000** (accommodation, deposit + final, parents can pay in any number of instalments).

## Flow

```
Login → Select swimmer → Registration form → Payment panel (with T&Cs) → Submit
```

Admin has its own view and owns the swimmer roster.

## Routes (TanStack Start, file-based)

```
src/routes/
  __root.tsx     Inter font, meta, auth-redirect
  index.tsx      Login (shared user/pass)
  parent.tsx     Parent flow
  admin.tsx      Admin table + roster management
```

Auth = `localStorage.ng_authed = true`. Placeholder creds: `nextgen / swim2026`.

## Swimmer roster (admin-managed)

Roster in `localStorage.ng_swimmers` (seeded with ~10 sample swimmers on first load from `event-config.ts`). Admin manages it:

- **Add swimmer manually** — small form at top of admin: full name (required), optional age / gender defaults.
- **CSV upload** — file picker + drag-and-drop, `.csv` only. Expected headers (case-insensitive, extras ignored): `name` (required), `age`, `gender`. "Download CSV template" link provided. Parsed with **PapaParse**, validated per row with zod. Preview modal shows valid count and skipped rows with reasons (missing name, duplicate by case-insensitive name). Duplicates skipped by default to protect existing registration/payment data.
- **Remove swimmer** — trash icon; if the swimmer has registration or payments, confirm dialog warns and deletes cascading data.
- **Rename swimmer** — inline edit on the name cell. Registration/payments stay linked via `swimmerId`.

Every swimmer has a stable `swimmerId` (uuid) — never keyed on name.

## Gender

**Male / Female only.** No "Prefer not to say" option. Applies to the manual add form, the parent registration form, and the CSV importer (rows with any other value are flagged as skipped in the preview).

## Registration form (per swimmer, parent side)

**Swimmer** — full name (read-only from roster), age, gender (**Male / Female**), spending the night with the team? (Y/N), owns a cellphone? (Y/N — note about phones stored during sleepover).

**Parents / guardians** — Parent 1 full name, Parent 2 full name (optional), primary cell, secondary cell (optional).

**Health** — dietary issues (optional), allergies (optional), health conditions (optional), special requests / free-form (optional).

Validated with zod. "Save details" is separate from payment submission so a parent can register now and pay later. Pre-filled and editable on return visits.

## Payment panel

Summary: Total KES 20,000 · Paid · Balance · Progress bar · Status badge (Unpaid / Partial / Paid).

Form: Amount (KES, ≤ balance) · M-Pesa reference · Payment type (Deposit / Partial / Final) · **T&Cs checkbox with full rules text above it (required)** · Submit → append to localStorage, toast "Payment recorded. Convener notified (simulated).", refresh summary, list prior payments.

## T&Cs content

Real copy in a scrollable panel above the checkbox, stored as one constant in `event-config.ts`. Covers: arriving together, timekeeping, cellphones collected during the sleepover, behaviour, health disclosure, KES 20,000 payment terms, refund window, photo/media usage, liability. Checkbox: "I have read and agree to the rules above on behalf of my swimmer."

## Admin view (`/admin`)

1. **Roster management** — add swimmer form + CSV upload + template link.
2. **Swimmers table** — Name (editable) · Age · Sleepover Y/N · Primary contact · Paid · Balance · Status · actions. Amber badges for any allergy / medical / dietary note. Expand row → full registration + payment history.
3. **Export** — "Download all data (CSV)" for admin's own records.

Read-only on payments.

## Data (localStorage)

```
ng_authed:        "true" | absent
ng_swimmers:      Swimmer[]                    // { id, name, age?, gender?: "Male" | "Female" }
ng_registrations: Record<swimmerId, Registration>
ng_payments:      Payment[]                    // { id, swimmerId, amount, reference, type, createdAt }
```

Helpers in `src/lib/store.ts`: typed getters/setters + selectors (`getPaid`, `getBalance`, `isRegistered`, `addSwimmer`, `importSwimmersFromCsv`, `removeSwimmer`).

## Design

- Inter via `<link>` in `__root.tsx` head, mapped in `@theme` as `--font-sans`.
- 4/8 spacing, mobile-first, tap targets ≥ 44px, sticky primary action on long forms.
- Neutral base + one accent (pool-blue). Minimal — you'll redesign in Claude Code.
- shadcn: Button, Input, Select, Checkbox, Textarea, Card, Table, Progress, Sonner, Badge, ScrollArea, Accordion / Collapsible, Dialog, AlertDialog.

## Explicitly out of scope

Real email; real per-parent accounts; editing/deleting individual payments; multi-event support; any backend / Supabase wiring.

## New dependency

- `papaparse` + `@types/papaparse`.

## Files to create / modify

- `src/lib/event-config.ts` (new)
- `src/lib/store.ts` (new)
- `src/lib/schemas.ts` (new)
- `src/lib/csv.ts` (new)
- `src/routes/__root.tsx` (edit)
- `src/routes/index.tsx` (edit)
- `src/routes/parent.tsx` (new)
- `src/routes/admin.tsx` (new)
- `src/components/AppHeader.tsx` (new)
- `src/components/TermsPanel.tsx` (new)
- `src/components/RosterManager.tsx` (new)

Ready to build on approval.
