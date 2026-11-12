# Display sizing and preview centering

The main preview now spans both settings columns. Its aiming point is centered on the available page width, rather than on the editor column to the left of the export sidebar. Fullscreen places the canvas at the center of the entire screen. The normal page reserves scrollbar space to prevent loading shifts; fullscreen removes that reservation because it has no scrollbar.

## Pixel mapping

The preview is drawn **as designed**: it rasterizes at the crosshair's reference height (`cl_crosshair_screen_height`), so every unit is exactly one game pixel and nothing is re-rounded. That is the only mode unless Match my in-game size is on. The monitor estimate is used only by Match my in-game size. It is the browser's screen dimensions multiplied by its device pixel ratio, raised to the viewport when that is larger. The outer window size is not used: a maximized Windows window overhangs the screen, which reported a 1440-row display as 1456. Browser APIs do not expose monitor EDID, diagonal size, or the game's active framebuffer. The estimate is most useful at 100% browser zoom; initial browser zoom, privacy restrictions, and display emulation can make it inaccurate.

The mapping is:

```text
CSS pixels per geometry unit = magnification × target physical height / reference height / device pixel ratio
backing pixels per geometry unit = CSS pixels per geometry unit × device pixel ratio
```

As designed, target height equals reference height, so one unit is one physical pixel; at DPR 2 the CSS scale is 0.5 and the backing scale stays 1. With Match my in-game size at 1440 rows and a 1080 reference, one unit is 1.333 physical pixels. Changing browser zoom alone keeps the display estimate and updates the CSS conversion.

An earlier Inspect preview dialog offered other render heights, a monitor estimate, CSS-pixel mode, a fit checkbox, an inspection-phase slider and forced split arms. It was removed; a resolution it saved is ignored. Re-rounding at another resolution is what Match my in-game size shows, with the stretch the game applies. The 2×–8× buttons and the separate 4× detail preview are editing magnification, not claims about native game size. A crosshair too large for the preview, including the widest spread of the dynamic preview, is always drawn smaller to fit, and a note under the preview gives the magnification actually shown. None of these controls modify crosshair settings, reference height, share codes, or exports.

[Valve's September 23, 2026 notes](https://www.counter-strike.net/newsentry/674006995886408819) confirm that thickness and length use pixels and that the system rescales pixel counts when display resolution changes. Those notes do not provide a complete rasterization specification. The renderer's geometry, gap overlap, outlines, curves, and motion remain approximate until compared against matched game captures. Background textures are game menu assets, not a calibrated gameplay field of view.

## Match my in-game size

Off by default, under Preview options. It models how CS2 actually reaches the monitor: the crosshair is rasterized at the selected CS2 resolution (`height / reference height` game pixels per unit), then each game pixel is enlarged to `monitor width / game width` × `monitor height / game height` screen pixels when **Stretched to fill the monitor** is on, or by the smaller of the two (black bars) when it is off. For 1280 × 960 stretched to a 2560 × 1440 monitor, that is 2 × 1.5, so the crosshair is twice as wide and 1.5× as tall as a 960p crosshair drawn 1:1. Whole-number factors stay crisp. Fractional factors are filtered the way GPU and monitor scalers filter them. The size is the same inline and in fullscreen, and the zoom buttons still magnify on top of it.

The resolution list follows CS2's aspect-ratio groups (4:3, 5:4, 16:10, 16:9) and, as in the game, shows only modes no larger than the estimated monitor. Custom accepts any size. The first time it is enabled, the selection starts at the monitor's resolution. The monitor size comes from the display estimate above. The preference is stored in the browser and on the Steam account when signed in ([Library sync](LIBRARY_SYNC.md)).

## Screenshot diagnosis

The supplied 2560 × 1440 screenshot used CSS-pixel mode at 1×, Static Cross, thickness 2, length 8, gap -9, and full outline. Its green foreground occupied x=1089..1097 and y=475..483, centered at (1093, 479). That is the center of the old left-column map preview, rather than the screen center. The negative gap overlaps the arms, making this shape compact; making its game settings larger would change the exported crosshair.

Before the raster symmetry correction, the same settings with a 1080p reference and 1440p display mapping measured 16 × 16 physical pixels including outline. The raster correction can change a rounded span by one backing pixel to keep opposite arms mirrored. The updated measurement is 17 × 17 physical pixels in both inline and fullscreen views, with a half-pixel raster-center offset on both axes. Current measurements are recorded in `docs/evidence/display-scaling/verification.json`. See [Raster symmetry](RASTER_SYMMETRY.md) for the shared pixel-center rule.

## Verification

- `tests/display.test.ts` verifies the as-designed 1:1 mapping, magnification, and physical-pixel invariance across DPR 1, 1.25, 1.5, and 2.
- `e2e/display-scaling.spec.ts` verifies page centering, as-designed sizing at DPR 1–2, Match my in-game size at the monitor's 1440 rows, magnification, fullscreen centering, exit, and unchanged share codes.
- Rendering tests that need another game resolution report a monitor of that size and turn on Match my in-game size (`playAt` in `e2e/preview-options-helper.ts`).
- `scripts/verify-display.ts` captures the screenshot's crosshair settings at a 2560 × 1440 display and checks mobile overflow and browser errors against the Tailscale preview.

Evidence is in `docs/evidence/display-scaling/`: `desktop-1440p.png`, `fullscreen-1440p.png`, `mobile.png`, and `verification.json`. These establish browser geometry and sizing behavior, not pixel parity with an installed CS2 game session.
