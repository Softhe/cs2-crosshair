import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { read, write, validateLibrary, settingsKey, type Saved } from './storage';
import { newId } from './ids';
import { migrateSettings, type Settings } from './model';
export type CloudEntry = { id: string; name: string; settings: Settings };
export type Snapshot = { revision: number; entries: CloudEntry[] };
export type Queue = { base: Snapshot; entries: CloudEntry[]; history: Saved[] };
export type UpdateLibrary = (update: SetStateAction<Saved[]>) => boolean;
export class LibraryStorageError extends Error {
  constructor() {
    super('Changes could not be saved on this device. Free browser storage or export a backup.');
  }
}
export function syncErrorMessage(error: unknown): string {
  return error instanceof LibraryStorageError
    ? error.message
    : error instanceof Error && /limit|Invalid cloud/.test(error.message)
      ? error.message
      : 'Library sync is unavailable. Your saved local changes are retained.';
}
export function persistGuest(entries: Saved[]): void {
  if (!write('library', entries)) throw new LibraryStorageError();
}
export function hasUnmergedGuestFavorites(guest: Saved[], account: Saved[]): boolean {
  const keys = new Set(account.filter((e) => e.favorite).map((e) => settingsKey(e.settings)));
  return guest.some((e) => e.favorite && !keys.has(settingsKey(e.settings)));
}
export type SyncStatus = 'local' | 'loading' | 'synced' | 'pending' | 'error';
const API_TIMEOUT_MS = 12_000;
function apiRequest(path: string, options: RequestInit = {}) {
  return fetch(path, { ...options, signal: timeoutSignal() });
}
export function validateSnapshot(value: unknown): Snapshot {
  const v = value as Snapshot;
  if (
    !v ||
    !Number.isSafeInteger(v.revision) ||
    v.revision < 0 ||
    !Array.isArray(v.entries) ||
    v.entries.length > 50
  )
    throw Error('Invalid cloud library.');
  const ids = new Set<string>();
  return {
    revision: v.revision,
    entries: v.entries.map((e) => {
      if (
        !e ||
        typeof e.id !== 'string' ||
        !/^[A-Za-z0-9_-]{1,80}$/.test(e.id) ||
        ids.has(e.id) ||
        typeof e.name !== 'string' ||
        !e.name.trim() ||
        e.name.length > 80
      )
        throw Error('Invalid cloud entry.');
      ids.add(e.id);
      return { id: e.id, name: e.name, settings: migrateSettings(e.settings) };
    }),
  };
}
export function cloudFavorites(entries: Saved[]): CloudEntry[] {
  return entries.filter((e) => e.favorite).map(({ id, name, settings }) => ({ id, name, settings }));
}
const equal = (a: CloudEntry | undefined, b: CloudEntry | undefined) =>
  a === b || (!!a && !!b && a.name === b.name && settingsKey(a.settings) === settingsKey(b.settings));
