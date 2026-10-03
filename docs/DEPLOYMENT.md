# Deployment and rollback

GitHub Pages serves this repository at `https://delli.cc/`. Pages uses GitHub Actions. `public/CNAME` retains the custom domain, and Vite builds with the root asset path.

Pull requests run unit tests, TypeScript checks, a production build, and the desktop/mobile browser suite. Pushes to `main` run the same checks. Only a successful verification job can upload and deploy the `dist` artifact.

After deployment, open the homepage and verify an edited code, a config download, and a query-based share link. Check the Pages workflow result separately from the domain's DNS and HTTPS state. A successful deployment does not prove a custom-domain certificate is healthy.

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

The replacement preserves the previous commits. To undo it, revert its commit in a new commit and push the revert to `main`. The previous build workflow and source will return and Pages will redeploy them. Do not reset or force-push shared history for a routine rollback.

A local Git bundle of all pre-replacement refs was also saved beside the replacement checkout. It is an extra recovery copy and is not uploaded to GitHub.
