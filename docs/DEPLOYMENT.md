# Deployment and rollback

Vercel serves the frontend and private Steam/library API. The production branch is `main`. See [Vercel and Neon deployment](VERCEL_DEPLOYMENT.md) for custom-domain cutover and environment configuration. The historical `public/CNAME` and the `404.html` copy made by `scripts/pages-fallback.mjs` are kept only so a GitHub Pages rollback still works; Vercel uses neither.

Pull requests run a server/API formatting check, unit tests, TypeScript checks, a production build, and the desktop/mobile browser suite. Pushes to `main` run the same checks. GitHub Actions verifies the source, while the connected Vercel Git integration builds production deployments. Inspect both statuses before treating a release as verified.

After deployment, open the homepage and verify an edited code, a config download, and a query-based share link. Check the Vercel deployment and GitHub verification results separately from the domain's DNS and HTTPS state. A successful deployment does not prove a custom-domain certificate is healthy.

## Routes

| Route | Behavior |
| --- | --- |
| `/` | Editor and local draft |
| `/?code=CS...` | Current share-code link |
| `/?crosshair=CS...` | Compatibility query |
| `/?code=CSGO-...` | Legacy code import |
| `/CS...` or `/CSGO-...` | Legacy path import; the Vercel rewrite serves the editor |
| `/custom` | Normalize to `/`, preserving query and hash |
| Other paths | Client not-found view |

On Vercel, every non-`/api` path is rewritten to `index.html` with HTTP 200, so legacy path links work. Unknown paths show the client's not-found view. Use query links for new shares.

## Security headers

Every page and API response carries a Content-Security-Policy (same-origin scripts, styles, fonts, media and requests; no framing), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: same-origin`, a restrictive `Permissions-Policy` and HSTS. The list lives in `server/security-headers.ts`; `vercel.json` repeats it for the deployed site, and `tests/vercel.test.ts` fails if the two differ. `vite preview` and the local Node server apply the same list, so the browser suite runs under the production CSP. The Vite dev server does not, because hot reload needs inline scripts.

## Rollback

The replacement preserves the previous commits. To undo it, revert its commit in a new commit and push the revert to `main`. Vercel will deploy the reverted source. A hosting rollback to GitHub Pages also requires restoring its publishing workflow and changing Cloudflare DNS back to the previous provider. Preserve Neon data when rolling back frontend code. Do not reset or force-push shared history for a routine rollback.

A local Git bundle of all pre-replacement refs was also saved beside the replacement checkout. It is an extra recovery copy and is not uploaded to GitHub.
