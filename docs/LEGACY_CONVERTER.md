# Legacy conversion

Use the always-visible **Import a crosshair** box above the preview. Paste an old version-1 `CSGO-` code or pre-update console settings, and expand **Convert old settings to a new CS code**. Set the old reference height and new game height, then convert. Copy the new `CS` code or load it into the editor. Changing the input or heights hides the previous result until conversion runs again.

The default goal preserves estimated pixel size at rest. Old styles 2, 3 and 5 export as Static Cross. Old default styles 0 and 1 are blocked. Unspecified old config values use the upstream pre-update defaults and are reported in warnings. Conversion preserves unrelated editor preferences. Normal version-1 code import uses the same conversion engine; current CS codes and September version-3/4 codes keep their existing decode paths.

The solver is the community-static-v6 reconstruction from [Small Indie Crosshair Company](https://github.com/sebastianspicker/small-indie-crosshair-company), pinned to commit `29a3c215de41a95eb3377eedf9eb156dbc55fcaa`. Its runtime dependency closure is retained unchanged in `src/vendor/sicc`. No remote service, player corpus, training artifacts or game code is required. The wrapper uses the upstream parser, solver, warnings and native command export, then our existing encoder generates the current share code.

This model is not native-validated. Its reported target build is 2000922; the upstream forward equations remain unverified across the renderer rewrite. Matching reconstructed pixels does not establish an in-game match. Browser preview geometry also remains approximate. Check the converted code in CS2.

## Further improvements worth considering

1. Add old, directly assigned, and converted pixel plates with dimension labels and a difference overlay. Upstream `lib/geometry/community.js`, `lib/geometry/raster.js` and `lib/solver/community.js` separate target geometry from predicted geometry. This would make rounding and centering changes visible, rather than relying on a single editor preview.
2. Add a game-capture calibration workflow. Upstream `lib/image/` and `lib/solver/observations.js` provide measurement and build-specific evidence patterns. Use paired game captures at recorded resolutions to test our gap, odd-width centering and half-outline placement before changing the main renderer.
3. Add a per-setting conversion table and downloadable report. Upstream `lib/settings/outcomes.js` tracks converted, approximated, assumed, dropped and ignored values. We currently expose warnings, but a table would make losses easier to inspect. Keep model overlap separate from in-game confidence.
4. Run conversion in a worker if larger searches or image fitting are added. The upstream app uses a worker so conversion does not block interactions. The current explicit-button path runs the pinned finite search synchronously; avoid recomputing it on every keystroke.

## Notices

Vendored code is MIT licensed, Copyright (c) 2026 Small Indie Crosshair Company contributors. The legacy codec derives from AkiVer's csgo-sharecode, Copyright (c) 2017-present AkiVer. The read-only current-code decoder follows patriQ's cursed-crosshair-generator layout, Copyright (c) 2026 patriQ. Required full license notices are shipped in `public/licenses/sicc/` and therefore in the built site. These licenses do not cover Valve assets or trademarks.
