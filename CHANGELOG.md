# Changelog

Notable changes to CS2 Crosshair Studio are recorded here.

## Unreleased

### Added

- Preset buttons now show a live crosshair thumbnail rendered with the same engine as the editor preview.
- Invalid legacy `/CSGO-...` links render a dedicated "Invalid crosshair link" page that explains the code could not be decoded instead of a generic 404.
- A per-chunk bundle size report (`pnpm report:bundles`) runs in CI next to the release-gate budget check.
- Share-code and alias inputs disable mobile autocorrect, autocapitalization, and spell checking so keyboards cannot mangle pasted codes.

### Changed

- Added `parseShareCode` as the single decode entry point: import validation, URL loading, config generation, and the import checkmark now decode a share code exactly once and receive clamped editor state.
- `encodeCrosshair` clamps out-of-range values before packing bytes instead of silently wrapping them; the clamp helpers now live in the share-code module with `crosshair-preview` re-exporting them.
- Clipboard paste flows through the shared `readFromClipboard` helper instead of reimplementing permission handling in the editor.
- Performance budgets are read from `scripts/performance-budgets.json` so the gate and the CI size report share one source.
- Updated compatible React, Radix UI, routing, lint, build, and browser-test dependencies without crossing major-version boundaries.
- Separated studio preferences and local-library state transitions from their presentation components.
- Added non-blocking dependency-drift reporting to continuous integration.
- Rebuilt the crosshair preview on a centered SVG with a separate opaque outline layer: the outline no longer inherits crosshair alpha, odd thicknesses stay symmetric, and rendering is memoized. The preview stage also announces the current settings to assistive technology.
- Hardened local storage (undecodable share codes are dropped on read/import, backup shape is validated before migration, history IDs are collision-safe), throttled preview resize handling, documented preview metric constants, accepted lowercase `csgo-` prefixes, and guarded color conversion against non-finite channels.

### Removed

- Dead module API: `safeCopyToClipboard`, `isClipboardSupported`, and `isClipboardReadSupported` from the clipboard module; `getStorageStats`, `clearHistory`, `clearFavorites` exports and the unused `removeFromFavorites`/`generateCrosshairId` exports from storage.

### Testing

- Added direct coverage for local-library filtering, renaming, favorites, and removal through the extracted state boundary.
- Added coverage for share-code parsing, encode-time clamping, write-path alias capping, and the invalid-share-link route.
- Kept the external CS2 calibration and five-player playtest as explicit requirements for a future 2.1 release.

### Housekeeping

- Raised the JavaScript gzip performance budget from 150,000 to 151,000 bytes and moved the budget values into `scripts/performance-budgets.json`. The original value passed with only 7 bytes of headroom, and the studio hardening (backup sanitization, library state extraction, list deduplication, preset thumbnails, and the invalid-share-link page) adds a net ~500 gzip bytes.
- Raised the JavaScript gzip budget to 152,000 bytes for the SVG preview rebuild and storage validation (~850 gzip bytes). Splitting the first-run guide into its own chunk was tried and reverted: extra chunks compress worse in total even though the entry chunk shrank. The paint-blocking entry chunk remains far under budget (~28,000 of 115,000 gzip bytes).

## 2.0.0 - 2026-07-22

### Added

- A unified studio for importing, creating, editing, previewing, sharing, and exporting a crosshair from one page.
- Crosshair presets and controls for length, gap, thickness, color, opacity, outline, center dot, and T style.
- Live generation of share codes, console commands, config files, share links, and optional aliases.
- Draft persistence plus an always-visible local library for recently loaded or exported crosshairs and favorites.
- Canonical query-based share links using `/?code=CSGO-...`.
- Automated type checking and production-browser smoke coverage in the release gate.
- Build-artifact verification and a post-deployment production route smoke test.
- Switchable deep-teal Tactical, Counter-Strike-inspired CS2, and calm wine-red Crimson redesigns with persistent palette selection.

### Changed

- The Dot preset now uses `CSGO-zDZH2-jXXvr-yFaQu-OjXPS-G8sdA` exactly.
- Match-critical dot, gap, thickness, outline, outline-thickness, alpha-toggle, and alpha-value controls are always visible in the creator.
- Length, Thickness, Gap, Outline thickness, and Alpha now form one ordered, left-aligned slider stack.
- The CFG filename and autoexec alias workflow is now visible beside the export actions instead of being hidden in an optional panel.
- Import, preset, customization, reset, preview, export, filename, and alias tools now share one continuous two-column workspace with no detached panels.
- `/custom` is now a compatibility redirect to the unified root studio and preserves query strings and hashes.
- Only valid legacy `/:shareCode` paths open the studio; unrelated single-segment paths show the not-found page.
- The social preview image is now an optimized JPEG referenced consistently by page metadata and build verification.
- Project documentation now describes the current studio architecture, tests, compatibility routes, and GitHub Pages release process.

### Removed

- The legacy share-code-only generator, its tests, and its obsolete implementation documentation.
- Unused UI modules left by the earlier generator interface.

## 1.0.0

### Added

- CS2 crosshair share-code validation and decoding.
- Config-file and console-command generation.
- A browser-rendered crosshair preview.
- Alias support and basic responsive styling.
