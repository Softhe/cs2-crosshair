import { useCallback, useState } from 'react';
import type { Settings } from './model';

/** Undo stack for crosshair settings. Push the current value before applying a change. */
export function useUndo(settings: Settings) {
  const [undo, setUndo] = useState<Settings[]>([]);
  const push = useCallback(
    (prev: Settings = settings) => {
      setUndo((items) => [...items.slice(-29), prev]);
    },
    [settings],
  );
  const goBack = useCallback(
    (apply: (value: Settings) => void) => {
      const previous = undo[undo.length - 1];
      if (previous === undefined) return;
      apply(previous);
      setUndo(undo.slice(0, -1));
    },
    [undo],
  );
  const clear = useCallback(() => setUndo([]), []);
  return { undo, setUndo, push, goBack, canUndo: undo.length > 0, clear };
}
