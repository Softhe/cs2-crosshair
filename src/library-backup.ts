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
 * Add backup entries to the library. Existing entries win: a crosshair already saved (or already
 * in history) is not duplicated, clashing ids get fresh ones, and the result stays within limits.
 */
export function mergeBackup(library: Saved[], entries: Saved[]): Saved[] {
  const keys = new Set<string>();
  const ids = new Set<string>();
  const combined = [...library, ...entries]
    .filter((item) => {
      const key = settingsKey(item.settings) + (item.favorite ? 'saved' : 'recent');
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    })
    .map((item) => {
      if (ids.has(item.id)) item = { ...item, id: newId() };
      ids.add(item.id);
      return item;
    });
  return limitLibrary(combined);
}
