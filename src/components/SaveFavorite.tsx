import { Bookmark, Star } from 'lucide-react';
import type { useFavorites } from '../useFavorites';

export function SaveFavorite({ f }: { f: ReturnType<typeof useFavorites> }) {
  const { currentFavorite, editingFavorite, saveSyncLabel, savedName, setSavedName, saveFavorite, updateFavorite } = f;
  return (
    <aside className="sidebar">
      <details className="save-disclosure">
        <summary>
          <Bookmark size={16} />
          Save favorite
          <span className="saved-state">
            {currentFavorite
              ? 'Saved as ' + currentFavorite.name + ' · ' + saveSyncLabel
              : editingFavorite
                ? 'Editing ' + editingFavorite.name
                : 'Keep a separate copy'}
          </span>
        </summary>
        <div className="library-save-bar">
          <div className="library-save-heading">
            <Bookmark size={18} />
            <div>
              <h2>Keep this crosshair</h2>
              <p aria-live="polite">
                {currentFavorite
                  ? 'Saved as ' + currentFavorite.name
                  : editingFavorite
                    ? 'Editing ' + editingFavorite.name + '. Your saved copy stays unchanged.'
                    : 'Save a name or player nickname. Your saved copy stays unchanged while you edit.'}
                {currentFavorite && <span aria-label="Save sync status"> · {saveSyncLabel}</span>}
              </p>
            </div>
          </div>
          <div className="library-save-controls">
            <div className="library-name-field">
              <label htmlFor="saved-name">Crosshair name</label>
              <input
                id="saved-name"
                className="text-input"
                value={savedName}
                maxLength={80}
                onChange={(e) => setSavedName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (editingFavorite) updateFavorite();
                    else saveFavorite();
                  }
                }}
              />
            </div>
            {editingFavorite ? (
              <>
                <button className="primary-button" onClick={updateFavorite}>
                  Update saved crosshair
                </button>
                <button className="quiet-button" onClick={saveFavorite}>
                  Save as new
                </button>
              </>
            ) : (
              <button className="primary-button" onClick={saveFavorite}>
                <Star size={16} />
                Save to favorites
              </button>
            )}
          </div>
        </div>
      </details>
    </aside>
  );
}
