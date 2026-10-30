import { useEffect, useRef, useState } from 'react';
import { gameView, validatePreferences, type GameView } from './preferences';

export type PreferenceSyncStatus = 'local' | 'loading' | 'synced' | 'pending' | 'error';
const request = (path: string, options: RequestInit = {}) =>
  fetch(path, { credentials: 'same-origin', ...options, signal: AbortSignal.timeout(12_000) });

/**
 * Keeps the game-view preference on the signed-in Steam account. The account copy wins when the
 * page loads or regains focus; later local changes are written back after a short pause.
 */
export function usePreferenceSync(owner: string | null, value: GameView, apply: (value: GameView) => void): PreferenceSyncStatus {
  const [status, setStatus] = useState<PreferenceSyncStatus>('local');
  const [loaded, setLoaded] = useState<string | null>(null);
  const remote = useRef<string | null>(null), csrf = useRef(''), writing = useRef(false);
  const latest = useRef({ value, apply });
  latest.current = { value, apply };
  useEffect(() => {
    setLoaded(null);
    if (!owner) {
      setStatus('local');
      return;
    }
    let disposed = false;
    const load = async () => {
      if (writing.current) return;
      setStatus((current) => (current === 'synced' ? current : 'loading'));
      try {
        const session = await (await request('/api/session')).json();
        if (session?.user?.steamId !== owner) throw Error('Session changed.');
        csrf.current = typeof session.csrfToken === 'string' ? session.csrfToken : '';
        const response = await request('/api/preferences');
        if (!response.ok) throw Error('Preferences unavailable.');
        const stored = (await response.json())?.preferences;
        if (disposed) return;
        if (stored) {
          const view = validatePreferences(stored).gameView;
          remote.current = JSON.stringify(view);
          if (JSON.stringify(latest.current.value) !== remote.current) latest.current.apply(view);
        } else remote.current = null;
        setLoaded(owner);
        setStatus(stored ? 'synced' : 'pending');
      } catch {
        if (!disposed) setStatus('error');
      }
    };
    void load();
    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', refresh);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [owner]);
  useEffect(() => {
    if (!owner || loaded !== owner) return;
    const serialized = JSON.stringify(gameView(value));
    if (serialized === remote.current) {
      setStatus('synced');
      return;
    }
    setStatus('pending');
    let retry: ReturnType<typeof setTimeout> | undefined;
    const save = async () => {
      writing.current = true;
      try {
        const response = await request('/api/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.current },
          body: JSON.stringify({ preferences: { gameView: JSON.parse(serialized) } }),
        });
        if (response.status === 429) {
          const seconds = Number(response.headers.get('Retry-After'));
          retry = setTimeout(save, Math.min(3600, seconds > 0 ? seconds : 60) * 1000);
          return;
        }
        if (!response.ok) throw Error('Preferences sync failed.');
        remote.current = serialized;
        setStatus('synced');
      } catch {
        setStatus('error');
      } finally {
        writing.current = false;
      }
    };
    // Typing a custom resolution produces several valid values in a row; send only the settled one.
    const timer = setTimeout(save, 800);
    return () => {
      clearTimeout(timer);
      clearTimeout(retry);
    };
  }, [owner, loaded, value]);
  return status;
}
