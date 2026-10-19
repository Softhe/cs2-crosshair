import type { Settings } from './model';
import type { Geometry, PreviewMode, Shape } from './preview-geometry';
export type RenderStatus = {
    clipped: boolean;
    scale: number;
};
export function fitScale(b: Geometry['bounds'], width: number, height: number, requested: number) { return Math.min(requested, Math.max(1, width - 16) / Math.max(1, 2 * Math.max(Math.abs(b[0]), Math.abs(b[2]))), Math.max(1, height - 16) / Math.max(1, 2 * Math.max(Math.abs(b[1]), Math.abs(b[3])))); }
// Pooled scratch buffers, scoped per renderer and reused across renders,
// grown on demand so the steady-state animation loop allocates nothing per
// frame. Renders run fully synchronously; per-renderer pools additionally
// eliminate any cross-canvas sharing risk between Preview instances.
function rectsOverlap(group: Shape[]): boolean {
    const rects: Extract<Shape, { kind: 'rect' }>[] = [];
    for (const shape of group) {
        if (shape.kind === 'rect')
            rects.push(shape);
    }
    for (let i = 0; i < rects.length; i++) {
        const a = rects[i];
        if (!a)
            continue;
        for (let j = i + 1; j < rects.length; j++) {
            const b = rects[j];
            if (!b)
                continue;
            if (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height)
                return true;
        }
    }
    return false;
}

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
export function createPreviewRenderer(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
    let fgPool = new Float32Array(0), edgePool = new Float32Array(0), imagePool: ImageData | null = null;
    const mask = document.createElement('canvas'), ctx = mask.getContext('2d', { willReadFrequently: true });
    if (!ctx)
        throw Error('Canvas rendering is unavailable.');
    return (g: Geometry, s: Settings, mode: PreviewMode, scale: number): RenderStatus => {
        const dpr = window.devicePixelRatio || 1, pw = Math.round(canvas.clientWidth * dpr), ph = Math.round(canvas.clientHeight * dpr);
        if (canvas.width !== pw || canvas.height !== ph) {
            canvas.width = pw;
            canvas.height = ph;
        }
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, pw, ph);
        const unit = scale * dpr, phase = Math.max(1, Math.round(s.cl_crosshair_thickness * unit)) % 2 / 2;
        const cx = Math.round(pw / 2 - phase) + phase, cy = Math.round(ph / 2 - phase) + phase, b = g.bounds;
        const clipped = cx + b[0] * unit < 0 || cy + b[1] * unit < 0 || cx + b[2] * unit > pw || cy + b[3] * unit > ph;
        const left = Math.max(0, Math.floor(cx + b[0] * unit) - 2), top = Math.max(0, Math.floor(cy + b[1] * unit) - 2), right = Math.min(pw, Math.ceil(cx + b[2] * unit) + 2), bottom = Math.min(ph, Math.ceil(cy + b[3] * unit) + 2), w = right - left, h = bottom - top;
        if (w <= 0 || h <= 0 || !g.shapes.length)
            return { clipped, scale };
        if (mask.width !== w || mask.height !== h) {
            mask.width = w;
            mask.height = h;
        }
        if (fgPool.length < w * h) {
            fgPool = new Float32Array(w * h);
            edgePool = new Float32Array(w * h);
        }
        const fg = fgPool.subarray(0, w * h).fill(0), edge = edgePool.subarray(0, w * h).fill(0);
        const paint = (shapes: Shape[], outline: boolean) => {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#fff';
            ctx.beginPath();
            const x0 = cx + Math.round(g.offset[0] * unit) - left, y0 = cy + Math.round(g.offset[1] * unit) - top;
            for (const shape of shapes) {
            if (shape.kind === 'rect') {
                const [x, rw] = snapInterval(shape.x, shape.width, unit, x0);
                const [y, rh] = snapInterval(shape.y, shape.height, unit, y0);
                // Mirrors the previewGeometry bounds halo: 1 CSS unit (here scaled by
                // `unit`) on the min sides, plus 1 on the max sides only when outline === 1.
                const before = outline ? unit : 0, after = outline && g.outline === 1 ? unit : 0;
                ctx.fillRect(x - before, y - before, rw + before + after, rh + before + after);
            }
            // Arcs and discs are curves, so they stay in float space: canvas arc()
            // rasterizes from the float center and radius, preserving smooth
            // antialiased curvature and concentricity. Rects above are axis-aligned,
            // which is why only they are quantized to whole device pixels (keeping
            // opposing arms symmetric via center parity). Snapping a radius or angle
            // to whole pixels would quantize circle thickness and distort the curve.
            else if (shape.kind === 'disc') {
                ctx.beginPath();
                ctx.arc(x0, y0, shape.radius * unit, 0, Math.PI * 2);
                ctx.fill();
            }
            else {
                const shift = outline && g.outline === 2 ? -.5 * unit : 0;
                ctx.lineWidth = (shape.thickness + (outline ? g.outline === 1 ? 2 : 1 : 0)) * unit;
                ctx.moveTo(x0+shift+Math.cos(shape.start)*shape.radius*unit,y0+shift+Math.sin(shape.start)*shape.radius*unit);
                ctx.arc(x0 + shift, y0 + shift, shape.radius * unit, shape.start, shape.end);
            }
            }
            if (shapes[0]!.kind === 'arc') ctx.stroke();
            const pixels = ctx.getImageData(0, 0, w, h).data, coverage = outline ? edge : fg;
            for (let i = 0; i < coverage.length; i++)
                coverage[i]! = Math.max(coverage[i]!, pixels[i * 4 + 3]! / 255 * shapes[0]!.alpha);
        };
        // Same-layer overlap uses maximum coverage, including independently faded split arms.
        // A mask pass scales coverage by a single alpha, so rects are grouped by alpha
        // first; groups with no area overlap share one pass and readback, while
        // overlapping (negative-gap) arms keep one pass per shape so intersections take
        // the maximum instead of accumulating. Non-overlapping quadrant arcs share one
        // stroke/readback as before.
        const rectGroups = new Map<number, Shape[]>(), arcs: Shape[] = [], discs: Shape[] = [];
        for (const shape of g.shapes) {
            if (shape.kind === 'arc') {
                arcs.push(shape);
                continue;
            }
            if (shape.kind === 'disc') {
                discs.push(shape);
                continue;
            }
            const group = rectGroups.get(shape.alpha);
            if (group)
                group.push(shape);
            else
                rectGroups.set(shape.alpha, [shape]);
        }
        const groups: Shape[][] = [];
        for (const group of rectGroups.values()) {
            if (group.length > 1 && rectsOverlap(group))
                for (const shape of group)
                    groups.push([shape]);
            else
                groups.push(group);
        }
        if (arcs.length)
            groups.push(arcs);
        for (const disc of discs)
            groups.push([disc]);
        for (const group of groups) {
            paint(group, false);
            if (g.outline)
                paint(group, true);
        }
        const useColor = mode === 'crosshair' || s.cl_ironsight_usecrosshaircolor;
        const color = useColor ? ['r', 'g', 'b'].map(c => s['cl_crosshaircolor_' + c]) : [226, 41, 36], alpha = useColor ? s.cl_crosshaircolor_a / 255 : 1;
        const border = ['r', 'g', 'b'].map(c => s['cl_crosshairoutline_' + c]);
        if (!imagePool || imagePool.width !== w || imagePool.height !== h)
            imagePool = context.createImageData(w, h);
        else
            imagePool.data.fill(0);
        const image = imagePool;
        for (let i = 0; i < fg.length; i++) {
            const a = fg[i]! * alpha, oa = Math.max(0, edge[i]! - fg[i]!) * s.cl_crosshairoutline_a / 255, combined = a + oa * (1 - a);
            if (!combined)
                continue;
            for (let c = 0; c < 3; c++)
                image.data[i * 4 + c] = (color[c]! * a + border[c]! * oa * (1 - a)) / combined;
            image.data[i * 4 + 3] = combined * 255;
        }
        context.putImageData(image, left, top);
        return { clipped, scale };
    };
}
