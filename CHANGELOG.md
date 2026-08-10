# Changelog

Notable changes to CS2 Crosshair Studio are recorded here.

## Unreleased

### Changed

- Updated compatible React, Radix UI, routing, lint, build, and browser-test dependencies without crossing major-version boundaries.
- Separated studio preferences and local-library state transitions from their presentation components.
- Added non-blocking dependency-drift reporting to continuous integration.

### Testing

- Added direct coverage for local-library filtering, renaming, favorites, and removal through the extracted state boundary.
- Kept the external CS2 calibration and five-player playtest as explicit requirements for a future 2.1 release.

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
