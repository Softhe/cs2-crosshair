# Handoff: fullscreen controls + "Match my in-game size" (Steam-synced)

Prepared 2026-10-27 for Codex, to run on Windows. It is a handoff note, not project documentation.

## Where the code is

- GitHub: `https://github.com/Softhe/cs2-crosshair`, branch **`game-view-fullscreen`**, based on `main` at `c34915d`.
- All work is committed and pushed. On the Windows machine:
  ```powershell
  git clone https://github.com/Softhe/cs2-crosshair.git   # or, in an existing clone: git fetch origin
  cd cs2-crosshair
  git switch game-view-fullscreen
  npm ci
  npx playwright install chromium   # first time only, for the e2e tests
  ```
- This `HANDOFF.md` is committed on the branch so it travels with the code. **Delete it in a final commit before opening the PR.**
- The previous PRs were squash-merged with titles like "Keep fit preview on whole-pixel magnification… (#22)".

## What changed (two features)

### 1. Fullscreen controls
- The fullscreen button moved out of the Preview options dropdown. It is now a one-click icon in the preview toolbar, left of "Preview options".
- In fullscreen, a top-right overlay holds the 1×/2×/4×/8× zoom buttons and "Exit fullscreen". The old exit button sat at the bottom right.
- Narrow toolbars (≤480px / ≤400px) hide the small "960p" target label and the options chevron and tighten the zoom buttons, so the extra button fits at 320px.
- Files: `src/components/MapPreview.tsx`, `src/layout.css`, `src/style.css`, `e2e/preview-options.spec.ts`, `e2e/display-scaling.spec.ts`.

### 2. "Match my in-game size" (off by default, in Preview options)
- Models CS2's real output. The crosshair is rasterized at the chosen CS2 resolution, then each game pixel is stretched to `monitorW/gameW × monitorH/gameH` screen pixels. With "Stretched to fill the monitor" off, it uses the smaller factor on both axes (black bars). Example: 1280×960 stretched on 2560×1440 gives 2 × 1.5.
- The resolution list follows CS2's aspect groups (4:3, 5:4, 16:10, 16:9) and is filtered to modes ≤ the estimated monitor. Custom W×H is also available. When first enabled, it starts at the monitor's own resolution.
- While enabled, it overrides the "Game resolution" select in Inspect preview, which is disabled with a note.
- Stored locally (`delli.v3.game-view`) and synced to the Steam account.
- Files:
  - `src/preferences.ts` (new): pure model, validation, stretch math. The server imports it too.
  - `src/preference-sync.ts` (new): client hook. The account value wins on load and focus. Local changes are PUT after an 800 ms debounce, and 429 responses are retried using `Retry-After`.
  - `src/components/GameViewOptions.tsx` (new): UI.
  - `src/main.tsx`, `src/Preview.tsx` (new `stretch` prop), `src/preview-renderer.ts` (per-axis paint; smoothing only for fractional factors), `src/components/Dialogs.tsx`.
  - Server: `server/store.ts` (new `preferences` / `savePreferences`), `server/neon-store.ts` (new table in `schema`), `server/sqlite-store.ts`, `server/app.ts` (routes below).
  - Docs: `docs/DISPLAY_SCALING.md`, `docs/LIBRARY_SYNC.md`, `docs/VERCEL_DEPLOYMENT.md`.
  - Tests: `tests/preferences.test.ts` (new), `tests/server.test.ts` (new preferences test), `e2e/game-view.spec.ts` (new), `scripts/verify-neon.ts` (now also checks preferences).

### New API
- `GET /api/preferences` returns `{ "preferences": null | { "gameView": {...} } }`. Requires a session, like `GET /api/library`.
- `PUT /api/preferences` takes the body `{ "preferences": { "gameView": { "enabled": bool, "width": int 320–15360, "height": int 240–8640, "stretched": bool } } }`. It requires a session plus Origin and `X-CSRF-Token`, the same as library PUT. Last write wins. Malformed values get a 400 and are not repaired.
  - Rate limits: 60/min per IP (`pref-ip:` bucket) and 240/hour per owner (`pref-owner:` bucket).
