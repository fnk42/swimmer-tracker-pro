# NextGen Analytics: what to borrow from Swimcloud, in phases

Written 7 Oct 2026 by Felix Njenga, for Claude Code. This is a plan, not a spec: build it phase by phase, and stop for a check on a phone after each phase.

## Decisions (7 Oct 2026)

- **NextGen only.** No full-field data from other clubs. Phase 2's field import is dropped; tapping a time opens the gala page with our own results (built in Phase 0).
- **Development groups: fixed lines against the age group**, not percentile cuts: well ahead ≤ −6 %/yr against typical, ahead −6 to −2, in line ±2, below typical > +2. Set in `NextGen/tools/analytics.py` (ATH) and `GROUP_LINES` in the template.
- **How a meet went** compares each swim with that swimmer's **previous race** in the event (`vsLast` in meetSwims), with the age-group median beside it. No baseline menu.
- **Follow a swimmer is now "Progress"**: one fixed chart, meet by meet, against where they started. No swimmer picker (search chooses; a parent sees their own child first), no "Measured against", no "Broken down by".
- **No "Progress measured" strip** and no year buttons. The only period control is the start/end season range.

## Ground rules (these override anything below)

1. **No swimmer against swimmer.** Each swimmer is shown against **their own age group**, never ranked against named club-mates. (Decided 7 Oct 2026.) This applies to new charts, tooltips, FAQ wording and the meet view.
2. **A gala placing is the one exception, and it is anonymous.** "4th of 23 in 10–11 Girls" is a fact printed in the official results, so we can show it, but the rest of the field appears only as an unnamed distribution (dots, a median, the winning time). No other child's name appears anywhere in our UI.
3. **The only period control is the season range: start and end.** Remove every "whole career vs this year" dropdown (see Phase 0).
4. Phone first. Every change is checked at 390px wide with no sideways scroll. Use the existing Playwright mock harness: mocked `/api/auth/me`, `/api/tracker/data` and `/api/meet/detail`.
5. The tracker is the single file `src/tracker/template.html`. The data comes from the NextGen pipeline repo (`~/Claude Projects/NextGen/tools/`). Shape and scope go through `src/lib/tiers.ts` (`shapeAnalytics`).

## Where things stand

- Branch `seasons-and-no-compare` (not merged):
  - Committed: swimmer cards follow the season range (`spanEvents`), and "Follow a swimmer" shows one swimmer against the typical swimmer of their age group (grey line, n ≥ 3).
  - **Uncommitted** in `template.html`:
    - "How a meet went" rows are sorted by name, then event.
    - The wording in the `meetcols` and `ratecard` tips.
    - The leaderboards were deleted.
    - The season compare table is sorted by name.
  - Commit these, open a preview, and wait for Felix's check before merging.
- **Open decision: the development groups.** "Fast / Good / Steady / Slowest improvement" are a percentile ranking of the club (cuts at 10/30/30/30), which contradicts rule 1. Options:
  - (a) Fixed lines against the age-group rate, e.g. "more than 2%/yr above typical for their age". Nobody has to be at the bottom.
  - (b) Keep the groups and reword them.
  - (c) Remove them.
  - **Recommendation: (a).** It keeps the "who to look at first" use for coaches without forcing 30% of children into the bottom group. Do not build any of these until Felix picks one. Whichever he picks changes FAQ `#groups` and `#lower-group`.

## The data finding ("we already have the data")

This is partly true. Checked on 7 Oct 2026:

| Source | What it holds | Full field? |
|---|---|---|
| `Exports/*/NEXTG-Meet_Results-*.cl2` and `Exports/2026/res_*_{F,M}.zip` (CL2) | NextGen swims only: one `C1` club record per file | **No** |
| `Exports/*/*.pdf` (Hy-Tek results) | Every swimmer from every club, by event and age group, with place and splits | **Yes**, e.g. 2,118 result lines for KA Time Trials, 19 Sep 2026 |
| `meets_detail.json` in the app | NextGen rows only, e.g. 18 rows in the 50 Free at the Time Trials | No |

So the full fields exist **only in the PDFs**. `tools/pdfimport.py` already parses these PDFs, including the two-column layout, but keeps NextGen rows only (`TEAM_ONLY`, `TEAM_CODES`). The field data costs a parser change, not new sourcing. 2022–2025 have PDFs for most meets as well.

