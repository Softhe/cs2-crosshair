# Private library and Steam sign-in

This contract covers the editor, the personal Library view, and optional synchronization. Steam sign-in identifies the owner of a private library. It does not publish crosshairs or provide storage for this website.

## Editor and library behavior

- The always-visible code field shows the current encoded crosshair while no import draft is pending. Pasting a valid current CS code applies it immediately. Invalid input leaves the applied settings unchanged and displays a useful error. Config commands, files, and legacy conversions require an explicit import or conversion action.
- Library is a primary page in the studio. It contains saved favorites and a separate recent-history section. Selecting an entry shows a read-only preview. Copying its code does not load it into the editor. Loading is an explicit action.
- A favorite has a stable ID, a name or player nickname, and validated settings. Favorites remain until the user removes them. History eviction must never remove favorites.
- Saving creates a favorite. After loading a favorite and editing it, Update changes that favorite and Save as new creates a separate entry. Editing the draft alone never changes the saved entry. The original must survive Save as new.
- Guest favorites stay available without an account. Draft settings, recent history, appearance, display estimates, aliases, and feedback remain local to the browser.

## Synchronization boundaries

Only private favorites synchronize. The server stores each favorite's ID, name, and settings plus the metadata required to detect concurrent changes and deletions. It does not receive drafts, history, aliases, display preferences, or feedback.

Signing in must not silently upload a guest library. Offer an explicit choice to merge local favorites into the account library. Retain the guest data until that merge has succeeded. Keep account caches separate so signing out or switching accounts does not disclose the previous user's library.

A failed save remains pending locally and the UI must distinguish that state from a completed server save. Retrying sends the pending changes again. Concurrent writes use a server revision. An HTTP 409 is a conflict to reconcile, not permission to overwrite another device's changes. The local queue retains the last server snapshot and pending entries. Comparing that baseline with local and remote records identifies additions, edits, and deletions. Concurrent edits preserve both versions when they cannot be combined safely.

## Authentication and server contract

Valve documents Steam browser sign-in as [OpenID 2.0](https://partner.steamgames.com/doc/features/auth#website). The site redirects the browser to Steam Community, verifies the returned assertion, and receives a SteamID. The [Steam OpenID provider documentation](https://steamcommunity.com/dev) specifies the provider and claimed-identity format. Basic OpenID authentication does not require a Steam Web API key.

The backend verifies the provider, assertion, return URL, and nonce before creating a session. Library authorization derives the owner from that session, never a SteamID sent by the frontend. Sessions use secure HttpOnly cookies in production, and mutations require CSRF protection. Database queries must constrain every favorite read and write to the authenticated owner.

Nickname and avatar enrichment is separate. Valve's [GetPlayerSummaries](https://partner.steamgames.com/doc/webapi/ISteamUser#GetPlayerSummaries) requires a Web API key. [Standard user keys](https://partner.steamgames.com/doc/webapi_overview/auth) are distinct from publisher keys. Optional enrichment uses the site's server-side key; visitors never need to provide one. Do not put API keys or session secrets in a Vite bundle.

The application API consists of session inspection with a CSRF token, Steam sign-in, POST logout, and private-library GET/PUT operations. A library PUT supplies the last observed revision and validated entries. The backend returns the new revision, rejects unauthenticated or foreign-owner access, and returns HTTP 409 for stale revisions.

## Running and deployment

The existing GitHub Pages workflow serves a static build. GitHub Pages cannot execute this application's authentication callbacks or database API. Account synchronization requires a backend deployment. Local development uses the Vite frontend on port 4180 and the Node/SQLite backend on port 4181, with frontend requests proxied to the backend.

For local development, start the backend in a PowerShell terminal:

```powershell
$env:PUBLIC_ORIGIN = 'http://127.0.0.1:4180'
npm run api
```

Run `npm run dev` in a second terminal and open `http://127.0.0.1:4180`. Keep the browser host spelling consistent with PUBLIC_ORIGIN. For a single-server local preview, run `npm run build`, set PUBLIC_ORIGIN to `http://127.0.0.1:4181`, and run `npm start`. That server serves both the built frontend and the API.

Run `npm run check` for unit/server checks and the production build. Run `npm run test:e2e` for browser verification, including the explicitly mocked account API tests.

Production should serve the frontend and API behind one HTTPS origin, with a persistent SQLite database and a Steam callback URL matching that origin. The backend stores hashed random session tokens in SQLite. Protect the database and its backups because they contain account libraries and session records. Back up the database and test restoration before accepting live account data. Static-only deployments must retain guest editing and storage while clearly reporting that account synchronization is unavailable.

No account creation, credential provisioning, DNS changes, or production deployment is part of the browser verification tests.

## Verification scope

`e2e/library-sync.spec.ts` verifies frontend behavior with explicit API route mocks. It covers immediate current-code import, invalid-input preservation, Library navigation, copy and read-only selection, update versus Save as new, guest merge consent, and pending-save retry. Mocked sessions and responses do not prove a real Steam login, production cookie behavior, database durability, or cross-device service availability. Those require separate backend and deployed-environment checks.
