# Release and deployment

## Release checklist

Before merging to `main`:

1. Review the complete diff and remove generated artifacts such as `*.tsbuildinfo`.
2. Install with `pnpm install --frozen-lockfile`.
3. Run `pnpm check` and `pnpm test:e2e`.
4. Confirm `pnpm verify:build` finds `index.html`, `404.html`, `custom.html`, `custom/index.html`, `CNAME`, `robots.txt`, `sitemap.xml`, and `og-image.jpg` and validates their metadata and fallback content.
5. Run the manual production smoke test in [TESTING.md](TESTING.md).
6. Verify page title, description, canonical URL, Open Graph image, favicon, crawler rules, sitemap URL, and `delli.cc` references.
7. For preview changes, follow `PREVIEW_CALIBRATION.md` and review the browser/CS2 reference matrix.
8. Review the JavaScript and CSS sizes printed by the build budget check; raise a budget only with a documented reason.
9. Run `pnpm playtest:synthetic` (or complete the five-player study), then run `pnpm verify:release-readiness`; it must confirm all preview references and one complete usability-evidence path before the release is approved.

Do not describe a change as released until the Pages deployment and production smoke test have completed.

`verify:release-readiness` checks local, privacy-safe validation evidence that is deliberately excluded from the deployed site. CI remains responsible for deterministic code checks; the release approver is responsible for running and recording this external-evidence gate before merging 2.1.

## Continuous integration

`.github/workflows/ci.yml` runs for pull requests and pushes to `main`. It installs the pinned pnpm version and Node.js, installs dependencies from the lockfile, installs Playwright Chromium, and runs the required checks and browser smoke tests.

A pull request should not be merged with a failing or skipped required check. If dependencies change, commit the matching `pnpm-lock.yaml` update.

## GitHub Pages deployment

`.github/workflows/deploy.yml` runs on pushes to `main`. It runs `pnpm check`, installs Chromium, runs `pnpm test:e2e`, uploads the resulting verified `dist/`, and deploys the artifact with GitHub Pages. After deployment, `pnpm smoke:production` retries the live site and verifies the root, canonical query, `/custom/`, legacy path, and unknown-path HTTP behavior.

The custom domain is declared by `public/CNAME`. The repository Pages settings and DNS records must continue to point `delli.cc` at this site. HTTPS should remain enforced because clipboard functionality depends on a secure context in supported browsers.

## Compatibility contract

- The canonical studio is `/`.
- Canonical share links use `/?code=CSGO-...` and should be used everywhere new links are generated.
- `/?crosshair=CSGO-...` remains readable for compatibility.
- `/custom` redirects to `/` in both the client router and generated static entry points, preserving its query string and hash.
- A valid legacy `/CSGO-...` path remains readable through the app fallback.
- Invalid paths render the not-found page.

Keep `scripts/prepare-static-pages.mjs`, the client router, URL parsing tests, sitemap, and deployment verification aligned whenever this contract changes.

## Post-deployment verification

After the Pages job and its automated `pnpm smoke:production` step succeed:

1. Open `https://delli.cc/` in a fresh browser context and confirm the unified studio is the deployed UI.
2. Load a canonical `/?code=` link and compare its controls, preview, and generated code with the source crosshair.
3. Verify `/custom?code=...#help` redirects to `/` without losing the query string or hash and retains no redirect loop.
4. Verify a valid legacy path opens the studio and an invalid path shows the not-found page.
5. Copy a command and share link, download a config, and inspect the result.
6. Test at desktop and mobile widths and check the browser console and network panel for errors or missing assets.
7. Confirm `CNAME`, `robots.txt`, `sitemap.xml`, favicon, and `og-image.jpg` are served from the custom domain.
8. Recruit 3–5 CS2 players for a short task-based check: import, tune, apply, and report whether the result matched the preview. Summarize friction points in the next milestone without collecting share codes or aliases.

If a regression is found, fix it forward when practical. If rollback is necessary, revert the responsible commit on `main` and let the same Pages workflow deploy the restored build; do not edit generated Pages artifacts by hand.
