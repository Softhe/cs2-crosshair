import { useEffect, useRef, useState } from 'react';
import { newId } from './ids';
import type { useLibrarySync } from './library-sync';
import { styles, type Settings } from './model';
import { limitLibrary, settingsKey, type Saved } from './storage';
import type { Notify } from './useToast';

type Sync = ReturnType<typeof useLibrarySync>;

/** Saving crosshairs to the library, recent history, and the Steam sync status shown while saving. */
export function useFavorites({ s, alias, aliasError, setAlias, sync, notify, load, openEditor }: {
  s: Settings;
  alias: string;
  aliasError: string;
  setAlias: (alias: string) => void;
  sync: Sync;
  notify: Notify;
  load: (settings: Settings) => void;
  openEditor: () => void;
}) {
  const { library, setLibrary } = sync;
  const [savedName, setSavedName] = useState('My crosshair');
  const [editingId, setEditingId] = useState<string | null>(null);
  const savedAlias = aliasError ? '' : alias.trim();

  const awaitingSaveSync = useRef(false);
  const rateLimited = !!sync.error?.startsWith('Too many sync attempts');
  useEffect(() => {
    if (!sync.user) awaitingSaveSync.current = false;
    if (!awaitingSaveSync.current || sync.syncing) return;
    if (sync.status === 'synced' || sync.status === 'error') {
      awaitingSaveSync.current = false;
      notify(
        sync.status === 'synced'
          ? 'Crosshair saved and synced to Steam.'
          : rateLimited
            ? 'Crosshair saved. ' + sync.error
            : 'Crosshair saved on this device. Sync failed. Retry sync in Library.',
        sync.status === 'synced' ? 'success' : 'warning',
      );
    }
  }, [sync.status, sync.syncing, sync.user, sync.error]);
  function notifySaved(text: string) {
    awaitingSaveSync.current = !!sync.user;
    notify(
      sync.user ? text + ' Syncing to Steam…' : text + ' Sign in with Steam to sync across devices.',
      sync.user ? 'info' : 'success',
    );
  }
  const saveSyncLabel = sync.error?.startsWith('Changes could not be saved')
    ? 'Local save failed'
    : sync.user
      ? sync.syncing
        ? 'Saved on this device · Syncing to Steam…'
        : sync.status === 'synced'
          ? 'Saved and synced to Steam'
          : sync.status === 'loading'
            ? 'Loading library…'
            : sync.status === 'error'
              ? rateLimited
                ? 'Saved on this device · Sync resumes automatically'
                : 'Saved on this device · Sync failed. Retry in Library.'
              : 'Saved on this device · Waiting to sync'
      : 'Saved on this device · Sign in with Steam to sync';

  /** Record a crosshair in recent history (or name an existing entry when `favorite`). */
  function remember(
    settings = s,
    name = styles.find(([id]) => id === settings.cl_crosshairstyle)?.[1] ?? 'Crosshair',
    favorite = false,
  ) {
    const entry: Saved = { id: newId(), name, settings: { ...settings }, alias: savedAlias, favorite, date: new Date().toISOString() };
    setLibrary((prev) => {
      const same = prev.find((item) => settingsKey(item.settings) === settingsKey(settings));
      if (same?.favorite) return prev;
      if (same)
        return prev.map((item) =>
          item.id === same.id
            ? { ...item, name: favorite ? name : item.name, alias: entry.alias, date: entry.date, favorite: favorite || item.favorite }
            : item,
        );
      return limitLibrary([entry, ...prev]);
    });
  }

  const currentFavorite = library.find((item) => item.favorite && settingsKey(item.settings) === settingsKey(s));
  useEffect(() => {
    if (currentFavorite) setSavedName(currentFavorite.name);
  }, [currentFavorite?.id, currentFavorite?.name]);
  const editingFavorite = library.find((item) => item.favorite && item.id === editingId);

  function saveFavorite() {
    if (!savedName.trim()) {
      notify('Give your crosshair a name.', 'warning');
      document.getElementById('saved-name')?.focus();
      return;
    }
    if (!currentFavorite && library.filter((item) => item.favorite).length >= 50) {
      notify('Your library has 50 favorites. Remove one before saving another.', 'warning');
      return;
    }
    if (currentFavorite) {
      notify('This crosshair is already saved.', 'warning');
      return;
    }
    const entry: Saved = { id: newId(), name: savedName.trim(), settings: { ...s }, alias: savedAlias, favorite: true, date: new Date().toISOString() };
    const saved = setLibrary((items) =>
      limitLibrary([entry, ...items.filter((item) => item.favorite || settingsKey(item.settings) !== settingsKey(s))]),
    );
    if (saved) {
      setEditingId(entry.id);
      notifySaved('Crosshair saved.');
    } else notify('Crosshair could not be saved on this device. Export a backup or free browser storage.', 'error');
  }

  function updateFavorite() {
    if (!editingFavorite) return;
    if (!savedName.trim()) {
      notify('Give your crosshair a name.', 'warning');
      return;
    }
    const saved = setLibrary((items) =>
      items.map((item) =>
        item.id === editingFavorite.id ? { ...item, name: savedName.trim(), settings: { ...s }, date: new Date().toISOString() } : item,
      ),
    );
    if (saved) notifySaved('Saved crosshair updated.');
    else notify('Update could not be saved on this device. Export a backup or free browser storage.', 'error');
  }

  function editSaved(item: Saved) {
    load(item.settings);
    // Synced favorites carry no alias, so loading one must not clear the alias being typed.
    if (item.alias || !sync.user) setAlias(item.alias);
    setSavedName(item.name);
    setEditingId(item.favorite ? item.id : null);
    openEditor();
    notify(item.name + ' loaded.');
  }

  return {
    savedName, setSavedName, setEditingId, currentFavorite, editingFavorite, saveSyncLabel,
    remember, saveFavorite, updateFavorite, editSaved,
  };
}
