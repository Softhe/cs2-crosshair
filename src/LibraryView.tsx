import { useEffect, useState } from 'react';
import type { UpdateLibrary } from './library-sync';
import { Bookmark, Copy, Download, Pencil, Search, Star, Trash2, Upload } from 'lucide-react';
import { Preview } from './Preview';
import { encode } from './codec';
import { limitLibrary, type Saved } from './storage';

type Props = {
  library: Saved[];
  setLibrary: UpdateLibrary;
  onLoad: (item: Saved) => void;
  onCopy: (text: string, label: string) => void;
  onBackup: () => void;
  onRestore: () => void;
  notify: (text: string, tone?: 'success' | 'warning' | 'error' | 'info') => void;
  user: { steamId: string } | null;
  status: string;
  syncing: boolean;
  error: string;
  available: boolean;
  hasGuestFavorites: boolean;
  onMerge: () => void;
  onRetry: () => void;
  onSignOut: () => void;
  signIn: string;
};
export function LibraryView(p: Props) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('favorites');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [rename, setRename] = useState('');
  const [removed, setRemoved] = useState<Saved[]>([]);
  useEffect(() => setRemoved([]), [p.user?.steamId]);
  function remove(item: Saved) {
    let deleted: Saved | undefined;
    if (
      p.setLibrary((items) => {
        deleted = items.find((entry) => entry.id === item.id);
        return items.filter((entry) => entry.id !== item.id);
      })
    ) {
      if (deleted) {
        setRemoved((items) => [deleted!, ...items.filter((entry) => entry.id !== item.id)].slice(0, 70));
        p.notify(deleted.name + ' removed. Use Undo to restore it.', 'info');
      }
    } else p.notify('Removal could not be saved on this device.', 'error');
  }
  function undo(item: Saved) {
    let issue = '';
    const saved = p.setLibrary((items) => {
      if (items.some((entry) => entry.id === item.id)) return items;
      if (items.filter((entry) => entry.favorite === item.favorite).length >= (item.favorite ? 50 : 20)) {
        issue = 'This collection is full. Remove an entry before restoring this crosshair.';
        return items;
      }
      return [item, ...items];
    });
    if (issue) {
      p.notify(issue, 'warning');
      return;
    }
    if (!saved) {
      p.notify('The crosshair could not be restored on this device.', 'error');
      return;
    }
    setRemoved((items) => items.filter((entry) => entry.id !== item.id));
    setSelectedId(item.id);
    p.notify('Crosshair restored.', 'success');
  }
  const favorites = p.library.filter((item) => item.favorite);
  const visible = p.library.filter(
    (item) =>
      (filter === 'all' || (filter === 'favorites' ? item.favorite : !item.favorite)) &&
      item.name.toLowerCase().includes(search.toLowerCase()),
  );
  const stored = p.library.find((item) => item.id === selectedId) ?? null;
  const selected = visible.find((item) => item.id === selectedId) ?? stored ?? visible[0];
  const syncLabel = p.syncing
    ? 'Syncing your library…'
    : p.error.startsWith('Changes could not be saved')
      ? 'Changes could not be saved'
      : p.status === 'error' && !p.user
        ? 'Local save failed'
        : p.user
          ? p.status === 'synced'
            ? 'Synced'
            : p.status === 'loading'
              ? 'Loading your Steam library…'
              : 'Saved on this device · waiting to sync'
          : 'Saved on this device';
  function finishRename(item: Saved) {
    const name = rename.trim();
    if (!name) {
      p.notify('Give your crosshair a name.', 'warning');
      return;
    }
    if (
      p.setLibrary((items) =>
        items.map((entry) =>
          entry.id === item.id ? { ...entry, name, date: new Date().toISOString() } : entry,
        ),
      )
    )
      setRenaming(null);
    else p.notify('Rename could not be saved on this device.', 'error');
  }
  function toggleFavorite(item: Saved) {
    if (!item.favorite && favorites.length >= 50) {
      p.notify('Favorite limit reached.', 'warning');
      return;
    }
    let full = false;
    // Move the toggled entry to the front so a full 20-entry history drops the oldest entry, not this one.
    const saved = p.setLibrary((items) => {
      const target = items.find((entry) => entry.id === item.id);
      if (!target) return items;
      // Re-check against the merged library: another tab may have filled the last slot since this render.
      if (!target.favorite && items.filter((entry) => entry.favorite).length >= 50) {
        full = true;
        return items;
      }
      return limitLibrary([
        { ...target, favorite: !target.favorite, date: new Date().toISOString() },
        ...items.filter((entry) => entry.id !== item.id),
      ]);
    });
    if (full) p.notify('Favorite limit reached.', 'warning');
    else if (!saved) p.notify('Change could not be saved on this device.', 'error');
  }
  return (
    <main className="collection-page" aria-label="Crosshair library">
      <div className="collection-heading">
        <div>
          <p className="eyebrow">YOUR COLLECTION</p>
          <h1>Your crosshair library</h1>
          <p className="intro">Save a name or player nickname. Preview, copy, or edit any saved crosshair.</p>
        </div>
        <span className="collection-count">{favorites.length} saved</span>
      </div>
      <section className="sync-panel" aria-label="Steam library sync">
        <div>
          <p className="sync-label" aria-label="Library sync status" aria-live="polite">
            {syncLabel}
          </p>
          <p>
            {p.user
              ? `Private library · Steam ${p.user.steamId}`
              : 'Use Steam to access your private collection across devices. Drafts and recent imports stay on this device.'}
          </p>
          {p.error && <p className="error-text">{p.error}</p>}
        </div>
        <div className="sync-actions">
          {p.user ? (
            <>
              <button disabled={p.syncing} aria-busy={p.syncing} onClick={p.onRetry}>
                {p.syncing ? 'Syncing…' : p.status === 'synced' ? 'Sync now' : 'Retry sync'}
              </button>
              <button onClick={p.onSignOut}>Sign out</button>
            </>
          ) : p.available ? (
            <span className="library-sign-in-hint">Sign in with Steam using the button in the header.</span>
          ) : (
            <span className="section-note">
              Steam sign-in is unavailable on this host. Local saving and backups still work.
            </span>
          )}
        </div>
      </section>
      {p.user && p.hasGuestFavorites && (
        <section className="guest-merge">
          <p>
            This device has saved crosshairs outside your Steam library. Add them without replacing your
            online collection. Exact duplicates are skipped.
          </p>
          <button className="primary-button" onClick={p.onMerge}>
            Add this device's saved crosshairs
          </button>
        </section>
      )}
      <div className="collection-layout">
        <section className="collection-list-panel">
          <div className="library-tools">
            <div className="search-box">
              <Search size={16} />
              <input
                aria-label="Search crosshairs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or player nickname"
              />
            </div>
            <select aria-label="Library filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="favorites">Saved crosshairs</option>
              <option value="history">Recent imports</option>
              <option value="all">All crosshairs</option>
            </select>
          </div>
          <p className="section-note">
            Up to 50 saved crosshairs. Recent history is separate and keeps up to 20 entries on this device.
          </p>
          <div className="collection-list">
            {visible.map((item) => (
              <article className={`library-item ${selected?.id === item.id ? 'selected' : ''}`} key={item.id}>
                <button
                  className="library-preview"
                  aria-label={`Preview ${item.name}`}
                  aria-pressed={selected?.id === item.id}
                  onClick={() => setSelectedId(item.id)}
                >
                  <Preview settings={item.settings} zoom={2} decorative fit />
                </button>
                <div className="library-info">
                  {renaming === item.id ? (
                    <input
                      autoFocus
                      aria-label="Rename crosshair"
                      value={rename}
                      maxLength={80}
                      onChange={(e) => setRename(e.target.value)}
                      onBlur={() => finishRename(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                    />
                  ) : (
                    <strong>{item.name}</strong>
                  )}
                  <span className={`library-badge ${item.favorite ? 'favorite' : 'history'}`}>
                    {item.favorite ? 'Favorite' : 'Recent history'}
                  </span>
                </div>
                <div className="library-item-actions">
                  <button onClick={() => p.onLoad(item)}>Load</button>
                  <button
                    className="icon-button"
                    aria-label={`Copy ${item.name}`}
                    title="Copy crosshair code"
                    onClick={() => p.onCopy(encode(item.settings), 'Share code')}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Rename ${item.name}`}
                    onClick={() => {
                      setRename(item.name);
                      setRenaming(item.id);
                    }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className={`icon-button ${item.favorite ? 'favorite' : ''}`}
                    aria-label={`${item.favorite ? 'Unfavorite' : 'Favorite'} ${item.name}`}
                    onClick={() => toggleFavorite(item)}
                  >
                    <Star size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => remove(item)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
            {!visible.length && (
              <div className="empty-library">
                <Bookmark size={32} />
                <h2>
                  {search
                    ? 'No matching crosshairs.'
                    : filter === 'history'
                      ? 'No recent imports.'
                      : 'Your collection starts here.'}
                </h2>
                <p>
                  {search
                    ? 'Try another name or clear the filters to see your collection.'
                    : 'Import a code in the editor, then save it with a name or player nickname.'}
                </p>
                {search && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setFilter('all');
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
          {removed.length > 0 && (
            <section className="library-recovery" aria-label="Recently removed crosshairs">
              <p>Removed crosshairs can be restored while this library stays open.</p>
              {removed.map((item) => (
                <div key={item.id}>
                  <span>Removed {item.name}</span>
                  <button aria-label={`Undo removal of ${item.name}`} onClick={() => undo(item)}>
                    Undo
                  </button>
                </div>
              ))}
            </section>
          )}
          <div className="collection-backups">
            <button onClick={p.onRestore}>
              <Upload size={15} />
              Restore backup
            </button>
            <button onClick={p.onBackup}>
              <Download size={15} />
              Export library
            </button>
          </div>
        </section>
        <section className="selected-crosshair" aria-label="Selected crosshair">
          {selected ? (
            <>
              <h2>{selected.name}</h2>
              <div className="collection-map">
                <Preview settings={selected.settings} zoom={2} fit paused />
              </div>
              <label className="field-label" htmlFor="selected-code">
                CS2 SHARE CODE
              </label>
              <textarea
                id="selected-code"
                className="selected-code"
                aria-label="Selected crosshair code"
                value={encode(selected.settings)}
                readOnly
              />
              <button
                className="primary-button full"
                onClick={() => p.onCopy(encode(selected.settings), 'Share code')}
              >
                <Copy size={16} />
                Copy selected crosshair code
              </button>
              <button className="quiet-button full" onClick={() => p.onLoad(selected)}>
                Edit crosshair
              </button>
              <p className="section-note">
                Editing creates a working draft. Your saved copy changes only when you choose Update saved
                crosshair.
              </p>
            </>
          ) : (
            <p className="section-note">Select a saved crosshair to preview it here.</p>
          )}
        </section>
      </div>
    </main>
  );
}