export function mergeGuestFavorites(remote: CloudEntry[], guest: CloudEntry[]): CloudEntry[] {
  const result = [...remote];
  const keys = new Set(remote.map((e) => settingsKey(e.settings)));
  const ids = new Set(remote.map((e) => e.id));
  for (const entry of guest)
    if (!keys.has(settingsKey(entry.settings))) {
      const e = { ...entry, id: ids.has(entry.id) ? newId() : entry.id };
      result.push(e);
      keys.add(settingsKey(e.settings));
      ids.add(e.id);
    }
  if (result.length > 50) throw Error('Merge exceeds the 50 favorite limit. Remove some favorites first.');
  return result;
}
export function mergeConflict(base: CloudEntry[], local: CloudEntry[], remote: CloudEntry[]): CloudEntry[] {
  const b = new Map(base.map((e) => [e.id, e])),
    l = new Map(local.map((e) => [e.id, e])),
    r = new Map(remote.map((e) => [e.id, e]));
  const out: CloudEntry[] = [];
  for (const id of new Set([...b.keys(), ...l.keys(), ...r.keys()])) {
    const before = b.get(id),
      ours = l.get(id),
      theirs = r.get(id);
    if (equal(ours, before)) {
      if (theirs) out.push(theirs);
    } else if (equal(theirs, before) || equal(ours, theirs)) {
      if (ours) out.push(ours);
    } else {
      if (theirs) out.push(theirs);
      if (ours) out.push({ ...ours, id: theirs ? newId() : ours.id });
    }
  }
  if (out.length > 50)
    throw Error('Conflicting changes exceed the favorite limit. Your pending library is retained.');
  return out;
}
export function queueKey(steamId: string) {
  if (!/^\d{17}$/.test(steamId)) throw Error('Invalid Steam account.');
  return 'steam-library.' + steamId;
}
export function persistQueue(steamId: string, queue: Queue) {
  if (JSON.stringify(read(queueKey(steamId), null)) === JSON.stringify(queue)) return;
  if (!write(queueKey(steamId), queue)) throw new LibraryStorageError();
}
function restoreQueue(id: string): Queue | null {
  const q = read<Queue | null>(queueKey(id), null);
  if (!q) return null;
  return {
    base: validateSnapshot(q.base),
    entries: validateSnapshot({ revision: 0, entries: q.entries }).entries,
    history: validateLibrary(q.history).filter((e) => !e.favorite),
  };
}
function saved(entries: CloudEntry[]): Saved[] {
  return entries.map((e) => ({ ...e, alias: '', favorite: true, date: '' }));
}
function timeoutSignal(): AbortSignal | undefined {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(API_TIMEOUT_MS);
    }
  } catch {
    /* Fall through to manual controller. */
  }
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    return controller.signal;
  } catch {
    return undefined;
  }
}
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
async function fetchLibrary(url: string, init: RequestInit = {}, retries = 3): Promise<Response> {
  let error: unknown = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) await sleep(300 * 2 ** (attempt - 1));
    try {
      const response = await apiRequest(url, init);
      if (response.ok || ![502, 503, 504].includes(response.status)) return response;
      error = new Error('Library sync failed.');
    } catch (cause) {
      error = cause;
    }
  }
  throw error instanceof Error ? error : new Error('Library sync failed.');
}
export function useLibrarySync(guestLibrary: Saved[], setGuestLibrary: Dispatch<SetStateAction<Saved[]>>) {
  const [sessionState, setSessionState] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [available, setAvailable] = useState(false),
    [error, setError] = useState<string | null>(null);
  const guestRef = useRef(guestLibrary);
  useEffect(() => {
    guestRef.current = guestLibrary;
  }, [guestLibrary]);
  const fail = (cause: unknown) => {
    setError(syncErrorMessage(cause));
    setStatus('error');
  };
  const [user, setUser] = useState<{ steamId: string } | null>(null),
    [status, setStatus] = useState<SyncStatus>('loading'),
    [accountLibrary, setAccountLibrary] = useState<Saved[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [tick, setTick] = useState(0);
  const csrf = useRef(''),
    active = useRef<string | null>(null),
    queue = useRef<Queue | null>(null),
    generation = useRef(0),
    busy = useRef(false),
    rerun = useRef(false);
  const publish = (q: Queue) => setAccountLibrary([...saved(q.entries), ...q.history]);
  async function synchronize(id: string, epoch: number) {
    // A request that arrives mid-sync (another tab's storage event, a retry) runs once the current pass ends instead of being dropped.
    if (busy.current) {
      rerun.current = true;
      return false;
    }
    busy.current = true;
    rerun.current = false;
    setSyncing(true);
    try {
      const sessionResponse = await fetchLibrary('/api/session', { credentials: 'same-origin' });
      if (!sessionResponse.ok) throw Error('Session unavailable.');
      const session = await sessionResponse.json();
      if (generation.current !== epoch || active.current !== id) return;
      if (session.user?.steamId !== id) {
        generation.current++;
        active.current = null;
        queue.current = null;
        setUser(null);
        setAccountLibrary([]);
        setSyncing(false);
        setStatus('loading');
        setTick((t) => t + 1);
        return;
      }
      csrf.current = session.csrfToken;
      const response = await fetchLibrary('/api/library', {
        credentials: 'same-origin',
        headers: { 'X-CSRF-Token': csrf.current },
      });
      if (!response.ok) throw Error('Library unavailable.');
      const remote = validateSnapshot(await response.json());
      if (generation.current !== epoch || active.current !== id) return;
      let q = queue.current ?? { base: remote, entries: remote.entries, history: [] };
      const disk = restoreQueue(id);
      if (disk)
        q = {
          base: disk.base,
          entries: mergeConflict(q.base.entries, q.entries, disk.entries),
          history: disk.history,
        };
      q = { ...q, entries: mergeConflict(q.base.entries, q.entries, remote.entries), base: remote };
      persistQueue(id, q);
      queue.current = q;
      publish(q);
      for (let attempt = 0; attempt < 3; attempt++) {
        if (JSON.stringify(q.entries) === JSON.stringify(q.base.entries)) {
          setError(null);
          setStatus('synced');
          return true;
        }
        if (attempt > 0) await sleep(300 * 2 ** (attempt - 1));
        setStatus('pending');
        const sent = q;
        const put = await fetchLibrary(
          '/api/library',
          {
            method: 'PUT',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.current },
            body: JSON.stringify({ revision: sent.base.revision, entries: sent.entries }),
          },
          1,
        );
        if (generation.current !== epoch || active.current !== id) return;
        if (!put.ok && put.status !== 409) throw Error('Library sync failed.');
        const latest = validateSnapshot(await put.json());
        let current = queue.current!;
        const disk = restoreQueue(id);
        if (disk)
          current = {
            base: disk.base,
            entries: mergeConflict(current.base.entries, current.entries, disk.entries),
            history: disk.history,
          };
        q = {
          base: latest,
          entries: mergeConflict(
            put.status === 409 ? sent.base.entries : sent.entries,
            current.entries,
            latest.entries,
          ),
          history: current.history,
        };
        persistQueue(id, q);
        queue.current = q;
        publish(q);
      }
      setStatus('pending');
    } catch (cause) {
      if (generation.current === epoch) fail(cause);
    } finally {
      busy.current = false;
      if (generation.current === epoch) setSyncing(false);
      if (rerun.current && active.current) {
        rerun.current = false;
        const next = active.current;
        queueMicrotask(() => {
          void synchronize(next, generation.current);
        });
      }
    }
  }
  useEffect(() => {
    const epoch = ++generation.current;
    let disposed = false;
    // Re-checks after focus keep a known-ready header instead of flashing a disabled spinner.
    setSessionState((state) => (state === 'ready' ? state : 'checking'));
    void (async () => {
      try {
        const response = await apiRequest('/api/session', { credentials: 'same-origin' });
        if (!response.ok) {
          if (!disposed) {
            setStatus('local');
            setAvailable(false);
            setSessionState('unavailable');
          }
          return;
        }
        const session = await response.json();
        if (disposed) return;
        if (!session || !('user' in session)) throw Error('Invalid session.');
        setAvailable(true);
        setSessionState('ready');
        csrf.current = typeof session.csrfToken === 'string' ? session.csrfToken : '';
        const id = session.user?.steamId;
        if (id) {
          queueKey(id);
          active.current = id;
          queue.current = null;
          setAccountLibrary([]);
          setUser({ steamId: id });
          try {
            queue.current = restoreQueue(id) ?? {
              base: { revision: 0, entries: [] },
              entries: [],
              history: [],
            };
          } catch (cause) {
            fail(cause);
            return;
          }
          setAccountLibrary(queue.current ? [...saved(queue.current.entries), ...queue.current.history] : []);
          await synchronize(id, epoch);
        } else {
          active.current = null;
          queue.current = null;
          setUser(null);
          setStatus('local');
        }
      } catch {
        if (!disposed) {
          setStatus('local');
          setAvailable(false);
          setSessionState('unavailable');
        }
      }
    })();
    return () => {
      disposed = true;
      generation.current++;
    };
  }, [tick]);
  useEffect(() => {
    const retry = () => {
      // Focus and visibility often fire together; a running pass already fetches the latest state.
      if (busy.current || document.visibilityState === 'hidden') return;
      const id = active.current;
      if (id) void synchronize(id, generation.current);
      else setTick((t) => t + 1);
    };
    const changed = (event: StorageEvent) => {
      if (active.current && event.key === 'delli.v3.' + queueKey(active.current)) {
        generation.current++;
        try {
          queue.current = restoreQueue(active.current);
          if (queue.current) publish(queue.current);
          setStatus('pending');
          const id = active.current;
          const epoch = generation.current;
          queueMicrotask(() => {
            void synchronize(id, epoch);
          });
        } catch (cause) {
          fail(cause);
        }
      }
    };
    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    document.addEventListener('visibilitychange', retry);
    window.addEventListener('storage', changed);
    return () => {
      window.removeEventListener('online', retry);
      window.removeEventListener('focus', retry);
      document.removeEventListener('visibilitychange', retry);
      window.removeEventListener('storage', changed);
    };
  }, []);
  const setLibrary: UpdateLibrary = (update) => {
    const id = active.current;
    if (!id) {
      try {
        const previous = guestRef.current;
        const next = typeof update === 'function' ? update(previous) : update;
        persistGuest(next);
        guestRef.current = next;
        setGuestLibrary(next);
        setError(null);
        setStatus('local');
        return true;
      } catch (cause) {
        fail(cause);
        return false;
      }
    }
    if (!queue.current) {
      fail(Error('Library unavailable.'));
      return false;
    }
    try {
      let q = queue.current;
      const disk = restoreQueue(id);
      if (disk) {
        q = {
          base: disk.base,
          entries: mergeConflict(q.base.entries, q.entries, disk.entries),
          history: disk.history,
        };
      }
      const previous = [...saved(q.entries), ...q.history];
      const next = typeof update === 'function' ? update(previous) : update;
      const entries = cloudFavorites(next);
      // The server rejects more than 50 favorites; queuing them would leave sync failing on every retry.
      if (entries.length > 50) throw Error('Your library is at the 50 favorite limit. Remove a favorite first.');
      const updated = {
        ...q,
        entries,
        history: next.filter((e) => !e.favorite).slice(0, 20),
      };
      persistQueue(id, updated);
      queue.current = updated;
      publish(updated);
      setError(null);
      setStatus('pending');
      void synchronize(id, generation.current);
      return true;
    } catch (cause) {
      fail(cause);
      return false;
    }
  };
  async function signOut() {
    try {
      const response = await apiRequest('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-CSRF-Token': csrf.current },
      });
      if (!response.ok) {
        fail(Error('Sign out failed.'));
        return false;
      }
      generation.current++;
      active.current = null;
      queue.current = null;
      setUser(null);
      setAccountLibrary([]);
      setError(null);
      setStatus('local');
      setSyncing(false);
      return true;
    } catch (cause) {
      fail(cause);
      return false;
    }
  }
  function mergeGuest() {
    if (!active.current || !queue.current) return false;
    try {
      return setLibrary((previous) => [
        ...saved(mergeGuestFavorites(cloudFavorites(previous), cloudFavorites(guestLibrary))),
        ...previous.filter((e) => !e.favorite),
      ]);
    } catch (cause) {
      fail(cause);
      return false;
    }
  }
  return {
    user,
    sessionState,
    status,
    syncing,
    error: status === 'error' ? error : null,
    canSync: available,
    available,
    library: user ? accountLibrary : guestLibrary,
    setLibrary,
    mergeGuest,
    hasGuestFavorites: !!user && hasUnmergedGuestFavorites(guestLibrary, accountLibrary),
    signIn: '/api/auth/steam',
    signOut,
    retry: async () => {
      const id = active.current;
      if (id) return await synchronize(id, generation.current);
      setTick((t) => t + 1);
      return false;
    },
  };
}