- The response for a PUT echoes the validated preferences.

### New table
```sql
CREATE TABLE IF NOT EXISTS preferences (owner TEXT PRIMARY KEY, value JSONB NOT NULL, updated BIGINT NOT NULL)
```
It is in `schema` in `server/neon-store.ts`, so `npm run db:migrate` creates it. SQLite creates it automatically on startup.

## Verification already done (local)
- `npm test`: 89 pass (unit + server, including a preferences endpoint test with owner isolation, CSRF and validation).
- `npx tsc --noEmit`: clean.
- `npx playwright test`: 278 pass, 8 skipped (pre-existing skips). This covers pixel-size checks for 2560×1440 native, 1280×720 and 1280×960 stretched, and black bars, plus mocked Steam load/save of the preference.
- **Not done:** any real Neon migration, deployed preview check, or real Steam sign-in round trip.

## Tasks for Codex

1. **Re-run local checks** on the branch: `npm ci` (if needed), `npm run check`, `npm run test:e2e`. Note: in an earlier full run, `display-scaling` and `entrance` each failed once under load and passed on rerun. Treat a single such failure as a flake only if an isolated rerun passes.
2. **Migrate the preview Neon database** (`delli-crosshair-preview`, connected to Preview/Development):
   - The local env file is not in Git. Pull it into the ignored `.env.local` (for example `vercel env pull .env.local --environment=preview`). Never commit or print the URL.
   - Run `npm run db:migrate`. It uses `DATABASE_URL_UNPOOLED` if present, otherwise `DATABASE_URL`.
   - Run `node --env-file=.env.local --import tsx scripts/verify-neon.ts`. Expect a PASS line ending in "…last-write-wins owner-isolated preferences." It cleans up its own fixture rows.
3. **Delete `HANDOFF.md`, commit, push, and open a PR** from `game-view-fullscreen` against `main`. Suggested title: "One-click fullscreen with in-fullscreen zoom, and Steam-synced in-game size preview".
4. **Verify the Vercel preview deployment** of that PR, using `docs/VERCEL_DEPLOYMENT.md` § "Verification and release boundary" and `npm run verify:vercel-preview` (needs the ignored `.tools/preview-bypass.json`). In addition:
   - `GET /api/preferences` without a session returns 401 JSON (not the SPA).
   - Signed in: toggling "Match my in-game size" and choosing a resolution in one browser shows up in a second browser for the same account after reload. A different account does not see it.
5. **Before merging/deploying to production:** migrate the **production** Neon database (`delli-crosshair-production`, connected to Production only) the same way, using production env (`--environment=production`), then run `verify-neon.ts` against it. The code degrades safely if this is skipped: preference sync shows "Steam sync unavailable" and the setting stays local. Still, migrate first. Production origin is `https://delli.cc`. Do not change DNS, domains, or deployment protection.
6. After production deploy: on `https://delli.cc`, confirm `/api/session` returns JSON and that the preference persists for a real signed-in account across two browsers.

## Windows notes
- The `db:migrate` script already loads `.env.local` (`node --env-file=.env.local …`). Run the verify step the same way. Don't rely on Unix-style `VAR=value cmd` prefixes. In PowerShell use `$env:NAME = '...'`.
- `docs/LIBRARY_SYNC.md` already shows PowerShell commands for running the local API server.

## Guardrails
- Never expose `DATABASE_URL`, bypass secrets, or session cookies in logs, commits, or PR text.
- Migrations are additive (`CREATE TABLE IF NOT EXISTS`). Do not drop or alter existing tables.
- Do not touch team-level Vercel protection or other projects.
- Report real-Steam/hosted results separately from mocked browser tests (repo convention).
