# Testing

## Release gate

Install the pinned dependencies, then run the same main gate used by CI:

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` covers linting, TypeScript, utility invariants, the Vitest suite, and a production build. Run the production-browser suite separately when working locally:

```sh
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm test:e2e` runs a fresh production build before Playwright starts the preview server. CI installs Chromium and runs both the main gate and the end-to-end suite.

## Focused commands

```sh
pnpm lint
pnpm typecheck
pnpm test:utils
pnpm test
pnpm test:watch
pnpm build
pnpm verify:build
pnpm preview
pnpm test:e2e
pnpm smoke:production
pnpm verify:release-readiness
pnpm deps:check
```

`deps:check` is an informational maintenance report: finding available updates is expected to produce a non-zero exit code and does not fail CI. Major-version migrations are reviewed separately.

The release-readiness command is separate from `pnpm check`: it fails until real CS2 captures and five anonymized player sessions have been supplied.

Unit tests should remain close to the relevant module or component as `*.test.ts` or `*.test.tsx`. End-to-end tests live under `e2e/` and exercise the built application through a real browser.

## Automated browser smoke coverage

Playwright runs Chromium at 1280×720 and 390×844. The current suite verifies:

- The unified studio loads without browser errors or horizontal overflow and keeps the editor ahead of the preview on mobile.
- Mobile preview and autoexec disclosures open correctly, while fixed quick actions remain accessible.
- A preset updates the selected color, preview, share code, URL, and persisted draft.
- Code and link copying, aliased config download, recent history, favorites, library search, inline naming, and JSON backup import/export.
- `/custom` query/hash preservation, a valid legacy path, and an invalid single-segment path.
- No automatically detectable WCAG 2.0/2.1 A or AA violations on the initial studio.
- Theme palettes retain their intended tokens and remain free of automatically detectable WCAG A/AA violations.

## What to cover

### Codec and output

- Valid codes decode and round-trip without changing represented values.
- Malformed codes and checksum failures produce actionable validation errors.
- Values are clamped to supported ranges before encoding and preview rendering.
- Representative fixture states cover negative/maximum gaps, heavy outlines, center dot, T style, alpha, and custom colors.
- Commands and configs contain the correct convars, filename, and sanitized alias.

### Studio behavior

- Importing a valid code updates controls, preview, generated code, and canonical URL.
- Presets and individual controls update all derived outputs.
- Reset returns to the default and clears the persisted draft.
- Copy and download actions create history; history selection and favorites restore the right code.
- Library search filters by alias and share code; renaming keeps history and favorites in sync; JSON backups restore history, favorites, and settings.
- Clipboard failures produce feedback without breaking the page.
- `Ctrl+Enter` and `Cmd+Enter` copy the current console command.

### Routes

- `/` loads the unified studio.
- `/?code=...` and the compatibility `/?crosshair=...` load valid codes.
- `/custom` redirects to `/` and preserves its query string and hash.
- A valid legacy `/CSGO-...` path loads the same crosshair.
- Invalid single-segment and nested paths render the not-found page.

### Accessibility and responsive layout

- All controls have accessible names and visible keyboard focus.
- Validation errors are announced and controls remain keyboard-operable.
- Desktop and mobile layouts have no horizontal overflow.
- On a narrow viewport, editing and export actions remain discoverable without the preview obscuring the workflow.

## Manual production smoke test

After `pnpm build`, start `pnpm preview` and verify at a desktop width and a narrow mobile width:

1. Load `/` with a clean storage profile and confirm there are no console errors.
2. Apply each preset, move representative sliders, toggle settings, and choose a custom color.
3. Import a known-valid share code and compare the generated code after a round trip.
4. Copy the command, code, and share link; download a config and inspect its filename and content.
5. Refresh and confirm draft, history, and favorites persistence.
6. Open the canonical link in a fresh context and verify the same crosshair loads.
7. Check `/custom?code=...#help`, a legacy share-code path, and invalid paths.
8. Confirm FAQ interactions, keyboard navigation, toasts, and the not-found page.

For the production deployment, repeat the route, clipboard, download, and console-error checks on `https://delli.cc/`. Clipboard reads may be denied by browser policy; manual paste must continue to work.
