import { useEffect, useId, useRef, useState } from 'react';
import { styles, type Settings } from './model';
import { motionEligible, previewGeometry, renderingSettings, renderingKeys, type PreviewMode } from './preview-geometry';
import { createPreviewRenderer, fitScale, type RenderStatus } from './preview-renderer';
import { previewScale } from './display';
type Props = {
    settings: Settings;
    zoom?: number;
    targetHeight?: number;
    dynamic?: boolean;
    mode?: PreviewMode;
    phase?: number;
    fit?: boolean;
    inspectSplit?: boolean;
    decorative?: boolean;
    paused?: boolean;
    onStatus?: (status: RenderStatus) => void;
};
export function Preview({ settings, zoom = 1, targetHeight, dynamic = false, mode = 'crosshair', phase = 0, fit = false, inspectSplit = false, decorative = false, paused = false, onStatus }: Props) {
    const ref = useRef<HTMLCanvasElement>(null), description = useId(), [unavailable, setUnavailable] = useState(false);
    const latest = useRef({ settings, zoom, targetHeight, dynamic, mode, phase, fit, inspectSplit, paused, onStatus });
    latest.current = { settings, zoom, targetHeight, dynamic, mode, phase, fit, inspectSplit, paused, onStatus };
    const invalidate = useRef<() => void>(() => { });
    const settingsKey = JSON.stringify([...renderingKeys.map(key => settings[key]),targetHeight?settings.cl_crosshair_screen_height:null]);
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
        let frame = 0, start: number | null = null, visible = true, signature = '', active = false, lastStatus = '';
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
            const visual = renderingSettings(p.settings);
            const geometry = previewGeometry(visual, p.mode, phaseNow, elapsed, p.inspectSplit), peak = previewGeometry(visual, p.mode, p.dynamic ? 1 : p.phase, 0, p.inspectSplit);
            if (p.dynamic && p.mode === 'crosshair' && p.settings.cl_crosshair_recoil) {
                peak.bounds[0] -= 3;
                peak.bounds[2] += 3;
                peak.bounds[1] -= 7;
                peak.bounds[3] += 7;
            }
            // Optional estimated game-pixel size, converted to CSS pixels at the current DPR.
            // This mapping is explicitly uncalibrated against game captures.
            const requested = previewScale(p.zoom, p.targetHeight, p.settings.cl_crosshair_screen_height, devicePixelRatio);
            const scale = p.fit ? fitScale(peak.bounds, canvas!.clientWidth, canvas!.clientHeight, requested) : requested;
            const key = JSON.stringify([geometry, p.mode, scale, canvas!.clientWidth, canvas!.clientHeight, devicePixelRatio, ...['color', 'outline'].flatMap(prefix => ['r', 'g', 'b', 'a'].map(c => p.settings[`cl_crosshair${prefix}_${c}`])), p.settings.cl_ironsight_usecrosshaircolor]);
            if (key !== signature) {
                signature = key;
                const status = render(geometry, p.settings, p.mode, scale);
                const statusKey = JSON.stringify(status);
                if (statusKey !== lastStatus) {
                    lastStatus = statusKey;
                    p.onStatus?.(status);
                }
                canvas!.dataset.clipped = String(status.clipped);
                canvas!.dataset.scale = String(scale);
            }
            if (animate)
                schedule();
        }
        const invalidateDraw = () => { signature = ''; schedule(); };
        invalidate.current = invalidateDraw;
        const observeResolution = () => { resolution?.removeEventListener('change', observeResolution); resolution = matchMedia(`(resolution: ${devicePixelRatio}dppx)`); resolution.addEventListener('change', observeResolution); invalidateDraw(); };
        const resize = new ResizeObserver(invalidateDraw);
        resize.observe(canvas);
        const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; schedule(); });
        intersection.observe(canvas);
        document.addEventListener('visibilitychange', schedule);
        reduced.addEventListener('change', schedule);
        observeResolution();
        return () => { cancelAnimationFrame(frame); resize.disconnect(); intersection.disconnect(); resolution.removeEventListener('change', observeResolution); reduced.removeEventListener('change', schedule); document.removeEventListener('visibilitychange', schedule); invalidate.current = () => { }; };
    }, []);
    useEffect(() => { invalidate.current(); }, [settingsKey, zoom, targetHeight, dynamic, mode, phase, fit, inspectSplit, paused]);
    return <><canvas ref={ref} role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : mode === 'scope' ? 'Scope dot preview' : 'Live crosshair preview'} aria-describedby={decorative ? undefined : description} className="crosshair-canvas"/>
    {!decorative && <span id={description} className="sr-only">{mode === 'scope' ? 'Scope dot' : styles.find(([id]) => id === settings.cl_crosshairstyle)?.[1]}. {zoom}x {targetHeight?`estimated ${targetHeight}p size`:'CSS-pixel magnification'}. {fit ? 'Fit view may reduce the scale. ' : ''}Game geometry is approximate. {dynamic ? 'Synthetic motion. Reduced-motion preference uses the inspection phase.' : ''}</span>}
    {unavailable && <span className="preview-unavailable" role="status">Canvas rendering is unavailable. Settings can still be exported.</span>}</>;
}
