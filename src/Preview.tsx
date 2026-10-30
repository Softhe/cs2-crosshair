import { useEffect, useId, useRef, useState } from 'react';
import { styles, type Settings } from './model';
import { motionEligible, previewGeometry, renderingSettings, renderingKeys, type Geometry, type PreviewMode, type RenderingSettings } from './preview-geometry';
import { createPreviewRenderer, fitScale, type RenderStatus, type RasterFrame } from './preview-renderer';
import { previewScale } from './display';
const unstretched: [number, number] = [1, 1];
type Props = {
    settings: Settings;
    zoom?: number;
    targetHeight?: number;
    /** Monitor pixels per game pixel on each axis, as the game's output stretch applies them. */
    stretch?: [number, number];
    dynamic?: boolean;
    mode?: PreviewMode;
    phase?: number;
    fit?: boolean;
    inspectSplit?: boolean;
    decorative?: boolean;
    paused?: boolean;
    onStatus?: (status: RenderStatus) => void;
    onFrame?: (frame: RasterFrame) => void;
};
export function Preview({ settings, zoom = 1, targetHeight, stretch = unstretched, dynamic = false, mode = 'crosshair', phase = 0, fit = false, inspectSplit = false, decorative = false, paused = false, onStatus, onFrame }: Props) {
    const ref = useRef<HTMLCanvasElement>(null), description = useId(), [unavailable, setUnavailable] = useState(false);
    const settingsKey = JSON.stringify([...renderingKeys.map(key => settings[key]),targetHeight?settings.cl_crosshair_screen_height:null]);
    // Extracted visual settings, cached on settingsKey so the rAF loop reuses one
    // object instead of running Object.fromEntries per frame.
    const visualKey = useRef(''), visual = useRef<RenderingSettings | null>(null);
    if (visual.current === null || visualKey.current !== settingsKey) {
        visual.current = renderingSettings(settings);
        visualKey.current = settingsKey;
    }
    const latest = useRef({ settings, visual: visual.current, zoom, targetHeight, stretch, dynamic, mode, phase, fit, inspectSplit, paused, onStatus, onFrame });
    latest.current = { settings, visual: visual.current, zoom, targetHeight, stretch, dynamic, mode, phase, fit, inspectSplit, paused, onStatus, onFrame };
    const invalidate = useRef<() => void>(() => { });
    useEffect(() => {
        const canvas = ref.current;
        if (!canvas)
            return;
        const context = canvas.getContext('2d');
        if (!context) {
            setUnavailable(true);
            return;
        }
        let render: ReturnType<typeof createPreviewRenderer>;
        try {
            render = createPreviewRenderer(canvas, context);
        }
        catch {
            setUnavailable(true);
            return;
        }
        let frame = 0, start: number | null = null, visible = true, active = false;
        // Render guard without per-frame JSON.stringify: animating frames always
        // render (the phase advances every tick); settled frames compare primitives
        // plus the cached geometry identity below.
        let guard: { mode: PreviewMode; scale: number; sx: number; sy: number; cw: number; ch: number; dpr: number; geometry: Geometry; ink: number[]; } | null = null, lastStatus: RenderStatus | null = null;
        // Geometry caches keyed on value inputs (visual by identity). The peak entry
        // feeds fit scaling and is untouched by per-tick animation; the still entry
        // serves every non-animating draw. Animating draws bypass the still cache
        // because phase/elapsed change every tick.
        const peakCache = { visual: null as RenderingSettings | null, mode: '' as PreviewMode | '', phase: 0, split: false, geometry: null as Geometry | null };
        const stillCache = { visual: null as RenderingSettings | null, mode: '' as PreviewMode | '', phase: 0, split: false, geometry: null as Geometry | null };
        const cachedGeometry = (cache: typeof peakCache, v: RenderingSettings, m: PreviewMode, p: number, split: boolean) => {
            if (cache.geometry === null || cache.visual !== v || cache.mode !== m || cache.phase !== p || cache.split !== split) {
                cache.visual = v;
                cache.mode = m;
                cache.phase = p;
                cache.split = split;
                cache.geometry = previewGeometry(v, m, p, 0, split);
            }
            return cache.geometry;
        };
        let resolution: MediaQueryList;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        const schedule = () => { if (!frame)
            frame = requestAnimationFrame(draw); };
        function draw(time: number) {
            frame = 0;
            const p = latest.current;
            const animate = p.dynamic && motionEligible(p.settings, p.mode) && !p.paused && visible && !document.hidden && !reduced.matches;
            if (animate !== active) {
                start = null;
                active = animate;
            }
            if (animate && start === null)
                start = time;
            const elapsed = animate ? time - start! : 0, phaseNow = animate ? (1 - Math.cos(elapsed / 550)) / 2 : p.phase;
            const geometry = animate ? previewGeometry(p.visual, p.mode, phaseNow, elapsed, p.inspectSplit) : cachedGeometry(stillCache, p.visual, p.mode, phaseNow, p.inspectSplit);
            let peak = cachedGeometry(peakCache, p.visual, p.mode, p.dynamic ? 1 : p.phase, p.inspectSplit);
            if (p.dynamic && p.mode === 'crosshair' && p.settings.cl_crosshair_recoil) {
                // Recoil sweeps the crosshair up to 3 CSS px sideways and 7 up. Widen a
                // copy of the cached peak bounds (never the cached object itself) so
                // fit scaling and clipping cover the full sweep.
                const b = peak.bounds;
                peak = { ...peak, bounds: [b[0] - 3, b[1] - 7, b[2] + 3, b[3] + 7] };
            }
            // Optional estimated game-pixel size, converted to CSS pixels at the current DPR.
            // Only nonnegative-gap Static Cross is calibrated against game captures.
            const requested = previewScale(p.zoom, p.targetHeight, p.settings.cl_crosshair_screen_height, devicePixelRatio);
            // The stretch enlarges each axis after rasterizing, so fit against the correspondingly smaller area.
            const [sx, sy] = p.stretch;
            const scale = p.fit ? fitScale(peak.bounds, canvas!.clientWidth / sx, canvas!.clientHeight / sy, requested) : requested;
            const cw = canvas!.clientWidth, ch = canvas!.clientHeight, dpr = devicePixelRatio;
            const ink = [p.settings.cl_crosshaircolor_r, p.settings.cl_crosshaircolor_g, p.settings.cl_crosshaircolor_b, p.settings.cl_crosshaircolor_a, p.settings.cl_crosshairoutline_r, p.settings.cl_crosshairoutline_g, p.settings.cl_crosshairoutline_b, p.settings.cl_crosshairoutline_a, p.settings.cl_ironsight_usecrosshaircolor];
            let dirty = animate || guard === null;
            if (!dirty && guard !== null)
                dirty = guard.mode !== p.mode || guard.scale !== scale || guard.sx !== sx || guard.sy !== sy || guard.cw !== cw || guard.ch !== ch || guard.dpr !== dpr || guard.geometry !== geometry || guard.ink.length !== ink.length || guard.ink.some((v, i) => v !== ink[i]);
            if (dirty) {
                guard = { mode: p.mode, scale, sx, sy, cw, ch, dpr, geometry, ink };
                const baseScale = previewScale(1, p.targetHeight, p.settings.cl_crosshair_screen_height, devicePixelRatio);
                // The native frame is only magnified by whole pixels; nearest-neighbour scaling by a
                // fractional fit factor drops or repeats rows unevenly. Fit snaps down to a whole
                // magnification, or rasterizes directly at the fitted scale when even 1× is too large.
                let magnification = scale / baseScale, drawScale = scale;
                if (p.fit && magnification >= 1) drawScale = baseScale * (magnification = Math.floor(magnification + 1e-6));
                const status = { ...render(geometry, p.settings, p.mode, drawScale, Math.max(1, magnification), p.stretch), magnification };
                p.onFrame?.(status.frame);
                if (!lastStatus || lastStatus.clipped !== status.clipped || lastStatus.scale !== status.scale || lastStatus.sourceClipped !== status.sourceClipped || lastStatus.magnification !== status.magnification) {
                    lastStatus = status;
                    p.onStatus?.({ clipped: status.clipped, sourceClipped: status.sourceClipped, scale: status.scale, magnification: status.magnification });
                }
                canvas!.dataset.clipped = String(status.clipped);
                canvas!.dataset.scale = String(drawScale);
            }
            if (animate)
                schedule();
        }
        const invalidateDraw = () => { guard = null; schedule(); };
        invalidate.current = invalidateDraw;
        const observeResolution = () => { resolution?.removeEventListener('change', observeResolution); resolution = matchMedia(`(resolution: ${devicePixelRatio}dppx)`); resolution.addEventListener('change', observeResolution); invalidateDraw(); };
        const resize = new ResizeObserver(invalidateDraw);
        resize.observe(canvas);
        const intersection = new IntersectionObserver(entries => { visible = entries[0]!.isIntersecting; schedule(); });
        intersection.observe(canvas);
        document.addEventListener('visibilitychange', schedule);
        reduced.addEventListener('change', schedule);
        observeResolution();
        return () => { cancelAnimationFrame(frame); resize.disconnect(); intersection.disconnect(); resolution.removeEventListener('change', observeResolution); reduced.removeEventListener('change', schedule); document.removeEventListener('visibilitychange', schedule); invalidate.current = () => { }; };
    }, []);
    useEffect(() => { invalidate.current(); }, [settingsKey, zoom, targetHeight, stretch[0], stretch[1], dynamic, mode, phase, fit, inspectSplit, paused]);
    return <><canvas ref={ref} role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : mode === 'scope' ? 'Scope dot preview' : 'Live crosshair preview'} aria-describedby={decorative ? undefined : description} className="crosshair-canvas"/>
    {!decorative && <span id={description} className="sr-only">{mode === 'scope' ? 'Scope dot' : styles.find(([id]) => id === settings.cl_crosshairstyle)?.[1]}. {zoom}x {targetHeight?`estimated ${targetHeight}p size`:'CSS-pixel magnification'}. {fit ? 'Fit view may reduce the scale. ' : ''}Game geometry is approximate. {dynamic ? 'Synthetic motion. Reduced-motion preference uses the inspection phase.' : ''}</span>}
    {unavailable && <span className="preview-unavailable" role="status">Canvas rendering is unavailable. Settings can still be exported.</span>}</>;
}
