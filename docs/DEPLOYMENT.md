# Deployment and rollback

Vercel serves the frontend and private Steam/library API. The production branch is `main`. See [Vercel and Neon deployment](VERCEL_DEPLOYMENT.md) for custom-domain cutover and environment configuration. The historical `public/CNAME` and static fallback remain available for recovery.

Pull requests run unit tests, TypeScript checks, a production build, and the desktop/mobile browser suite. Pushes to `main` run the same checks. GitHub Actions verifies the source, while the connected Vercel Git integration builds production deployments. Inspect both statuses before treating a release as verified.

After deployment, open the homepage and verify an edited code, a config download, and a query-based share link. Check the Vercel deployment and GitHub verification results separately from the domain's DNS and HTTPS state. A successful deployment does not prove a custom-domain certificate is healthy.

## Routes

| Route | Behavior |
| --- | --- |
| `/` | Editor and local draft |
| `/?code=CS...` | Current share-code link |
| `/?crosshair=CS...` | Compatibility query |
| `/?code=CSGO-...` | Legacy code import |
| `/CS...` or `/CSGO-...` | Legacy path import through the Pages 404 fallback |
| `/custom` | Normalize to `/`, preserving query and hash |
| Other paths | Client not-found view |

The 404 fallback loads the application but preserves the HTTP 404 response on path requests. Use query links for new shares.

## Rollback

The replacement preserves the previous commits. To undo it, revert its commit in a new commit and push the revert to `main`. Vercel will deploy the reverted source. A hosting rollback to GitHub Pages also requires restoring its publishing workflow and changing Cloudflare DNS back to the previous provider. Preserve Neon data when rolling back frontend code. Do not reset or force-push shared history for a routine rollback.

A local Git bundle of all pre-replacement refs was also saved beside the replacement checkout. It is an extra recovery copy and is not uploaded to GitHub.
