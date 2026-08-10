import { useEffect, useMemo, useState } from 'react';
import {
	getPreviewResolutionScale,
	isPreviewResolution,
	isPreviewZoom,
	type PreviewResolution,
	type PreviewZoom,
} from '@/lib/crosshair-preview';

const RESOLUTION_STORAGE_KEY = 'cs2_preview_resolution';
const ZOOM_STORAGE_KEY = 'cs2_preview_zoom';

const readResolution = (): PreviewResolution => {
	try {
		const value = localStorage.getItem(RESOLUTION_STORAGE_KEY);
		return isPreviewResolution(value) ? value : 'auto';
	} catch {
		return 'auto';
	}
};

const readZoom = (): PreviewZoom => {
	try {
		const value = localStorage.getItem(ZOOM_STORAGE_KEY);
		return isPreviewZoom(value) ? value : 'exact';
	} catch {
		return 'exact';
	}
};

const readViewportHeight = () => typeof window === 'undefined' ? 1080 : window.innerHeight;

export const usePreviewPreferences = () => {
	const [resolution, setResolution] = useState<PreviewResolution>(readResolution);
	const [zoom, setZoom] = useState<PreviewZoom>(readZoom);
	const [viewportHeight, setViewportHeight] = useState(readViewportHeight);

	useEffect(() => {
		const updateViewportHeight = () => setViewportHeight(window.innerHeight);
		window.addEventListener('resize', updateViewportHeight);
		return () => window.removeEventListener('resize', updateViewportHeight);
	}, []);

	useEffect(() => {
		try { localStorage.setItem(RESOLUTION_STORAGE_KEY, resolution); } catch { /* Preview still works without storage. */ }
	}, [resolution]);

	useEffect(() => {
		try { localStorage.setItem(ZOOM_STORAGE_KEY, zoom); } catch { /* Preview still works without storage. */ }
	}, [zoom]);

	const resolutionScale = useMemo(
		() => getPreviewResolutionScale(resolution, viewportHeight),
		[resolution, viewportHeight],
	);
	const effectiveResolution = resolution === 'auto'
		? `Auto · ${Math.round(viewportHeight)}px viewport`
		: resolution === '1280x960-stretched' ? '1280×960 stretched' : resolution.replace('x', '×');

	return {
		resolution,
		setResolution,
		zoom,
		setZoom,
		resolutionScale,
		effectiveResolution,
		zoomMultiplier: zoom === '4x' ? 4 : 1,
	};
};
