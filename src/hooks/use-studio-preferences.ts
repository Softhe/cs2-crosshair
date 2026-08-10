import { useCallback, useEffect, useState } from 'react';
import { trackStudioEvent } from '@/lib/observability';

const PALETTE_STORAGE_KEY = 'cs2_studio_palette';
const GUIDE_STORAGE_KEY = 'cs2_studio_guide_dismissed';

export type StudioPalette = 'tactical' | 'cs2' | 'crimson';

export const PALETTE_OPTIONS: Array<{ name: string; value: StudioPalette; colors: [string, string]; description: string }> = [
	{ name: 'Tactical', value: 'tactical', colors: ['#1dbd9f', '#25bfe1'], description: 'Deep petrol surfaces with teal and sea-glass highlights.' },
	{ name: 'CS2', value: 'cs2', colors: ['#e88632', '#6f91a8'], description: 'Counter-Strike-inspired gunmetal, warm orange, sand, and steel blue.' },
	{ name: 'Crimson', value: 'crimson', colors: ['#943b58', '#c18a95'], description: 'Calm wine red with dusty rose highlights on deep merlot surfaces.' },
];

const getStoredPalette = (): StudioPalette => {
	try {
		const stored = localStorage.getItem(PALETTE_STORAGE_KEY);
		return PALETTE_OPTIONS.some(({ value }) => value === stored) ? stored as StudioPalette : 'tactical';
	} catch {
		return 'tactical';
	}
};

const shouldShowGuide = () => {
	try {
		return localStorage.getItem(GUIDE_STORAGE_KEY) !== 'true';
	} catch {
		return true;
	}
};

export const useStudioPreferences = () => {
	const [palette, setPalette] = useState<StudioPalette>(getStoredPalette);
	const [showGuide, setShowGuide] = useState(shouldShowGuide);

	useEffect(() => {
		const root = document.documentElement;
		root.dataset.palette = palette;
		try {
			localStorage.setItem(PALETTE_STORAGE_KEY, palette);
		} catch {
			// The selected palette still applies when storage is unavailable.
		}
		return () => { delete root.dataset.palette; };
	}, [palette]);

	const dismissGuide = useCallback(() => {
		setShowGuide(false);
		try {
			localStorage.setItem(GUIDE_STORAGE_KEY, 'true');
		} catch {
			// The guide can reappear if storage is unavailable.
		}
		trackStudioEvent('guide_dismissed');
	}, []);

	return { palette, setPalette, showGuide, dismissGuide };
};
