# Rendering fixes and verification

Implemented October 4, 2026. This document records the changes following `RENDERING_REVIEW.md`; the original review and baseline evidence remain available.

## Finding-to-change mapping

| Finding | Implemented change | Verification |
| --- | --- | --- |
| R1, pixel alignment | Rectangular edges snap to backing pixels, with positive widths rounded to at least one pixel. Curves retain antialiasing. Zoom redraws geometry rather than enlarging a bitmap. | Opaque dot/rectangle coverage across thickness 1, 2, 3, zoom 1, 2, 4, 8 and DPR 1, 1.25, 1.5, 2. Existing concentricity regressions remain. |
| R2, compositing | Foreground and outline coverage are computed separately. Same-layer overlap takes maximum coverage, including split alpha. Outline is a border rather than opaque paint below the foreground interior. | Alpha 128 stays 128 at zero and negative gap. Opaque outline preserves transparent foreground interiors. |
| R3, scale semantics | Default CSS-pixel mode is explicit. Optional estimated 1080p/1440p/2160p modes use target height divided by exported reference height, divided by DPR to convert target physical pixels to CSS pixels. Effective scale is displayed. | Reference heights 1080 and 2160 change estimated output size; preview selection leaves exported codes unchanged. |
| R4, DPR changes | Renewed resolution media-query subscription invalidates static backing canvases. Resize, settings and DPR updates share one scheduled redraw. | DPR changes from 1 to 2 resize the canvas without a settings edit. |
| R5, clipping | Geometry includes conservative bounds for outlines and recoil. Main preview reports clipping. Optional fit view reserves peak motion bounds and reports its effective magnification. Saved-library thumbnails use fit. | Peak default spread clips at 1x, is reported, and fits when requested. Preview controls do not change exports. |
| R6, motion | Local start timestamp begins at rest. Static/no-recoil styles, scope mode, and zero modern spread do not run continuous animation. Quantized repeated output skips raster drawing. Offscreen, hidden, modal-covered and reduced-motion states stop the loop. Manual inspection phase remains available. | Start at a large document timestamp, advance to peak, stop to the selected phase; static draw-count and reduced-motion regressions. |
| R7, formula response | Gap retains signed half-pixel geometry rather than asymmetric integer rounding. Scope-dot minimum clamp is removed. Scope does not inherit recoil. Classic split inspection can exercise split distances above the synthetic wave range. | Pure geometry tests cover signed half gaps, small scope sizes, recoil isolation, and forced split inspection. |
| R8, structure | Pure geometry and bounds live in `preview-geometry.ts`; coverage/raster painting lives in `preview-renderer.ts`; `Preview.tsx` manages lifecycle and scheduling. Rendering settings have explicit keys. Unrelated settings do not rebuild observers or invalidate output. Status callbacks fire only when displayed status changes. | TypeScript, unit tests and complete browser suite. |
| R9, regressions | Added `tests/preview.test.ts` and `e2e/rendering.spec.ts`, alongside the existing workflow and centering suites. | See final validation below. |
| R10, robustness/accessibility | A mode union replaces competing mode booleans. Removed the dormant sniper renderer. Context failure displays an export-safe fallback. Main canvas describes style/scale/simulation; thumbnail canvases are decorative. Preview announcements avoid interfering with the app's notification role. | Scope workflow, context failure, export and notification regressions. |

## Raster policy

Rectangular edges snap to physical backing pixels. A positive geometric dimension rounds to at least one backing pixel. Odd/even thickness and DPR can therefore move the apparent center by part of a pixel; this is an intentional compromise for sharp rectangular output. The existing dot/circle/square concentricity tolerance still applies. Fractional scope dots and curved edges use coverage antialiasing.

Foreground coverage is the maximum contribution of a foreground shape at each pixel. Outline coverage is also combined by maximum contribution, then foreground coverage is subtracted to retain only the border. Foreground and remaining outline RGBA are composed once. This prevents brighter or more opaque intersections and foreground interiors becoming opaque solely because the outline is opaque.

Coverage readback is restricted to visible drawing bounds. Non-overlapping quadrant arcs share one mask stroke and readback. Rendering signatures prevent repeated raster work when synthetic integer spread does not change. No new production dependency was added.

## Remaining calibration boundary

The requested engineering fixes are implemented, but exact CS2 rendering fidelity has not been established. Estimated resolution mapping, quadrant proportions, half-outline curves, and weapon spread/recoil are explicitly approximate. Circle and square interior radii still cannot be negative; their behavior for negative gap requires comparison with game output before changing the style semantics further.

Estimated resolution mode is a selectable sizing estimate, not a claim that OS scaling, browser zoom, and game rendering match automatically. Reference height remains exported metadata in CSS-pixel mode. Fit is a view adjustment and never edits settings.

To close calibration, capture the same settings in the game at known framebuffer sizes, recording game build, reference height, display scaling, and outline mode. Compare crosshair coverage, center, color, and bounds separately from backgrounds. Browser tests establish the chosen editor policy, not game parity.

## Validation and evidence

- Unit suite: 19 tests, including four new geometry/motion/bounds regressions.
- Production gate: TypeScript and Vite build.
- Browser suite: all 84 desktop/mobile Chromium workflows and rendering cases passed, including fractional-DPR coverage and deterministic motion starts.
- Visual verification: `docs/evidence/rendering-fixes/desktop-fit.png`, `desktop-scope.png`, and `mobile-fit.png`.
- Before/after raster probes: original `docs/evidence/rendering-review/probes.json` and new `docs/evidence/rendering-fixes/probes.json`.
- Rendering timings and browser errors: `docs/evidence/rendering-fixes/verification.json`.

Representative measurements on this host, Chromium 145, DPR 1, 850 by 256 backing canvas, 40 direct-render samples per view: native default dynamic geometry median 2.5 ms, p95 4.2 ms; fit geometry median 0.9 ms, p95 3.2 ms. No console or page errors were captured. These measure drawing cost in a headless browser, not complete animation-frame latency or a guarantee on other hardware, DPRs, or browsers.

Reproduce with `npm run dev`, followed in another terminal by `npx tsx scripts/audit-preview.ts` and `npx tsx scripts/verify-rendering.ts`. Run `npm run check` and `npm run test:e2e` for the regression suite.