## Phase 0: Simplify the period controls (small)

Felix: "there should be no drop down that shows across their whole careers vs during the year. The seasons selectors: start date and end date, are the only ones we need."

- Remove the year chips (`.yr` buttons, `YLABEL`, "All years / 2026…"). The season range `fFrom` / `fTo` becomes the only period state, and `fSpan()` stops falling back to `year`.
  - Default: the current season through the current season.
  - A "Reset" sets it to the first through the last season.
- Remove the "Measured against" select in Follow a swimmer (`TW_BASE`, `#twBase`). It includes the misleading "whole-career average". Fix the baseline to `vsFirst` ("where they started"), drawn within the selected range.
- Remove the "Measured against" select in How a meet went (`MS_BASE`, `#msBase`), and choose a single baseline. **Recommendation:** `vsPB`, their previous best, because it matches the "vs form" figure on the meet cards. Show the age-group median as a second, grey reference column where it exists, rather than as a choice. *Felix should confirm this one.*
- Check that every chart, card, table and count changes when the season range changes. This was the bug reported on 7 Oct.
- Update FAQ `#chart` (it mentions "one season, or one stroke, depending on the view") and the `follow` tip.

## Phase 1: Swimcloud-style design borrowings (UI only, no new data)

What Swimcloud does well, applied to our cards:

1. **Plain results tables.** For each swimmer and meet: `Event | Time | Imp. | Place`.
   - Improvement shows in green when faster than their previous best and red when slower, with a sign and seconds (e.g. `−1.24`) as well as a percentage.
   - Leave Place blank until Phase 2 fills it.
   - This replaces the denser "Event by event" block, which is waiting for Boit and Cian's verdict.
2. **Meet list rows.** For each meet: name, then "Completed · 19 Sep 2026 · Nairobi · 25m", then the swimmer's swim count and PB count.
   - The whole row is one tap target opening that meet.
3. **A profile header with tabs** on a swimmer:
   - The header shows name, age group and club years.
   - Tabs: **Overview · Meets · Times**.
     - Overview: the rate against the age group, and the stroke chart from Phase 3.
     - Meets: the list of meets they swam.
     - Times: best times per event, each tappable.
4. **"See all"** links under capped lists, instead of long scrolls.
5. **Floating pills.** Filters and Events become two pill buttons that open a bottom sheet on phones, replacing the always-open filter card.
6. **White cards, generous spacing and one accent colour per state.** Keep the NextGen navy, electric blue and Anton/Sora fonts.
7. **What to avoid:** Swimcloud's truncated ALL-CAPS names. Keep names in title case, and wrap them rather than cutting them off.
8. **Tapping a time** (in Times or in a meet table) opens the meet view, scrolled to that event, with that swimmer's swim highlighted.
   - In Phase 1 this shows our own rows only: their time against their previous best and against the age-group median.
   - Phase 2 adds the field.

## Phase 2: DROPPED on 7 Oct 2026 (NextGen only). Kept below for reference.

Felix: "When a time is clicked it takes you to the gala and shows how one did in relation to everyone else… We don't want to have to keep track of each swimmer against all the swimmers."

Store the **field**, not people: for each meet, event, gender and age group, keep the times only. No names, no clubs.

### 2a. Pipeline (NextGen repo)

- Add a `--field` mode to `tools/pdfimport.py`, or a sibling `tools/fieldimport.py`. It emits `data/fields.csv` with one row per finishing swim:
  - `meet_id, event (dist/stroke/course), gender, age_group (as printed), place, time_s`
  - `status` (ok / DQ / NS / DNF)
  - `is_nextgen` (bool)
  - For NextGen rows only: `swimmer_id`, matched the same way `pdfimport` already matches.
- Drop other swimmers' names and clubs at parse time. They are never written to disk in our outputs.
- Validate each meet: for every NextGen row, the field place should equal the place printed in the PDF, and the time should equal our CL2 time. Report mismatches; never drop rows silently (the same rule as `pdfimport`).
- Masters meets: parse them, but keep them out of the children's views.
- Backfill order: 2026 first (13 PDFs), then 2025, then 2022–2024.

### 2b. Shape (app repo)

