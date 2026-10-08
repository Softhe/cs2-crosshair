# Display sizing and preview centering

The main preview now spans both settings columns. Its aiming point is centered on the available page width, rather than on the editor column to the left of the export sidebar. Fullscreen places the canvas at the center of the entire screen. The normal page reserves scrollbar space to prevent loading shifts; fullscreen removes that reservation because it has no scrollbar.

## Pixel mapping

The default preview mode is **Monitor size (estimated)**, at 1× magnification. The initial display estimate is the browser's screen dimensions multiplied by its device pixel ratio. A display-height override allows correction when that estimate is wrong. Browser APIs do not expose monitor EDID, diagonal size, or the game's active framebuffer. The estimate is most useful at 100% browser zoom; initial browser zoom, privacy restrictions, and display emulation can make it inaccurate.

The mapping is:

```text
CSS pixels per geometry unit = magnification × target physical height / reference height / device pixel ratio
backing pixels per geometry unit = CSS pixels per geometry unit × device pixel ratio
```

At a 1440-pixel display height and a 1080-pixel reference height, 1× uses 1.333 physical pixels per geometry unit. At DPR 2, the CSS scale is 0.667, and the backing scale remains 1.333. Changing browser zoom alone keeps the initial display estimate and updates the CSS conversion. Moving between screens with different browser-reported dimensions recomputes the estimate. A selected reference height of 1440 gives a 1:1 mapping on a 1440-pixel display.

The explicit 1080p, 1440p, and 2160p choices model target-framebuffer pixel sizes. They do not simulate GPU stretching or black bars for a different game aspect ratio. CSS-pixel mode remains available for renderer inspection. The 2×–8× buttons and the separate 4× detail preview are editing magnification, not claims about native game size. Fit may reduce magnification to avoid clipping. None of these controls modify crosshair settings, reference height, share codes, or exports.

[Valve's September 23, 2026 notes](https://www.counter-strike.net/newsentry/674006995886408819) confirm that thickness and length use pixels and that the system rescales pixel counts when display resolution changes. Those notes do not provide a complete rasterization specification. The renderer's geometry, gap overlap, outlines, curves, and motion remain approximate until compared against matched game captures. Background textures are game menu assets, not a calibrated gameplay field of view.

## Screenshot diagnosis

The supplied 2560 × 1440 screenshot used CSS-pixel mode at 1×, Static Cross, thickness 2, length 8, gap -9, and full outline. Its green foreground occupied x=1089..1097 and y=475..483, centered at (1093, 479). That is the center of the old left-column map preview, rather than the screen center. The negative gap overlaps the arms, making this shape compact; making its game settings larger would change the exported crosshair.

Before the raster symmetry correction, the same settings with a 1080p reference and 1440p display mapping measured 16 × 16 physical pixels including outline. The raster correction can change a rounded span by one backing pixel to keep opposite arms mirrored. The updated measurement is 17 × 17 physical pixels in both inline and fullscreen views, with a half-pixel raster-center offset on both axes. Current measurements are recorded in `docs/evidence/display-scaling/verification.json`. See [Raster symmetry](RASTER_SYMMETRY.md) for the shared pixel-center rule.

## Verification

- `tests/display.test.ts` verifies reference height, magnification, CSS inspection mode, and physical-pixel invariance across DPR 1, 1.25, 1.5, and 2.
- `e2e/display-scaling.spec.ts` verifies page centering, 1440p sizing at DPR 1 and DPR 2, a manual display-height override, magnification, fullscreen centering, exit, and unchanged share codes.
- Existing rendering tests explicitly select CSS-pixel mode when testing the renderer independently of monitor estimation.
- `scripts/verify-display.ts` captures the screenshot's crosshair settings at a 2560 × 1440 display and checks mobile overflow and browser errors against the Tailscale preview.

Evidence is in `docs/evidence/display-scaling/`: `desktop-1440p.png`, `fullscreen-1440p.png`, `mobile.png`, and `verification.json`. These establish browser geometry and sizing behavior, not pixel parity with an installed CS2 game session.
