import { useCallback, useRef, useState } from 'react';
import type { Settings } from './model';

/** Changes to the same group closer together than this share one undo entry (one slider drag, one held arrow key). */
export const UNDO_GROUP_MS = 1000;
export type UndoGroup = { key: string; at: number } | null;

/** Pure push step: a grouped change continuing the previous group keeps the existing entry. */
export function pushUndo(items: Settings[], prev: Settings, last: UndoGroup, group: string | undefined, now: number): { items: Settings[]; last: UndoGroup } {
  const next = group ? { key: group, at: now } : null;
  if (group && last && last.key === group && now - last.at < UNDO_GROUP_MS && items.length) return { items, last: next };
  return { items: [...items.slice(-29), prev], last: next };
}

/** Undo stack for crosshair settings. Push the current value before applying a change. */
export function useUndo(settings: Settings) {
  const [undo, setUndo] = useState<Settings[]>([]);
  const last = useRef<UndoGroup>(null);
  const push = useCallback(
    (prev: Settings = settings, group?: string) => {
      const now = Date.now(), previous = last.current;
      last.current = group ? { key: group, at: now } : null;
      setUndo((items) => pushUndo(items, prev, previous, group, now).items);
    },
    [settings],
  );
  const goBack = useCallback(
    (apply: (value: Settings) => void) => {
      const previous = undo[undo.length - 1];
      if (previous === undefined) return;
      last.current = null;
      apply(previous);
      setUndo(undo.slice(0, -1));
    },
    [undo],
  );
  const clear = useCallback(() => { last.current = null; setUndo([]); }, []);
  return { undo, setUndo, push, goBack, canUndo: undo.length > 0, clear };
}
