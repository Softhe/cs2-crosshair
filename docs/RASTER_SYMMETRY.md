# Crosshair raster symmetry

The rectangular renderer previously rounded each rectangle's starting position and length independently. At fractional display scales, such as 1440 / 1080, reflected arms could land on different pixel boundaries. Negative gaps exposed the defect where the arms overlap: one side of the foreground or outline could extend farther than its opposite side.

`src/preview-renderer.ts` now chooses a shared backing-pixel center based on the rounded thickness. Odd widths use a half-pixel center; even widths use an integer center. Rectangle midpoints are snapped by their distance from that center and reflected for opposite arms. Centered intervals use the same odd/even parity. Recoil translation is snapped separately and shared by all shapes.

This can shift the raster center by up to half a backing pixel and increase a centered interval by one pixel when required for symmetry. Settings, share codes, config exports, and resolution mapping are unchanged. Full outlines remain mirrored. Half outlines and T-style crosshairs retain their intentionally asymmetric geometry. This fixes browser rasterization; it does not establish pixel-for-pixel calibration against CS2.

## Evidence

The served Tailscale build was captured at a 2560 × 1440 viewport with the estimated 1440p scale, static cross, thickness 2, gap -9, and full outline. The 4× detail canvas was checked by comparing every RGBA channel against its horizontal and vertical reflection, allowing a one-value channel tolerance.

- Before: 452 channel comparisons exceeded tolerance.
- After: zero channel comparisons exceeded tolerance.
- Images are cropped from the rendered canvas and enlarged with nearest-neighbor sampling: [before](evidence/raster-symmetry/before.png), [after](evidence/raster-symmetry/after.png).
- Raw measurements: [before](evidence/raster-symmetry/before.json), [after](evidence/raster-symmetry/after.json).

`e2e/raster-symmetry.spec.ts` reproduced the failure before the fix and now checks thicknesses 1, 2, and 3; negative, zero, and positive gaps; 1× and 4× zoom; and device pixel ratios 1, 1.25, and 2. The existing tests also cover dot/circle/square centering, alpha compositing, clipping, resolution mapping, and fullscreen centering.

Reproduce the served-build capture after a production build with `npx tsx scripts/verify-symmetry.ts after`.
