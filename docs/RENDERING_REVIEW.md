# Crosshair live-preview rendering review

Reviewed October 4, 2026 against the current local source.

This report describes the pre-fix implementation and baseline probes. See [Rendering fixes and verification](RENDERING_FIXES.md) for the subsequent changes and current limitations.

## Assessment

Keep Canvas 2D. This renderer draws a small number of shapes, shares the same component across the editor and thumbnails, keeps map images outside the canvas, and stops its animation loop when unmounted or when dynamic mode stops. A WebGL rewrite would add complexity before the existing correctness issues have been resolved.

The most useful improvements are predictable pixel alignment, explicit resolution semantics, separate color and outline compositing, reliable redraws after display changes, and a preview that remains usable at large spread values. The current renderer is an approximate visual editor. Share-code round trips and passing UI tests do not establish agreement with game pixels.

No application rendering code was changed during this review. Added this report, a repeatable browser probe script, and its JSON results.

## Scope and evidence

Reviewed `src/Preview.tsx`, `src/preview-motion.ts`, settings and callers in `src/model.ts` and `src/main.tsx`, canvas/container CSS in `src/style.css`, unit and browser tests, the existing patch audit, and the local reconstructed shader in `research/crosshair.slang`.

The shader is supporting research evidence with opaque reconstructed variable names. It does not supply the CPU-side parameter construction or prove how each setting maps to geometry. Findings below do not depend on copying its implementation.

Validation completed:

- `npm run check`: all 15 unit tests passed, TypeScript passed, production build passed.
- `npm run test:e2e`: all 60 Chromium cases passed across the desktop and mobile projects.
- `npx tsx scripts/audit-preview.ts`: completed targeted canvas probes at a desktop viewport of 1440 by 1000. The actual main canvas was 850 by 256 CSS pixels. Most probes used DPR 1; the display-change probe changed DPR to 2 without changing CSS dimensions.

Saved results are in `docs/evidence/rendering-review/probes.json`. Run `npm run dev` first, then the probe command in another terminal. The script uses an isolated browser context and changes only that context's state. Selected dynamic probes replace the callback timestamp with `550 * Math.PI` to sample the synthetic wave at its exact peak. These are diagnostic probes, not a benchmark or an automated pass/fail regression suite.

No live game screenshot calibration was performed in this review. Browser behavior was verified in Chromium; Firefox, Safari, actual monitor transitions, and GPU performance remain unverified. This folder has no Git metadata, so the review covers the current files rather than a commit diff.

## Priorities

| ID | Priority | Improvement | Evidence |
| --- | --- | --- | --- |
| R1 | High | Define and implement pixel alignment for thin rectangles | Reproduced raster output |
| R2 | High | Separate shape coverage from color/outline compositing | Reproduced alpha accumulation and opaque interiors |
| R3 | High | Define reference-height and preview-scale behavior | Current code and identical output measurements |
| R4 | Medium | Redraw static canvases when DPR changes | Reproduced stale backing dimensions |
| R5 | Medium | Warn about clipping and offer an explicit fit view | Reproduced default dynamic clipping |
| R6 | Medium | Make motion deterministic and skip unchanged frames | Reproduced redundant draws and source analysis |
| R7 | Medium | Calibrate style-specific geometry and control response | Confirmed formulas and collapsed input ranges; game comparison pending |
| R8 | Medium | Separate geometry, raster drawing, and React lifecycle | Source maintainability and testability |
| R9 | Medium | Add raster and lifecycle regression coverage | Existing tests pass despite reproduced issues |
| R10 | Low | Improve mode typing, context handling, and accessible descriptions | Source robustness |

High means a user can misjudge the appearance or size of the selected crosshair. Medium means a reliability, usability, or maintenance improvement. These priorities are not security severity ratings.

## R1. Thin rectangular shapes lose their intended opacity

Location: `src/Preview.tsx:15`, `:22`, `:26`, `:54`.

The canvas origin is an integer CSS coordinate, while rectangular geometry uses `thickness / 2`. At thickness 1, a center dot occupies `[-0.5, 0.5]` on both axes. Its edges cross pixel boundaries at DPR 1.

The probe used Dot Only, thickness 1, no outline, and foreground alpha 255. The dot occupied four backing pixels, each with a maximum alpha of 64. A nominally opaque one-pixel dot therefore appears faint and spread across a two-by-two area at 1x. The existing centering test confirms relative concentricity but does not check opacity or sharpness.

Improvement:

- Define a raster policy for rectangular arms and dots. Snap their edges to the chosen pixel grid so odd and even thicknesses have intentional coverage.
- Define the center convention explicitly for odd and even canvas sizes. A sharp odd-width shape and an even-width shape cannot always share the same exact geometric center on a device-pixel grid.
- Decide whether magnified preview enlarges a reference raster with nearest-neighbor sampling or redraws vector geometry. Today zoom enlarges geometry, which can change apparent edge coverage.
- Keep circle and arc antialiasing as a separate policy. A blanket half-pixel translation for every style and DPR would create other alignment errors.

