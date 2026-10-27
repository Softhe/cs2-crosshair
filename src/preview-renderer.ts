import type { Settings } from './model';
import type { Geometry, PreviewMode, Shape } from './preview-geometry';
export type RenderStatus = {
    clipped: boolean;
    sourceClipped?: boolean;
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

function staticCrossInterval(start: number, length: number, unit: number, center: number): [number, number] {
    const midpoint = start + length / 2;
    if (Math.abs(midpoint) < 1e-8) return snapInterval(start, length, unit, center);
    const pixels = Math.max(1, Math.round(length * unit));
    const phase = center - Math.floor(center);
    // CS2 rounds arm length and inner distance independently. Reflect the
    // resulting interval around the same odd/even center used by the dot.
    const inner = Math.round(Math.min(Math.abs(start), Math.abs(start + length)) * unit) - phase;
    return [midpoint > 0 ? center + inner : center - inner - pixels, pixels];
}
function createRasterRenderer(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
    let fgPool = new Float32Array(0), edgePool = new Float32Array(0), imagePool: ImageData | null = null;
    const mask = document.createElement('canvas'), ctx = mask.getContext('2d', { willReadFrequently: true });
    if (!ctx)
        throw Error('Canvas rendering is unavailable.');
    return (g: Geometry, s: Settings, mode: PreviewMode, unit: number, pw: number, ph: number): RasterFrame => {
        if (canvas.width !== pw || canvas.height !== ph) {
            canvas.width = pw;
            canvas.height = ph;
        }
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, pw, ph);
        const phase = Math.max(1, Math.round(s.cl_crosshair_thickness * unit)) % 2 / 2;
        const calibratedCross = mode === 'crosshair' && s.cl_crosshairstyle === 4;
        const centerRound = calibratedCross ? Math.floor : Math.round;
        const cx = centerRound(pw / 2 - phase) + phase, cy = centerRound(ph / 2 - phase) + phase, b = g.bounds;
        const clipped = cx + b[0] * unit < 0 || cy + b[1] * unit < 0 || cx + b[2] * unit > pw || cy + b[3] * unit > ph;
        const left = Math.max(0, Math.floor(cx + b[0] * unit) - 2), top = Math.max(0, Math.floor(cy + b[1] * unit) - 2), right = Math.min(pw, Math.ceil(cx + b[2] * unit) + 2), bottom = Math.min(ph, Math.ceil(cy + b[3] * unit) + 2), w = right - left, h = bottom - top;
        if (w <= 0 || h <= 0 || !g.shapes.length)
            return { canvas, bounds: [0, 0, 0, 0], clipped };
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
                const interval = calibratedCross ? staticCrossInterval : snapInterval;
                const [x, rw] = interval(shape.x, shape.width, unit, x0);
                const [y, rh] = interval(shape.y, shape.height, unit, y0);
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
        const bounds: RasterFrame['bounds'] = [pw, ph, 0, 0];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (!image.data[(y * w + x) * 4 + 3]) continue;
            bounds[0] = Math.min(bounds[0], left + x);
            bounds[1] = Math.min(bounds[1], top + y);
            bounds[2] = Math.max(bounds[2], left + x + 1);
            bounds[3] = Math.max(bounds[3], top + y + 1);
        }
        return { canvas, bounds: bounds[2] ? bounds : [0, 0, 0, 0], clipped };
    };
}

/** One native raster frame, shared by every magnified view. Bounds use exclusive max edges. */
export type RasterFrame = {
    canvas: HTMLCanvasElement;
    bounds: [number, number, number, number];
    clipped: boolean;
    id?: number;
};

export function paintRasterFrame(frame: RasterFrame, canvas: HTMLCanvasElement, magnification: number) {
    const context = canvas.getContext('2d');
    if (!context) return false;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * dpr), height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = false;
    const x = Math.floor((width - frame.canvas.width * magnification) / 2);
    const y = Math.floor((height - frame.canvas.height * magnification) / 2);
    const [left, top, right, bottom] = frame.bounds;
    if (right > left && bottom > top) {
        // Copy only occupied pixels, preserving their placement in the native frame.
        context.drawImage(frame.canvas, left, top, right - left, bottom - top,
            x + left * magnification, y + top * magnification,
            (right - left) * magnification, (bottom - top) * magnification);
    }
    const clipped = frame.clipped || (right > left && bottom > top && (x + left * magnification < 0 || y + top * magnification < 0 || x + right * magnification > width || y + bottom * magnification > height));
    canvas.dataset.clipped = String(clipped);
    canvas.dataset.sourceClipped = String(frame.clipped);
    canvas.dataset.magnification = String(magnification);
    canvas.dataset.frame = String(frame.id ?? 0);
    return clipped;
}

export function createPreviewRenderer(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
    context.imageSmoothingEnabled = false;
    const native = document.createElement('canvas'), nativeContext = native.getContext('2d');
    if (!nativeContext) throw Error('Canvas rendering is unavailable.');
    const rasterize = createRasterRenderer(native, nativeContext);
    let frameId = 0;
    return (g: Geometry, s: Settings, mode: PreviewMode, scale: number, magnification = 1) => {
        const dpr = window.devicePixelRatio || 1;
        const unit = scale * dpr / magnification;
        // Retain the complete native shape when a fitted view is smaller than it.
        // Cap scratch dimensions so extreme imported settings cannot allocate unbounded buffers.
        const sourceSize = (size: number, min: number, max: number) => {
            const viewport = Math.round(size * dpr);
            const needed = Math.ceil(2 * Math.max(Math.abs(min), Math.abs(max)) * unit + 8);
            const expanded = Math.min(4096, Math.max(viewport, needed));
            return expanded + ((expanded - viewport) % 2 + 2) % 2;
        };
        const frame = rasterize(g, s, mode, unit,
            sourceSize(canvas.clientWidth, g.bounds[0], g.bounds[2]),
            sourceSize(canvas.clientHeight, g.bounds[1], g.bounds[3]));
        frame.id = ++frameId;
        const clipped = paintRasterFrame(frame, canvas, magnification);
        return { clipped, sourceClipped: frame.clipped, scale, frame };
    };
}
