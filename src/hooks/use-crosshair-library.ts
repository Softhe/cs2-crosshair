import { useCallback, useMemo, useState } from 'react';
import {
	getFavorites,
	getHistory,
	removeFromHistory,
	renameHistoryItem,
	toggleFavorite,
	type CrosshairData,
} from '@/lib/storage';

const matchesLibraryQuery = (item: CrosshairData, normalizedQuery: string) => (
	!normalizedQuery
	|| item.shareCode.toLowerCase().includes(normalizedQuery)
	|| item.aliasName?.toLowerCase().includes(normalizedQuery)
);

export const useCrosshairLibrary = () => {
	const [history, setHistory] = useState<CrosshairData[]>(getHistory);
	const [favorites, setFavorites] = useState<CrosshairData[]>(getFavorites);
	const [query, setQuery] = useState('');
	const [draftAliases, setDraftAliases] = useState<Record<string, string>>({});

	const refresh = useCallback(() => {
		setHistory(getHistory());
		setFavorites(getFavorites());
	}, []);

	const normalizedQuery = query.trim().toLowerCase();
	const filteredHistory = useMemo(() => history.filter((item) => matchesLibraryQuery(item, normalizedQuery)), [history, normalizedQuery]);
	const filteredFavorites = useMemo(() => favorites.filter((item) => matchesLibraryQuery(item, normalizedQuery)), [favorites, normalizedQuery]);

	const setDraftAlias = useCallback((id: string, value: string) => {
		setDraftAliases((current) => ({ ...current, [id]: value }));
	}, []);

	const commitAlias = useCallback((item: CrosshairData) => {
		const nextAlias = draftAliases[item.id];
		if (nextAlias === undefined || nextAlias === (item.aliasName || '')) return;
		renameHistoryItem(item.id, nextAlias);
		setDraftAliases((current) => {
			const next = { ...current };
			delete next[item.id];
			return next;
		});
		refresh();
	}, [draftAliases, refresh]);
	const commitAliasValue = useCallback((item: CrosshairData, value: string) => {
		if (value === (item.aliasName || '')) return;
		renameHistoryItem(item.id, value);
		refresh();
	}, [refresh]);

	const remove = useCallback((id: string) => {
		removeFromHistory(id);
		refresh();
	}, [refresh]);

	const toggle = useCallback((crosshair: CrosshairData) => {
		const favorite = toggleFavorite({
			shareCode: crosshair.shareCode,
			aliasName: crosshair.aliasName,
			activity: crosshair.activity,
			settings: crosshair.settings,
		});
		refresh();
		return favorite;
	}, [refresh]);
	const resetDraftAliases = useCallback(() => setDraftAliases({}), []);

	return {
		history, favorites, filteredHistory, filteredFavorites, query, setQuery,
		draftAliases, setDraftAlias, commitAlias, commitAliasValue, remove, toggle, refresh,
		resetDraftAliases,
	};
};
