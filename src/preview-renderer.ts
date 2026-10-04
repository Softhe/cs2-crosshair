import type { Settings } from './model';
import type { Geometry, PreviewMode, Shape } from './preview-geometry';
export type RenderStatus = {
    clipped: boolean;
    scale: number;
};
export function fitScale(b: Geometry['bounds'], width: number, height: number, requested: number) { return Math.min(requested, Math.max(1, width - 16) / Math.max(1, 2 * Math.max(Math.abs(b[0]), Math.abs(b[2]))), Math.max(1, height - 16) / Math.max(1, 2 * Math.max(Math.abs(b[1]), Math.abs(b[3])))); }
export function createPreviewRenderer(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
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
        const unit = scale * dpr, cx = pw / 2, cy = ph / 2, b = g.bounds;
        const clipped = cx + b[0] * unit < 0 || cy + b[1] * unit < 0 || cx + b[2] * unit > pw || cy + b[3] * unit > ph;
        const left = Math.max(0, Math.floor(cx + b[0] * unit) - 2), top = Math.max(0, Math.floor(cy + b[1] * unit) - 2), right = Math.min(pw, Math.ceil(cx + b[2] * unit) + 2), bottom = Math.min(ph, Math.ceil(cy + b[3] * unit) + 2), w = right - left, h = bottom - top;
        if (w <= 0 || h <= 0 || !g.shapes.length)
            return { clipped, scale };
        if (mask.width !== w || mask.height !== h) {
            mask.width = w;
            mask.height = h;
        }
        const fg = new Float32Array(w * h), edge = new Float32Array(w * h);
        const paint = (shapes: Shape[], outline: boolean) => {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#fff';
            ctx.strokeStyle = '#fff';
            ctx.beginPath();
            const x0 = cx + g.offset[0] * unit - left, y0 = cy + g.offset[1] * unit - top;
            for (const shape of shapes) {
            if (shape.kind === 'rect') {
                const x = Math.round(x0 + shape.x * unit), y = Math.round(y0 + shape.y * unit), rw = Math.max(1, Math.round(shape.width * unit)), rh = Math.max(1, Math.round(shape.height * unit));
                const before = outline ? unit : 0, after = outline && g.outline === 1 ? unit : 0;
                ctx.fillRect(x - before, y - before, rw + before + after, rh + before + after);
            }
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
            if (shapes[0].kind === 'arc') ctx.stroke();
            const pixels = ctx.getImageData(0, 0, w, h).data, coverage = outline ? edge : fg;
            for (let i = 0; i < coverage.length; i++)
                coverage[i] = Math.max(coverage[i], pixels[i * 4 + 3] / 255 * shapes[0].alpha);
        };
        // Same-layer overlap uses maximum coverage, including independently faded split arms.
        // Non-overlapping quadrant arcs share one stroke/readback. Rectangles remain
        // independent so antialiased outline intersections cannot accumulate coverage.
        const arcs = g.shapes.filter(shape=>shape.kind==='arc');
        const groups = [...g.shapes.filter(shape=>shape.kind!=='arc').map(shape=>[shape]), ...(arcs.length?[arcs]:[])];
        for (const group of groups) {
            paint(group, false);
            if (g.outline)
                paint(group, true);
        }
        const useColor = mode === 'crosshair' || s.cl_ironsight_usecrosshaircolor;
        const color = useColor ? ['r', 'g', 'b'].map(c => s['cl_crosshaircolor_' + c]) : [226, 41, 36], alpha = useColor ? s.cl_crosshaircolor_a / 255 : 1;
        const border = ['r', 'g', 'b'].map(c => s['cl_crosshairoutline_' + c]), image = context.createImageData(w, h);
        for (let i = 0; i < fg.length; i++) {
            const a = fg[i] * alpha, oa = Math.max(0, edge[i] - fg[i]) * s.cl_crosshairoutline_a / 255, combined = a + oa * (1 - a);
            if (!combined)
                continue;
            for (let c = 0; c < 3; c++)
                image.data[i * 4 + c] = (color[c] * a + border[c] * oa * (1 - a)) / combined;
            image.data[i * 4 + 3] = combined * 255;
        }
        context.putImageData(image, left, top);
        return { clipped, scale };
    };
}
