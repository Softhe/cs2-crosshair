import type { Settings } from './model';
import type { Geometry, PreviewMode, Shape } from './preview-geometry';
export type RenderStatus = {
    clipped: boolean;
    scale: number;
    /** Effective magnification relative to the requested 1× size; below zoom when fit reduces the scale. */
    magnification?: number;
};
export type Coverage = {
    clipped: boolean;
    left: number;
    top: number;
    width: number;
    height: number;
    fg: Float32Array;
    edge: Float32Array;
};
export function fitScale(b: Geometry['bounds'], width: number, height: number, requested: number) { return Math.min(requested, Math.max(1, width - 16) / Math.max(1, 2 * Math.max(Math.abs(b[0]), Math.abs(b[2]))), Math.max(1, height - 16) / Math.max(1, 2 * Math.max(Math.abs(b[1]), Math.abs(b[3])))); }

function snapInterval(start: number, length: number, unit: number, center: number): [number, number] {
    let pixels = Math.max(1, Math.round(length * unit));
    const midpoint = (start + length / 2) * unit, centerPhase = center - Math.floor(center);
    if (Math.abs(midpoint) < 1e-8) {
        // A centered interval must share the center's odd/even pixel parity.
        if (pixels % 2 !== centerPhase * 2) pixels++;
        return [center - pixels / 2, pixels];
    }
    const phase = Math.abs(pixels % 2 / 2 - centerPhase);
    const distance = Math.max(phase, Math.round(Math.abs(midpoint) - phase) + phase);
    // Quantize the distance once, then reflect it for the opposite arm.
    return [center + Math.sign(midpoint) * distance - pixels / 2, pixels];
}
// Same-layer overlap uses maximum coverage, including independently faded split arms,
// so intersections never become brighter or more opaque than a single shape.
function fillMax(target: Float32Array, width: number, height: number, x: number, y: number, w: number, h: number, alpha: number) {
    const x1 = Math.min(width, Math.round(x + w)), y1 = Math.min(height, Math.round(y + h));
    for (let row = Math.max(0, Math.round(y)); row < y1; row++)
        for (let i = row * width + Math.max(0, Math.round(x)), end = row * width + x1; i < end; i++)
            if (target[i]! < alpha) target[i] = alpha;
}
const TAU = Math.PI * 2;
// 4×4 supersampling with offsets symmetric about the pixel center, so mirrored pixels
// around a whole- or half-pixel center receive identical coverage.
const SAMPLES = [-.375, -.125, .125, .375];
// Annulus (or disc when inner is 0) coverage, optionally limited to the clockwise angle range
// start..end in canvas coordinates. Curves are evaluated analytically instead of through canvas
// antialiasing, whose rasterization is not mirror-symmetric.
function fillBand(target: Float32Array, width: number, height: number, cx: number, cy: number, inner: number, outer: number, start: number, end: number, alpha: number) {
    if (outer <= 0 || outer <= inner || alpha <= 0) return;
    inner = Math.max(0, inner);
    const full = end - start >= TAU - 1e-9, reach = outer + 1, margin = .75;
    const inside = (dx: number, dy: number) => {
        const d = dx * dx + dy * dy;
        if (d < inner * inner || d > outer * outer) return false;
        if (full) return true;
        const angle = start + ((Math.atan2(dy, dx) - start) % TAU + TAU) % TAU;
        return angle <= end;
    };
    for (let row = Math.max(0, Math.floor(cy - reach)), rowEnd = Math.min(height, Math.ceil(cy + reach)); row < rowEnd; row++) {
        const dy = row + .5 - cy, span = Math.sqrt(Math.max(0, reach * reach - dy * dy));
        // Pixels well inside the inner radius cannot be covered; skip that run of the row.
        const hole = inner > 1 + margin && Math.abs(dy) < inner - 1 - margin ? Math.sqrt((inner - 1 - margin) ** 2 - dy * dy) : -1;
        for (let col = Math.max(0, Math.floor(cx - span)), colEnd = Math.min(width, Math.ceil(cx + span)); col < colEnd; col++) {
            const dx = col + .5 - cx;
            if (hole > 0 && Math.abs(dx) < hole) {
                col = Math.max(col, Math.floor(cx + hole) - 1);
                continue;
            }
            const distance = Math.hypot(dx, dy);
            if (distance < inner - margin || distance > outer + margin) continue;
            let coverage: number;
            if (full && distance >= inner + margin && distance <= outer - margin) coverage = 1;
            else {
                let hits = 0;
                for (const sy of SAMPLES) for (const sx of SAMPLES) if (inside(dx + sx, dy + sy)) hits++;
                coverage = hits / 16;
            }
            const value = coverage * alpha, i = row * width + col;
            if (target[i]! < value) target[i] = value;
        }
    }
}
// Pooled scratch buffers, scoped per renderer and reused across renders,
// grown on demand so the steady-state animation loop allocates nothing per frame.
export function createCoverage() {
    let fgPool = new Float32Array(0), edgePool = new Float32Array(0);
    return (g: Geometry, thickness: number, scale: number, pw: number, ph: number, dpr: number): Coverage => {
        const unit = scale * dpr, phase = Math.max(1, Math.round(thickness * unit)) % 2 / 2;
        const cx = Math.round(pw / 2 - phase) + phase, cy = Math.round(ph / 2 - phase) + phase, b = g.bounds;
        const clipped = cx + b[0] * unit < 0 || cy + b[1] * unit < 0 || cx + b[2] * unit > pw || cy + b[3] * unit > ph;
        // Outlines are whole backing pixels, as in the game, rather than a fractional halo.
        const ow = g.outline ? Math.max(1, Math.round(unit)) : 0, pad = 3;
        const left = Math.max(0, Math.floor(cx + b[0] * unit) - pad), top = Math.max(0, Math.floor(cy + b[1] * unit) - pad), right = Math.min(pw, Math.ceil(cx + b[2] * unit) + pad), bottom = Math.min(ph, Math.ceil(cy + b[3] * unit) + pad);
        const w = Math.max(0, right - left), h = Math.max(0, bottom - top);
        if (fgPool.length < w * h) {
            fgPool = new Float32Array(w * h);
            edgePool = new Float32Array(w * h);
        }
        const fg = fgPool.subarray(0, w * h).fill(0), edge = edgePool.subarray(0, w * h).fill(0);
        if (!w || !h || !g.shapes.length) return { clipped, left, top, width: 0, height: 0, fg, edge };
        const x0 = cx + Math.round(g.offset[0] * unit) - left, y0 = cy + Math.round(g.offset[1] * unit) - top;
        for (const shape of g.shapes as Shape[]) {
            if (shape.kind === 'rect') {
                // Rects are axis-aligned and snapped to whole device pixels, keeping opposing arms
                // symmetric via center parity. Full outlines grow every side; half outlines grow
                // only the min (top/left) sides, mirroring previewGeometry's bounds halo.
                const [x, rw] = snapInterval(shape.x, shape.width, unit, x0);
                const [y, rh] = snapInterval(shape.y, shape.height, unit, y0);
                fillMax(fg, w, h, x, y, rw, rh, shape.alpha);
                if (ow) {
                    const after = g.outline === 1 ? ow : 0;
                    fillMax(edge, w, h, x - ow, y - ow, rw + ow + after, rh + ow + after, shape.alpha);
                }
            }
            else if (shape.kind === 'disc')
                fillBand(fg, w, h, x0, y0, 0, shape.radius * unit, 0, TAU, shape.alpha);
            else {
                const radius = shape.radius * unit, half = shape.thickness * unit / 2;
                fillBand(fg, w, h, x0, y0, radius - half, radius + half, shape.start, shape.end, shape.alpha);
                if (g.outline === 1)
                    fillBand(edge, w, h, x0, y0, radius - half - ow, radius + half + ow, shape.start, shape.end, shape.alpha);
                else if (g.outline === 2)
                    fillBand(edge, w, h, x0 - ow / 2, y0 - ow / 2, radius - half - ow / 2, radius + half + ow / 2, shape.start, shape.end, shape.alpha);
            }
        }
        return { clipped, left, top, width: w, height: h, fg, edge };
    };
}
// Foreground and the outline border (outline minus foreground) are composed once per pixel,
// so an opaque outline never makes a transparent foreground interior opaque.
export function composite(c: Coverage, s: Settings, mode: PreviewMode, out: Uint8ClampedArray) {
    const useColor = mode === 'crosshair' || s.cl_ironsight_usecrosshaircolor;
    const color = useColor ? [s.cl_crosshaircolor_r, s.cl_crosshaircolor_g, s.cl_crosshaircolor_b] : [226, 41, 36], alpha = useColor ? s.cl_crosshaircolor_a / 255 : 1;
    const border = [s.cl_crosshairoutline_r, s.cl_crosshairoutline_g, s.cl_crosshairoutline_b], borderAlpha = s.cl_crosshairoutline_a / 255;
    const { fg, edge } = c;
    for (let i = 0; i < c.width * c.height; i++) {
        const a = fg[i]! * alpha, oa = Math.max(0, edge[i]! - fg[i]!) * borderAlpha, combined = a + oa * (1 - a), p = i * 4;
        if (!combined) {
            out[p] = out[p + 1] = out[p + 2] = out[p + 3] = 0;
            continue;
        }
        for (let ch = 0; ch < 3; ch++)
            out[p + ch] = (color[ch]! * a + border[ch]! * oa * (1 - a)) / combined;
        out[p + 3] = combined * 255;
    }
}
export function createPreviewRenderer(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
    const coverage = createCoverage();
    let image: ImageData | null = null;
    return (g: Geometry, s: Settings, mode: PreviewMode, scale: number): RenderStatus => {
        const dpr = window.devicePixelRatio || 1, pw = Math.round(canvas.clientWidth * dpr), ph = Math.round(canvas.clientHeight * dpr);
        if (canvas.width !== pw || canvas.height !== ph) {
            canvas.width = pw;
            canvas.height = ph;
        }
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, pw, ph);
        const c = coverage(g, s.cl_crosshair_thickness, scale, pw, ph, dpr);
        if (!c.width || !c.height)
            return { clipped: c.clipped, scale };
        if (!image || image.width !== c.width || image.height !== c.height)
            image = context.createImageData(c.width, c.height);
        composite(c, s, mode, image.data);
        context.putImageData(image, c.left, c.top);
        return { clipped: c.clipped, scale };
    };
}