- `build_view.py` emits a per-meet `field` block. For each `(event, gender, age_group)`:
  - `n`, `winner_s`, `median_s`, `p25_s`, `p75_s`
  - the sorted times, used only for the dot strip
  - for each NextGen swim: `place`
- Serve it through `/api/meet/detail` (it is already per meet, so the data loads lazily).
- In `tiers.ts`, a parent sees placings for their own children only. Coaches see all NextGen placings. The field distribution is anonymous for everyone.

### 2c. UI

- The meet view, per event, for the selected swimmer:
  - The line "**4th of 23** · 10–11 Girls · 1.8s behind the winner · 0.9s faster than the median".
  - A horizontal dot strip of the field's times, with their dot highlighted. Other dots are grey and unlabelled.
  - Percentile in words: "faster than 70% of the field".
- On a swimmer's Times and meet tables, the Place column is now filled.
- New FAQ entry `#placing`: where placings come from (the official results), and why other children's names are never shown.

**Out of scope:** tracking a non-NextGen swimmer across meets, head-to-heads and rankings lists.

## Phase 3: One chart for "where does this swimmer lie across all their strokes?"

Each axis or row is a stroke (Free, Back, Breast, Fly, IM). The measure must be **against the age group**, so the measure is the decision, not the chart type. There are two candidates:

- **Improvement:** their rate against the typical age-group rate. We have this today.
- **Standing:** their best time as a percentile of the gala fields for their age group. This needs Phase 2.

Chart options:

| Chart | Good at | Weak at |
|---|---|---|
| **Radar / web**, Swimcloud's "Specialty" | Instantly reads as a shape: "a breaststroker" | Hard to read exact values; area exaggerates; needs ≥ 3 strokes with data |
| **Diverging bars** from an age-group-typical centre line | Most honest and readable on a phone; shows above and below typical at a glance | Less distinctive than a web |
| **Dot strip per stroke** (their dot over a faint band showing the age group's middle 50%) | Shows where they sit *within* the group, not just above or below | Needs field data for standing |
| **Stroke × distance heatmap** (rows: strokes; columns: 50/100/200/400) | Shows sprint against distance strengths too | Sparse for young swimmers; many empty cells |
| **Sprint ↔ distance slider** (one marker on a line) | A simple "specialty" headline | Loses the stroke detail |
| **Small multiples**: one tiny time line per stroke, with the age-group line in grey | Shows trends, not just a snapshot | It is several charts, not one |

**Recommendation:**
- Ship **diverging bars** as the default "Stroke profile" in the Overview tab. They replace the current Stroke / Distance profile chips.
- Offer the **radar** as a toggle, because Felix likes the look.
- Both start on *improvement*, which is available now.
- Add *standing* as a second measure once Phase 2 data is loaded.
- Grey out any stroke with fewer than `MIN_RACES` races, labelled "not enough races".
- No library is needed: plain SVG, like the existing charts.

## Phase 4: Tidy and explain

- FAQ:
  - Rewrite `#chart`, `#groups` and `#lower-group` to match whatever Felix decides on the groups.
  - Add `#placing` and `#stroke-profile`.
- Sweep all copy for wording that implies swimmers are compared with each other. Examples: "top of the club", "ranked", "best in the club".
- One-pager update for Boit and Cian (in the NextGen repo, `Client Documents/source/whats-changed.html`; overwrite it, don't version it).

## Checks for each phase

- Replay the real flows in a headless browser before calling a phase done. Use the mock harness, plus a real sign-in on the local dev server (`bun run dev:local -- --port 5199`).
  - A parent sees only their own children's placings.
  - Changing the season range changes every number.
  - There is no sideways scroll at 390px.
  - No non-NextGen name appears in any payload (grep the JSON).
- Preview on the branch URL, then wait for Felix's check on his phone, then merge to `main` (which deploys to production).
- Do not email or message Boit, Cian or parents as part of this work.

## Rough sizes (hours)

| Phase | Hours |
|---|---|
| 0: period controls | 3–5 |
| 1: design borrowings | 10–16 |
| 2: field data and placings | 14–22 (2a is the bulk, mostly validation across older PDFs) |
| 3: stroke profile chart | 6–10 |
| 4: tidy and FAQ | 2–4 |
