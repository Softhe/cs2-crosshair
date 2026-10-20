# Vercel and Neon deployment

The static Vite editor and private-library API are deployed to Vercel with separate preview and production Neon databases. The existing GitHub Pages workflow remains configured. This does not move `delli.cc` or change its DNS.

## Runtime and routing

Vercel builds the frontend with `npm run build` and serves `dist`. The Node 24 function in `api/[...path].ts` imports the shared authentication/library handler. `api/index.ts` also handles the bare API root. Initialization is reused within a function instance, while sessions, OpenID state/nonces, and favorites remain in Neon rather than instance memory or the function filesystem.

The SPA fallback excludes `/api` and every `/api/` path. Unknown API endpoints must return an API error, never the editor's HTML. Existing static assets take filesystem precedence over the fallback. Code links and `/custom` still reach the frontend router.

Vercel supports TypeScript functions under `/api` and native Node request/response objects. See [Node.js functions](https://vercel.com/docs/functions/runtimes/node-js), [supported Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), and [rewrite configuration](https://vercel.com/docs/project-configuration/vercel-json#rewrites).

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Protected Neon Postgres connection string for the preview database. Configure it for Preview functions. Never expose it as a `VITE_` variable or put it in the repository. |
| `PUBLIC_ORIGIN` | Optional explicit HTTPS origin used for callbacks and request-origin validation. No trailing slash. |
| `VERCEL_URL` | Vercel's trusted deployment hostname. The adapter uses `https://` plus this hostname when `PUBLIC_ORIGIN` is absent. |

For a generated preview URL, leave `PUBLIC_ORIGIN` unset so each deployment uses its own `VERCEL_URL`. For a deliberately chosen stable preview alias, configure its exact origin and always open that origin during authentication. The application never derives its callback origin from an incoming Host or forwarded-host header.

Run `npm run db:migrate` against each Neon database before deploying a release that adds tables (for example `rate_limits`). Until then, rate limits fail open and expired-record cleanup logs an error.

Use a preview database or branch separated from future production data. The shared backend selects Neon when `DATABASE_URL` is configured. Local development can continue using SQLite. A Vercel deployment must not rely on a local SQLite file for durable sessions or favorites.

Steam OpenID sign-in does not need a Steam Web API key. Optional profile-name/avatar enrichment is outside this deployment. Account records use SteamID and private saved crosshairs. See [the library contract](LIBRARY_SYNC.md) for authentication, merge consent, and storage scope.

## Deployment protection and Steam callbacks

A real Steam sign-in round trip needs a browser-accessible sign-in endpoint and callback on the configured origin. Vercel Authentication or deployment protection can intercept those requests before the function runs. Steam cannot attach a Vercel bypass header to its redirect. A successful authenticated `vercel curl` check therefore does not prove that visitors can complete Steam login.

Inspect the preview project's protection before testing Steam. If public callback access requires a project-level change, review that exact setting first. Do not disable team protection or broaden other projects. Keep the sign-in target, callback URL, and browser origin identical.

See [Vercel deployment protection](https://vercel.com/docs/deployment-protection) and [Steam browser authentication](https://partner.steamgames.com/doc/features/auth#website).

## Verification and release boundary

Before creating a preview, run `npm run check` and `npm run test:e2e`. `tests/vercel.test.ts` checks origin selection and API exclusion from the SPA fallback. Those local checks do not prove Vercel's deployed route resolution or Neon connectivity.

After preview deployment, verify the following on its actual origin:

1. The editor and a direct code link load with their static assets.
2. `/api/session` returns JSON, and an unknown `/api/` route does not return the SPA.
3. Steam sign-in redirects to Steam Community with the exact preview callback URL.
4. A real sign-in creates a secure session and returns to the originating editor or Library view.
5. A favorite saved in one signed-in browser appears in another signed-in browser for the same Steam account. A different account cannot access it.
6. Guest favorites remain local until the user chooses to add them. Drafts, history, aliases, and display preferences stay local.
7. Logout ends access to the private account library. Pending saves and retry remain truthful during network failure.

Report real Steam sign-in and two-browser persistence separately from mocked browser tests. Keep the preview URL and verification evidence for review. Changing `delli.cc` or assigning production domains requires a separate reviewed release stage.

## Configured hosting and verification

The `softhe` team owns the `delli-crosshair` project. Its Vercel production address is https://delli-crosshair-five.vercel.app. The `delli-crosshair-preview` Neon resource is connected only to Preview and Development. The separate `delli-crosshair-production` resource is connected only to Production. Both schemas have been migrated. Local environment and protection-bypass files are ignored by Git and deployment uploads.

Production uses `PUBLIC_ORIGIN=https://delli.cc`. Preview derives its origin from `VERCEL_URL`. The existing `delli.cc` DNS and GitHub Pages deployment are unchanged.

Runtime imports inside `server/` and `api/` use `.js` extensions so the emitted Node functions resolve them. Explicit Steam sign-in, callback, and logout route files cover nested API paths alongside the shared catchall adapter.

Verification completed with 45 unit/server/config tests, 142 desktop/mobile browser tests, real Neon concurrency and isolation checks, and hosted browser-to-API-to-Neon save/update/read/logout checks across separate browser contexts. Hosted authenticated checks use synthetic test sessions and clean up their exact fixture rows. They do not prove a completed real Steam login. The real Steam redirect and callback origin are checked; a human Steam sign-in remains to be verified.

Run `npm run verify:vercel-preview` with the preview database environment and an ignored `.tools/preview-bypass.json` file containing the scoped automation secret. Never expose this file or secret. For a different deployment, set `PREVIEW_ORIGIN` and load its matching database environment explicitly.


## Main branch release and custom domain

The main branch now targets Vercel through its GitHub integration. GitHub Actions remains the verification workflow; automatic GitHub Pages publishing is retired to avoid competing releases. Historical Pages configuration remains recoverable from Git history. The public custom domain is `delli.cc`. Cloudflare DNS must complete the Vercel Domain Connect change before the domain can serve this backend. After DNS verification, production `PUBLIC_ORIGIN` must be updated to `https://delli.cc` and the production deployment rebuilt. Verify the session API and Steam callback on the custom domain before declaring cutover complete.


Custom-domain cutover completed on 2026-10-15. Cloudflare Domain Connect replaced the four GitHub Pages apex A records and one apex AAAA record with the project-specific Vercel CNAME and added its verification TXT record. Vercel verified the domain. Nameservers and unrelated records were retained. Public production origin is now `https://delli.cc`.
