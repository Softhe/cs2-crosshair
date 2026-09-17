import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { clampCrosshair, encodeCrosshair, type Crosshair } from '@/lib/cs2-sharecode';
import { parseShareCode } from '@/lib/crosshair-output';
import { loadCustomCrosshair } from '@/lib/custom-crosshair-storage';
import { getShareCodeFromUrl, getShareCodeUrlPath } from '@/lib/share-url';
import { trackStudioEvent } from '@/lib/observability';

export interface StudioUrlSync {
	crosshair: Crosshair;
	importCode: string;
	importError: string;
	setImportCode: (code: string) => void;
	setImportError: (error: string) => void;
	applyCrosshair: (nextCrosshair: Crosshair) => void;
	markExternalCode: (code: string) => void;
	resetToDefault: (defaultCrosshair: Crosshair) => void;
}

/**
 * Owns the editor's crosshair state and its two-way binding with the URL.
 * The encoded share code is the portable representation: edits re-encode and
 * replace the URL, while external navigations decode back into editor state.
 * `onExternalImport` reports URL-driven loads so the page can record history.
 */
export const useStudioUrlSync = ({ defaultCrosshair, onExternalImport }: {
	defaultCrosshair: Crosshair;
	onExternalImport: (crosshair: Crosshair) => void;
}): StudioUrlSync => {
	const location = useLocation();
	const navigate = useNavigate();
	const pendingUrlCode = useRef<string | undefined>(undefined);
	const lastExternalHistoryCode = useRef<string | null>(null);

	const [initialState] = useState(() => {
		const urlCode = getShareCodeFromUrl(location);
		const parsed = parseShareCode(urlCode);
		const crosshair = parsed.valid ? parsed.crosshair : loadCustomCrosshair(defaultCrosshair);
		return {
			crosshair,
			importCode: urlCode || encodeCrosshair(crosshair),
			importError: urlCode && !parsed.valid ? parsed.error : '',
		};
	});
	const [crosshair, setCrosshair] = useState<Crosshair>(initialState.crosshair);
	const [importCode, setImportCode] = useState(initialState.importCode);
	const [importError, setImportError] = useState(initialState.importError);
	const shareCode = encodeCrosshair(crosshair);

	useEffect(() => {
		const urlCode = getShareCodeFromUrl({ pathname: location.pathname, search: location.search });
		if (pendingUrlCode.current !== undefined) {
			if (urlCode === pendingUrlCode.current) {
				pendingUrlCode.current = undefined;
			}
			return;
		}
		if (!urlCode) {
			// URL navigation is external state; mirror it into the editor after the location changes.
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setImportCode(shareCode);
			setImportError('');
			return;
		}
		const parsed = parseShareCode(urlCode);
		if (!parsed.valid) {
			trackStudioEvent('import_failed');
			setImportCode(urlCode);
			setImportError(parsed.error);
			return;
		}
		const decoded = parsed.crosshair;
		if (lastExternalHistoryCode.current !== urlCode) {
			lastExternalHistoryCode.current = urlCode;
			onExternalImport(decoded);
		}
		if (urlCode === shareCode) {
			setImportCode(urlCode);
			setImportError('');
			return;
		}
		setCrosshair(decoded);
		setImportCode(urlCode);
		setImportError('');
	}, [location.pathname, location.search, onExternalImport, shareCode]);

	const applyCrosshair = useCallback((nextCrosshair: Crosshair) => {
		const next = clampCrosshair(nextCrosshair);
		const nextCode = encodeCrosshair(next);
		setCrosshair(next);
		setImportCode(nextCode);
		setImportError('');
		pendingUrlCode.current = getShareCodeFromUrl(location) === nextCode ? undefined : nextCode;
		navigate(getShareCodeUrlPath(nextCode), { replace: true });
	}, [location, navigate]);

	const markExternalCode = useCallback((code: string) => {
		lastExternalHistoryCode.current = code;
	}, []);

	const resetToDefault = useCallback((nextDefault: Crosshair) => {
		const defaultCode = encodeCrosshair(nextDefault);
		setCrosshair({ ...nextDefault });
		setImportCode(defaultCode);
		setImportError('');
		pendingUrlCode.current = getShareCodeFromUrl(location) ? '' : undefined;
		navigate('/', { replace: true });
	}, [location, navigate]);

	return {
		crosshair,
		importCode,
		importError,
		setImportCode,
		setImportError,
		applyCrosshair,
		markExternalCode,
		resetToDefault,
	};
};
