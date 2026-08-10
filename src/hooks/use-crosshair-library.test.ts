import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCrosshairLibrary } from '@/hooks/use-crosshair-library';
import { addToHistory, getFavorites, getHistory } from '@/lib/storage';

const FIRST_CODE = 'CSGO-wAD3c-ykt5L-zvZ98-vBisR-6sWPA';
const SECOND_CODE = 'CSGO-RBZih-6Hynp-ieuGe-tTkVz-9PqNO';

describe('useCrosshairLibrary', () => {
	beforeEach(() => localStorage.clear());

	it('filters, renames, favorites, and removes through one state boundary', () => {
		addToHistory({ shareCode: FIRST_CODE, aliasName: 'primary' });
		addToHistory({ shareCode: SECOND_CODE, aliasName: 'backup' });
		const { result } = renderHook(() => useCrosshairLibrary());

		act(() => result.current.setQuery('primary'));
		expect(result.current.filteredHistory.map(({ shareCode }) => shareCode)).toEqual([FIRST_CODE]);

		const item = result.current.filteredHistory[0];
		act(() => result.current.setDraftAlias(item.id, 'renamed'));
		act(() => result.current.commitAlias(item));
		expect(getHistory().find(({ id }) => id === item.id)?.aliasName).toBe('renamed');

		act(() => { expect(result.current.toggle(item)).toBe(true); });
		expect(getFavorites()).toHaveLength(1);

		act(() => result.current.remove(item.id));
		expect(getHistory()).toHaveLength(1);
	});
});