Acceptance: test opaque dots and arms with thickness 1, 2, and 3 at preview zoom 1, 2, 4, and 8; DPR 1, 1.25, 1.5, and 2; and odd/even container dimensions. Check alpha, dimensions, and documented center behavior. Compare the final policy with game captures before claiming fidelity.

## R2. Opacity depends on overlap and outline paint order

Location: `src/Preview.tsx:23-31`, `:43-54`.

Each rectangle paints its expanded outline, then its foreground. The outline covers the rectangle interior as well as its border. Shapes use the default Canvas source-over composition independently.

Measured with a static cross, thickness 2, length 8, and foreground alpha 128:

| Configuration | Measured maximum alpha |
| --- | --- |
| Gap 0, no outline | 192 |
| Gap -4, no outline | 240 |
| Gap 0, opaque full outline | 255; every occupied pixel was fully opaque |

At zero gap, perpendicular arms overlap near the center. Negative gap increases overlap. Source-over painting accumulates alpha, so overlapping foreground becomes more opaque than a single arm. An opaque outline under a transparent foreground makes its interior opaque too. Subsequent outlines can also cover previously painted foreground near touching shapes.

This output is confirmed. The desired CS2 compositing rule still needs controlled game comparison. The reconstructed shader at `research/crosshair.slang:373-405` appears to select maximum foreground and outline coverage separately before final composition. That is evidence worth investigating, rather than proof of all game behavior.

Improvement: represent foreground coverage and outline coverage separately. Combine same-layer coverage according to a documented rule, then apply each layer's RGBA once. Decide explicitly whether outline coverage includes interiors or only a border. For equal-alpha shapes, combined paths may be enough; classic split segments with different alpha require a deliberate coverage rule. Simply painting all outlines before all foreground shapes fixes some ordering artifacts but does not solve repeated-alpha accumulation.

Acceptance: pixel samples at isolated arms, touching arms, overlapping arms, and center-dot intersections; foreground and outline alpha 0, 128, and 255; full/half/no outline; classic inner and outer split alpha. Include foreground color checks, not only occupied bounding boxes.

