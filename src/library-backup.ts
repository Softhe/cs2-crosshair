import { newId } from './ids';
import { limitLibrary, settingsKey, validateLibrary, type Saved } from './storage';

export const BACKUP_MAX_BYTES = 500000;

export function backupFile(library: Saved[]): string {
  return JSON.stringify({ version: 1, entries: library }, null, 2);
}

/** Validate a library backup file. Throws a message fit to show the user. */
export function parseBackup(text: string): Saved[] {
  const data = JSON.parse(text);
  if (data.version !== 1) throw Error('Unsupported backup version.');
  const entries = validateLibrary(data.entries);
  if (entries.filter((i) => i.favorite).length > 50 || entries.filter((i) => !i.favorite).length > 20)
    throw Error('Backup exceeds library limits.');
  return entries;
}

/**
 * Add backup entries to the library. Every existing entry is kept, even two favorites with the
 * same settings. A backup entry already saved (or already in history) is skipped, clashing ids
 * get fresh ones, and the result stays within limits.
 */
export function mergeBackup(library: Saved[], entries: Saved[]): Saved[] {
  const key = (item: Saved) => settingsKey(item.settings) + (item.favorite ? 'saved' : 'recent');
  const keys = new Set(library.map(key));
  const ids = new Set(library.map((item) => item.id));
  const added = entries
    .filter((item) => {
      if (keys.has(key(item))) return false;
      keys.add(key(item));
      return true;
    })
    .map((item) => {
      if (ids.has(item.id)) item = { ...item, id: newId() };
      ids.add(item.id);
      return item;
    });
  return limitLibrary([...library, ...added]);
}
