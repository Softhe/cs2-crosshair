import type { Settings } from './model';
import { simulatedSpread } from './preview-motion';
export type PreviewMode = 'crosshair' | 'scope';
export type Shape = {
    kind: 'rect';
    x: number;
    y: number;
    width: number;
    height: number;
    alpha: number;
} | {
    kind: 'arc';
    radius: number;
    start: number;
    end: number;
    thickness: number;
    alpha: number;
} | {
    kind: 'disc';
    radius: number;
    alpha: number;
};
export type Geometry = {
    shapes: Shape[];
    bounds: [
        number,
        number,
        number,
        number
    ];
    offset: [
        number,
        number
    ];
    outline: number;
};
export const renderingKeys = ['cl_crosshairstyle', 'cl_crosshair_thickness', 'cl_crosshair_gap', 'cl_crosshair_length', 'cl_crosshair_dynamic_spread_limit', 'cl_crosshair_dynamic_splitdist', 'cl_crosshair_dynamic_maxdist_splitratio', 'cl_crosshair_dynamic_splitalpha_innermod', 'cl_crosshair_dynamic_splitalpha_outermod', 'cl_crosshair_drawoutline', 'cl_crosshair_recoil', 'cl_crosshair_t', 'cl_crosshairdot', 'cl_ironsight_dot_scale', 'cl_ironsight_usecrosshaircolor', 'cl_crosshaircolor_r', 'cl_crosshaircolor_g', 'cl_crosshaircolor_b', 'cl_crosshaircolor_a', 'cl_crosshairoutline_r', 'cl_crosshairoutline_g', 'cl_crosshairoutline_b', 'cl_crosshairoutline_a'] as const;
export type RenderingSettings = Record<typeof renderingKeys[number], number>;
export function renderingSettings(s: Settings): RenderingSettings { return Object.fromEntries(renderingKeys.map(key => [key, s[key]])) as RenderingSettings; }
export const motionEligible = (s: Settings, mode: PreviewMode) => mode === 'crosshair' && (!!s.cl_crosshair_recoil || [2,5].includes(s.cl_crosshairstyle) || ([0,1,7].includes(s.cl_crosshairstyle) && s.cl_crosshair_dynamic_spread_limit>0));
// CSS-pixel editor geometry. Game-resolution calibration remains separate.
export function previewGeometry(s: RenderingSettings, mode: PreviewMode, phase = 0, elapsed = 0, inspectSplit = false): Geometry {
    const shapes: Shape[] = [], style = s.cl_crosshairstyle, t = s.cl_crosshair_thickness, half = t / 2;
    const spread = simulatedSpread(style, s.cl_crosshair_dynamic_spread_limit, phase), gap = s.cl_crosshair_gap / 2 + spread, length = s.cl_crosshair_length;
    const outline = mode === 'crosshair' ? s.cl_crosshair_drawoutline : 0;
    const offset: Geometry['offset'] = mode === 'crosshair' && s.cl_crosshair_recoil ? [Math.round(Math.sin(elapsed / 250) * phase * 3), -Math.round(phase * 7)] : [0, 0];
    const rect = (x: number, y: number, width: number, height: number, alpha = 1) => { if (width > 0 && height > 0 && alpha > 0)
        shapes.push({ kind: 'rect', x, y, width, height, alpha }); };
    const arc = (radius: number, start = 0, end = Math.PI * 2) => { if (t > 0 && end > start)
        shapes.push({ kind: 'arc', radius: Math.max(0, radius), start, end, thickness: t, alpha: 1 }); };
    if (mode === 'scope')
        shapes.push({ kind: 'disc', radius: s.cl_ironsight_dot_scale * 1.5, alpha: 1 });
    else {
        if ([0, 2, 4, 5, 7].includes(style)) {
            const split = style === 2 && (inspectSplit || spread > s.cl_crosshair_dynamic_splitdist);
            const inner = split ? Math.round(length * (1 - s.cl_crosshair_dynamic_maxdist_splitratio)) : length;
            const arms = (distance: number, size: number, alpha: number) => { rect(-distance - size, -half, size, t, alpha); rect(distance, -half, size, t, alpha); rect(-half, distance, t, size, alpha); if (!s.cl_crosshair_t)
                rect(-half, -distance - size, t, size, alpha); };
            arms(gap, inner, split ? s.cl_crosshair_dynamic_splitalpha_innermod : 1);
            if (split)
                arms(gap + inner + s.cl_crosshair_dynamic_splitdist, length - inner, s.cl_crosshair_dynamic_splitalpha_outermod);
        }
        if ([1, 3].includes(style))
            arc((style === 1 ? 4 : Math.max(0, gap)) + half + (style === 1 ? spread : 0));
        if (style === 8) {
            const r = Math.max(0, gap);
            rect(-r - t, -r - t, r * 2 + t * 2, t);
            rect(-r - t, r, r * 2 + t * 2, t);
            rect(-r - t, -r, t, r * 2);
            rect(r, -r, t, r * 2);
        }
        if ([7, 9].includes(style)) {
            const radius = Math.max(2, gap + t + 2), ratio = style === 9 ? s.cl_crosshair_dynamic_maxdist_splitratio : .65;
            for (let i = 0; i < 4; i++) {
                const mid = Math.PI / 4 + i * Math.PI / 2;
                arc(radius, mid - Math.PI / 4 * ratio, mid + Math.PI / 4 * ratio);
            }
        }
        if (s.cl_crosshairdot || style === 6)
            rect(-half, -half, t, t);
    }
    const bounds: Geometry['bounds'] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const shape of shapes) {
        const r = shape.kind === 'rect' ? 0 : shape.radius + (shape.kind === 'arc' ? shape.thickness / 2 : 0);
        const b = shape.kind === 'rect' ? [shape.x, shape.y, shape.x + shape.width, shape.y + shape.height] : [-r, -r, r, r];
        const before = outline ? 1 : 0, after = outline === 1 ? 1 : 0;
        bounds[0] = Math.min(bounds[0], b[0] - before + offset[0]);
        bounds[1] = Math.min(bounds[1], b[1] - before + offset[1]);
        bounds[2] = Math.max(bounds[2], b[2] + after + offset[0]);
        bounds[3] = Math.max(bounds[3], b[3] + after + offset[1]);
    }
    return { shapes, bounds: shapes.length ? bounds : [0, 0, 0, 0], offset, outline };
}
