# Maintenance baseline

This document records the baseline used for the post-2.0 maintenance cycle. It separates deterministic repository health from external evidence required to release 2.1.

## Engineering baseline

- Runtime: Node.js 20 or newer; CI uses Node.js 22 and pnpm 11.9.0.
- Automated gate: lint, TypeScript, codec utility invariants, Vitest, verified production build, and performance budgets.
- Browser gate: Chromium at 1280×720 and 390×844, including routes, storage workflows, accessibility, clipboard behavior, and downloads.
- Performance ceiling: the existing raw and gzip JavaScript/CSS budgets enforced by `verify:build`.
- Compatibility contract: `/`, canonical `/?code=`, compatibility `/?crosshair=`, `/custom`, and valid legacy share-code paths.

Run `pnpm deps:check` to report available dependency updates. The command is informational and may exit non-zero when updates exist; CI therefore reports it without making it a release blocker.

## Upgrade policy

Routine maintenance may update patch and minor versions within the currently declared major lines. Major upgrades require their own migration scope, regression review, and complete validation gate. In particular, TypeScript 7, jsdom 30, and Testing Library 7 are deferred from this cycle.

## Release status

Passing `pnpm check` and `pnpm test:e2e` establishes deterministic engineering readiness. It does not establish 2.1 release readiness. The latter additionally requires all real-game preview calibration evidence and the five-player playtest described in `PREVIEW_CALIBRATION.md` and `PLAYTEST_2_1.md`.

Keep `package.json` at 2.0.0 and maintenance notes under `Unreleased` until those external gates pass and a release is deliberately approved.
