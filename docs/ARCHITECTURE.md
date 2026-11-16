# Architecture

The site is a static React and TypeScript application built with Vite. The editor runs entirely in the browser. An optional same-origin API (`server/`, deployed as Vercel Functions under `api/`) provides Steam sign-in and private library sync; see [library sync](LIBRARY_SYNC.md).

### Frontend (`src/`)

| File | Responsibility |
| --- | --- |
| `main.tsx` | App shell: wires state hooks to the header, editor, library, dialogs and file inputs; exports; view in the URL |
| `startup.ts` | Initial settings from a link or the saved draft, file downloads, error messages |
| `useToast.ts` | The single notification toast and its auto-dismiss timing |
| `usePreviewState.ts` | Preview controls (map, zoom, motion, game-view matching) and fullscreen |
| `useFavorites.ts` | Saving, updating and loading library entries; save-panel sync wording |
| `useImport.ts` | Share-code, link, legacy-command and config imports |
| `useUndo.ts` | Grouped undo history for crosshair edits |
| `components/` | Header, toast, save panel, import bar, map preview, settings list, dialogs, export card, game-view options |
| `LibraryView.tsx`, `SteamAccount.tsx`, `LegacyConverter.tsx` | Library view, Steam account menu, legacy converter panel |
| `model.ts` | Settings, validation, style visibility, presets, config commands, and aliases |
| `codec.ts` | Current and legacy share-code decoding, encoding, and config parsing |
| `converter.ts`, `vendor/sicc/` | Legacy CS:GO conversion using vendored MIT code |
| `config-export.ts` | Downloadable `.cfg` files with alias shortcuts |
| `Preview.tsx` | Canvas lifecycle, animated scheduling, and cached geometry/scale guards |
| `preview-geometry.ts` | Crosshair geometry, visual-settings extraction, and motion eligibility |
| `preview-renderer.ts` | Analytic coverage rasterizer (pixel-snapped rects and outlines, supersampled curves), compositing, and fit scaling |
| `preview-motion.ts` | Synthetic dynamic spread and its animation cap |
| `display.ts` | Preview magnification mapping and the monitor-size estimate |
| `storage.ts` | Local preferences and validated library entries |
| `library-backup.ts` | Library backup export and validated merge on restore |
| `library-sync.ts` | Steam library sync: offline queue, revisions, three-way merge, retries |
| `preferences.ts`, `preference-sync.ts` | Account-synced preview preferences (validated on both client and server) |
| `clipboard.ts` | Clipboard writes, readback when already permitted, and copy fallback |
| `ids.ts` | Random entry ids |
| `*.css` | Theme, layout, editor and account styles |

### Server (`server/`, `api/`)

| File | Responsibility |
| --- | --- |
| `server/app.ts` | Request handler: Steam OpenID sign-in, sessions, CSRF, rate limits, library and preference API, local static files |
| `server/security-headers.ts` | CSP and other response headers (mirrored in `vercel.json`) |
| `server/store.ts` | Storage interface |
| `server/neon-store.ts`, `server/sqlite-store.ts` | Postgres (Vercel) and SQLite (local) storage |
| `server/index.ts` | Local Node server entry point |
| `api/` | Vercel Function entry points that reuse `server/app.ts` |

Settings use convar names as keys. The model validates imported values before the editor loads them. The current share-code protocol carries 24 fields. Configs and full website links preserve 42 settings, including compatibility fields for grenade and sniper preferences. Those preferences have no editor sections.

Current codes are checksummed 32-byte payloads encoded with a `CS` prefix. Unknown versions and reserved bits are rejected. See [the protocol](PROTOCOL.md) for the byte layout and game probes.

The canvas draws around one center point at the crosshair's own resolution (one unit is one game pixel) and scales the geometry for preview zoom. Odd thicknesses use the exact half-thickness so dots and outer shapes remain concentric. Dynamic motion is synthetic and does not affect exported settings.

Browser storage uses keys beginning with `delli.v3.`. Backups are validated JSON. The app does not evaluate imports, feedback, names, or aliases as scripts. Aliases and filenames have restricted character sets.

On Vercel, every path outside `/api` is rewritten to `index.html`, so legacy `/CS...` path links load with HTTP 200. The build also copies `index.html` to `404.html`; only a GitHub Pages rollback uses it. New links use query parameters at `/`.
