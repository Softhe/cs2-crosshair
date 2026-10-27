# Crosshair calibration and current-main integration

Updated October 27, 2026.

## Source baseline

The rendering work was resumed on `fix/game-crosshair-raster`. Current upstream main was `276a0b4`, including:

- `c16c960`, PR #18: analytic symmetric curve coverage, integer outline widths, fit scale reporting, layout changes and sync-rate-limit fixes.
- `5d955de`, PR #19: favicon assets.
- `276a0b4`, PR #20: automatic pasted-code and selected-file import.

The integration retains the newer coverage/compositing implementation and import behavior. Native raster magnification wraps that coverage implementation rather than restoring the older canvas-mask renderer.

## Implemented behavior

- New preview preferences default to an explicit 1080p game target. Presets, custom render height and optional monitor estimate remain separate from encoded crosshair settings. The browser cannot detect CS2's render resolution.
- Render at the selected native target before magnifying. Main zoom and the live 4x detail inset reuse the same raster frame. Integer magnification replicates pixels exactly, including alpha and outline coverage.
- The detail inset reports cropping and does not silently shrink a view labeled 4x. Fit can reduce main presentation scale. Extreme source dimensions have a bounded allocation limit and explicitly report incomplete source coverage.
- The measured nonnegative Static Cross path uses full gap units, independently rounded arm lengths and inner distances, and the captured odd/even center convention. Other styles and negative gaps retain their earlier approximate behavior.
- Current main's symmetric curve sampling and whole-pixel outlines are preserved.

## Game evidence

The lossless PNG window captures in `evidence/crosshair-calibration/` were collected through Computer Use during the October 25 session. The game was CS2 1.41.9.2, SourceRevision 11162119, in a 1920x1080 window. The captured client origin is (1,31) inside the 1922x1112 window image. Shape was Static Cross, length 2, center dot enabled and no outline; foreground settings were RGB 0,255,168 and alpha 255.

| Capture | Thickness | Gap | Input reference height | Measured foreground width |
| --- | ---: | ---: | ---: | ---: |
| baseline-original.png | 1 | 2 | 1080 | 7 px |
| thickness-2.png | 2 | 2 | 1080 | 8 px |
| thickness-3.png | 3 | 2 | 1080 | 7 px |
| thickness-2-gap-4.png | 2 | 4 | 1080 | 12 px |
| reference-810.png | 1 | 2 | 810 | 11 px |

`static-1080.png` duplicates the original baseline. `background.png` records the same wall with the crosshair disabled. Changing the reference height was followed by game-side normalization on a later frame, so the 810 capture is evidence for the resulting display occupancy, not a claim that the game's stored convars remain at their input values indefinitely.

`e2e/calibration.spec.ts` extracts the foreground occupancy from these real PNGs and compares every occupied/empty pixel against the website at the equivalent target. It also checks the captured client-center placement rather than comparing bounding boxes alone. Color and edge-alpha parity are not asserted by this test.

## Appearance limits

The captured foreground RGB and adjacent background pixels differ from a raw browser RGBA overlay even with no outline enabled. The background-only capture confirms that pixels immediately outside the colored shape are darkened in the game capture. This establishes a difference in the final game image; it does not establish the exact shader, sharpening or color-processing cause. No guessed blur, color transform or extra outline is applied.

Only the recorded Static Cross occupancy cases have game-derived acceptance evidence. Other styles, arbitrary resolutions, outline appearance, fractional settings and dynamic motion do not have general pixel-perfect game acceptance. Dynamic motion remains synthetic.

On October 27, Computer Use found neither CS2 nor Chrome running. Current verification therefore uses the saved lossless game evidence plus current browser automation; a new live-game comparison was unavailable.

## Verification

After integration with upstream `276a0b4`, `npm run check` passed 85 unit tests, TypeScript, production build and Pages fallback generation. The focused calibration, display-scaling and raster-magnification browser run passed 33 tests with one intentional mobile skip. The full current-main desktop/mobile browser suite passed 265 tests with five skips. A final focused rendering run after preserving the previous negative-gap behavior passed 33 tests with one skip. Computer Use in installed Google Chrome confirmed the imported calibration code, visible 1080p target, 1x preview, and 8x main magnification alongside the fixed 4x detail inset. The local account service was unavailable; Steam authentication was not validated.
