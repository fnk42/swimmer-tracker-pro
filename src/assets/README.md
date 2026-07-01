# Logo

The header logo lives at `src/assets/logo-placeholder.svg` and is imported by
`src/components/AppHeader.tsx`.

## To replace it

1. Drop your real logo file into this folder. PNG or SVG both work. Suggested:
   - **Square**, at least 128×128 px (renders at 32×32 in the header).
   - Transparent or solid background — either is fine.
2. Either:
   - **Keep the same filename** (`logo-placeholder.svg`) — no code change needed.
   - Or rename and update the import path at the top of `src/components/AppHeader.tsx`.

That's it. The header will pick it up on the next dev reload / deploy.