Canvas source-over behavior is documented by [MDN's compositing reference](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation).

## R3. Reference height does not affect rendering

Location: `src/Preview.tsx:15-22`, `src/main.tsx:83`, `src/model.ts:20`.

`cl_crosshair_screen_height` is stored, encoded, and displayed in the preview caption, but the renderer never reads it. Probes with reference heights 1080 and 2160 produced identical occupied bounds, counts, and alpha statistics for the same crosshair.

The current scaling chain is settings geometry in CSS pixels, multiplied by preview zoom, rasterized into a DPR-scaled backing canvas. DPR improves backing density; it does not establish a game-resolution scale. The canvas panel height is also not the game framebuffer height.

Improvement: define two explicit meanings if both are useful:

- An editor view in CSS pixels with clearly labeled magnification.
- A calibrated target-resolution view with a selected game framebuffer height and a documented mapping from reference height to target pixels.

A candidate scale is `targetGameHeight / referenceHeight`, multiplied by editor magnification. Verify this against current game output before adopting it as exact. Decide how target physical pixels map into CSS pixels at non-unit DPR and browser zoom. Do not substitute the preview panel height or monitor CSS screen height for the game resolution.

Until calibration exists, label the current view as CSS-pixel magnification and describe reference height as exported metadata. The current caption gives the number without explaining that it has no visual effect.

Acceptance: a fixed configuration captured at 1080p, 1440p, and 2160p in the game, with known reference heights and display scaling. Compare output bounds, center, outline, and pixel coverage. Treat browser zoom and OS scaling as separate variables.

The distinction between physical and CSS pixels, including browser zoom effects, is documented by [MDN's DPR reference](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio).

## R4. Static previews remain at the previous DPR

Location: `src/Preview.tsx:10-13`, `:58-60`.

DPR is read only inside `draw()`. Static mode redraws on settings changes and CSS-size changes. A DPR change with unchanged CSS dimensions does not trigger either condition.

The probe changed DPR from 1 to 2. The main canvas remained 850 by 256 backing pixels while `window.devicePixelRatio` reported 2. Clicking a zoom control triggered a redraw and changed the backing dimensions to 1700 by 512. This reproduces the stale-resolution condition through browser emulation.

Improvement: subscribe to resolution changes and invalidate static canvases. A `matchMedia` resolution query can be renewed whenever DPR changes. Use the same invalidation path for resize, settings, and display changes, with one scheduled draw for multiple notifications. MDN provides this renewal pattern in its [DPR change example](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio#monitoring_screen_resolution_or_zoom_level_changes).

Acceptance: change DPR without changing CSS dimensions, check backing dimensions and visual size, then repeat for preset and saved-crosshair canvases. Verify cleanup removes listeners.

## R5. Default dynamic spread clips outside the panel

Location: `src/preview-motion.ts:4`, `src/Preview.tsx:20-22`, `:50-52`, map preview CSS.

Style 7 defaults to a spread limit of 255. At peak synthetic motion the main preview's occupied bounds reached y=0 and y=255 in its 256-pixel-tall canvas. The radius calculation reaches 261 before accounting for stroke and outline. Much of the shape extends beyond the panel, including the top and bottom arms. Higher zoom makes clipping worse.

This is a usability problem even if geometry is accurate. Users can interpret a clipped crosshair as a disappearing or broken crosshair. Large static length/gap settings and small library thumbnails have the same risk.

Improvement: calculate complete drawing bounds, including outline, dot, and recoil displacement. Show a clipping indication when the shape exceeds the viewport. Offer a separate fit view with a visible effective scale. Preserve the configured spread limit and explicit 1x behavior; do not silently cap settings or auto-scale a view labeled 1x. Add a controlled spread slider so users can inspect intermediate states.

Acceptance: maximum supported length, gap, thickness, spread, outline, recoil, and zoom on desktop and mobile. Verify clipping warnings and that fit scale does not change exported settings.

## R6. Motion starts at an arbitrary phase and redraws unchanged content

Location: `src/Preview.tsx:19-21`, `:56-60`, `src/preview-motion.ts:4-5`.

Motion uses the animation-frame timestamp directly. The first frame depends on how long the document has existed, so pressing Start does not reliably begin at rest. The synthetic wave has a period of approximately 3.46 seconds. Scope mode receives the same recoil transform when recoil is enabled, even though the motion description is not mode-specific.

With static style 4 and recoil off, dynamic mode still cleared and redrew the canvas 15 times during a 250 ms probe. Scope mode with recoil off did the same. Neither output changes. Dynamic spread is integer-rounded, so many frames in genuinely dynamic modes also repeat the same geometry.

Improvement:

- Store a local animation start timestamp and derive elapsed time from it.
- Expose a deterministic phase or motion state to the drawing function for tests and an inspectable preview slider.
- Run the frame loop only when the current mode has visible animated output. Skip drawing when quantized geometry and appearance have not changed.
- Stop work while the canvas is offscreen or covered by a modal if the product behavior permits it. Browsers generally pause RAF in hidden tabs, so focus additional work on visible tabs with offscreen previews.
- Define reduced-motion behavior for this explicitly started simulation. Existing CSS disables transitions but cannot affect the JavaScript canvas loop. A static phase control would be a useful alternative.

Acceptance: Start begins at the documented phase, Stop cancels frames, mode changes preserve the chosen phase policy, static/no-recoil mode has no continuous drawing, and reduced-motion/offscreen policies work. The draw counts above show avoidable work, not a measured frame-rate bottleneck.

RAF timing and background-tab behavior are documented by [MDN's animation-frame reference](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame).

## R7. Several style formulas need calibration and input-response tests

Location: `src/Preview.tsx:22`, `:30`, `:38`, `:41-52`.

Confirmed implementation behavior:

- Gap uses `Math.round(gap / 2)`. Adjacent settings often produce identical geometry. Negative odd values have JavaScript's asymmetric rounding behavior. For example, gap -1 maps to zero, while gap 1 maps to one.
- Static Circle clamps its radius to at least one. With thickness 2, gaps -10 and 0 produced identical measured output. Static Square likewise clamps negative radius to zero.
- Scope dot diameter is `max(1, scale * 3)`. Probe scales 0.1 and 0.3 both produced radius 0.5. The entire allowed range below roughly one third has no visual response.
- Dynamic Circle uses a fixed base radius of 4 plus half thickness and spread. At spread limit 64 and peak phase, the measured arc radius was 69. This branch adds spread once; there is no double-spread bug here.
- Dynamic Quadrant combines cross arms with four arcs, using a hardcoded arc ratio of 0.65. Its relationship to game quadrant geometry is not established.
- Half outlines shift arc centers by -0.5 and use asymmetric rectangle expansion. These heuristics need comparison across thickness, radius, and zoom.
- Classic split begins only when synthetic spread exceeds split distance; synthetic classic spread has a maximum of 12. Split distances of 12 or greater therefore never split in this simulation, although the setting permits values through 127.

These are confirmed formulas and control-response limitations. Their disagreement with CS2 is not established without captures. Current local settings permit negative gap for every style that has a gap; this differs from older memory notes and should not be changed during a rendering review based on those notes.

Improvement: build a calibration matrix for all ten styles and record which formulas are calibrated versus approximate. Capture both sides of split thresholds, negative and zero gaps, scope dot extremes, T style, and each outline mode. Provide an explicit split-state preview when synthetic motion cannot exercise a setting. Remove minimum-size clamps only after defining intended subpixel coverage.

Acceptance: each visible control has a documented visual response or documented constraint. Keep tests for expected plateaus where game rasterization requires them. Do not infer game behavior solely from setting names.

## R8. Extract geometry and drawing from the React effect

Location: the entire `src/Preview.tsx` effect.

One effect currently owns resize observation, animation scheduling, display scaling, recoil, style dispatch, geometry, and painting. The code is compressed into long lines, and local drawing functions are recreated per frame. Settings are an unrestricted numeric record, so renderer requirements are not explicit.

Improvement: use a small separation with concrete responsibilities:

1. A pure geometry function accepts rendering settings, preview mode, and explicit motion state. It returns rectangles/arcs, opacity groups, and complete bounds.
2. A Canvas drawing function applies the chosen raster policy, compositing, scale, and viewport transform.
3. The React component manages context acquisition, settings updates, resize/DPR notifications, and scheduling.

Use a narrowed rendering-settings type and a mode union. Preserve shared drawing behavior across the main preview and thumbnails. Keep latest settings in a ref or another intentional update path so changing unrelated export/spectator settings does not rebuild observers and restart the effect. Start with one renderer, not a plugin system or one class per style.

Acceptance: geometry can be tested without a browser; the drawing function accepts a fixed phase; lifecycle changes do not alter geometry unexpectedly; existing share-code and UI tests continue to pass.

## R9. Current test coverage misses the reproduced defects

Location: `e2e/preview-centering.spec.ts`, `e2e/studio.spec.ts:65`, `tests/core.test.ts`.

The centering test compares the midpoint of occupied bounds for dot, circle, and square. A blurred shape can pass. It does not assert opacity, expected width, physical center, or raster sharpness. Default desktop/mobile browser contexts do not create a fractional-DPR raster matrix. Dynamic workflow tests check controls and accessible labels rather than rendered states.

Add focused regression coverage alongside each fix:

- Thin-dot and arm coverage, including expected alpha and rectangular edge alignment.
- Foreground/outline composition and overlapping negative-gap shapes.
- Static DPR changes and resize during motion.
- Deterministic dynamic phases, split threshold behavior, recoil transforms, and clipping bounds.
- Reference-height scaling once calibrated.
- Scope scale response and quadrant/half-outline calibration cases.

Use exact pixels for intentionally hard rectangular edges, and suitable tolerances for antialiased arcs. Compare isolated crosshair canvases so map JPEG/WebP content and controls cannot hide differences. Record browser/version/DPR for golden images. Store real game calibration captures separately from browser regression expectations, with settings, game build, framebuffer resolution, and scaling metadata.

## R10. Small robustness and accessibility improvements

Location: `src/Preview.tsx:5`, `:8`, `:33-38`, `:61` and its callers.

`getContext('2d')!` assumes context acquisition succeeds. Independent `scope` and `sniper` booleans permit contradictory combinations, with sniper silently winning. The sniper branch has no current editor selector or caller enabling it. The canvas has an image role and label, but that label does not describe selected style, scale, clipping, or simulation status.

Improvement: handle a missing context with readable fallback text; use `mode: 'crosshair' | 'scope' | 'sniper'`; either test the dormant sniper mode or remove it from this component until needed. Connect the main preview to a concise accessible description of style, magnification, and simulation/clipping status. Decorative preset thumbnails can avoid repeatedly announcing the generic live-preview label when their buttons already have names.

If the component becomes reusable outside current trusted callers, validate finite positive zoom and finite viewport values at its boundary. Current UI zoom values are controlled, so this is defensive design rather than a reproduced user-facing failure.

## Recommended implementation sequence

1. Define raster center, zoom, and alpha-composition semantics. Add failing pixel regressions for R1, R2, and R4. Extract only the code needed to make these changes testable, then fix them.
2. Add complete geometry bounds, clipping status, optional fit scale, deterministic motion, and animation eligibility. Preserve exported settings throughout.
3. Calibrate reference-height scaling and style geometry using controlled game captures. Update labels and formulas only where evidence supports them.
4. Extend regression coverage across DPR and container-size cases, and then measure rendering cost on representative hardware. Consider dirty-region clearing or cached geometry only if profiling shows a useful benefit.

Full-canvas clearing costs grow with backing area and refresh rate, but this review did not measure a performance bottleneck. OffscreenCanvas, workers, WebGL, bitmap caches, and a global animation scheduler are premature without profiling. The largest immediate gains are accurate appearance, reliable invalidation, and avoiding draws that cannot change the image.
