import type { RefObject } from 'react';
import { ArrowUpRight, Bookmark, Copy, Star, Upload } from 'lucide-react';
import { LegacyConverter } from '../LegacyConverter';
import type { Settings } from '../model';
import type { Saved } from '../storage';
import type { useLibrarySync } from '../library-sync';

type Sync = ReturnType<typeof useLibrarySync>;

export type ImportBarProps = {
  code: string;
  importText: string;
  importDraft: string | null;
  importError: string;
  legacyHeight: number;
  s: Settings;
  clipboardRequest: RefObject<number>;
  cfgInput: RefObject<HTMLInputElement | null>;
  currentFavorite: Saved | undefined;
  editingFavorite: Saved | undefined;
  savedName: string;
  sync: Sync;
  setImportText: (value: string | null) => void;
  setImportError: (value: string) => void;
  setLegacyHeight: (value: number) => void;
  setModal: (value: null) => void;
  setSavedName: (value: string) => void;
  pasteCode: (text: string) => void;
  doImport: (text?: string) => void;
  load: (settings: Settings) => void;
  remember: (settings?: Settings) => void;
  notify: (text: string) => void;
  copy: (text: string, label: string) => void;
  saveFavorite: () => void;
  updateFavorite: () => void;
  setToast: (value: string) => void;
};

export function ImportBar(p: ImportBarProps) {
  return (
    <>
      <section className="inline-import" aria-label="Import crosshair">
        <label className="field-label" htmlFor="import-text">
          Crosshair code or config
        </label>
        <div className="inline-import-entry">
          <textarea
            rows={1}
            id="import-text"
            className="import-area"
            data-current-code={p.code}
            value={p.importText}
            onChange={(e) => {
              p.clipboardRequest.current++;
              p.setImportText(e.target.value);
              p.setImportError('');
            }}
            onPaste={(e) => {
              e.preventDefault();
              p.pasteCode(e.clipboardData.getData('text'));
            }}
            placeholder="Paste a CS2 crosshair code"
          />
          <button className="primary-button" aria-label="Import crosshair" onClick={() => p.doImport()}>
            Import<span className="import-button-extra"> crosshair</span>
            <ArrowUpRight size={15} />
          </button>
          <button
            className="icon-button"
            aria-label="Copy crosshair code"
            title="Copy the current applied crosshair code"
            onClick={() => {
              void p.copy(p.code, 'Share code');
            }}
          >
            <Copy size={16} />
          </button>
        </div>
        <div className="import-tools">
          <button
            onClick={async () => {
              const request = ++p.clipboardRequest.current;
              p.setToast('');
              try {
                const text = await navigator.clipboard.readText();
                if (request === p.clipboardRequest.current) p.pasteCode(text);
              } catch {
                if (request === p.clipboardRequest.current)
                  p.setImportError('Clipboard access is unavailable. Paste into the box manually.');
              }
            }}
          >
            <Copy size={14} />
            Paste clipboard
          </button>
          <button
            onClick={() => {
              p.setImportText(null);
              p.setImportError('');
            }}
            disabled={p.importDraft === null}
          >
            Use current code
          </button>
          <span className="code-state">
            {p.importDraft === null ? 'Updates live as you edit settings.' : 'Import to apply this code.'}
          </span>
        </div>
        <details className="config-import">
          <summary>Import a .cfg file</summary>
          <button onClick={() => p.cfgInput.current?.click()}>
            <Upload size={14} />
            Choose .cfg file
          </button>
        </details>
        <LegacyConverter
          text={p.importText}
          oldHeight={p.legacyHeight}
          onOldHeightChange={p.setLegacyHeight}
          base={p.s}
          onApply={(settings) => {
            p.load(settings);
            p.remember(settings);
            p.setImportText(null);
            p.setImportError('');
            p.setModal(null);
            p.notify('Converted crosshair loaded. Check the result in CS2.');
          }}
        />
        {p.importError && (
          <p className="error-text" role="alert">
            {p.importError}
          </p>
        )}
      </section>
      <div className="library-save-bar">
        <div className="library-save-heading">
          <Bookmark size={18} />
          <div>
            <h2>Keep this crosshair</h2>
            <p aria-live="polite">
              {p.currentFavorite
                ? 'Saved as ' + p.currentFavorite.name
                : p.editingFavorite
                  ? 'Editing ' + p.editingFavorite.name + '. Your saved copy stays unchanged.'
                  : 'Save a name or player nickname. Your saved copy stays unchanged while you edit.'}
              {p.sync.user &&
                (p.sync.status === 'synced'
                  ? ' · Synced'
                  : p.sync.status === 'loading'
                    ? ' · Loading library…'
                    : p.sync.error?.startsWith('Changes could not be saved')
                      ? ' · Local save failed'
                      : ' · Saved on this device · waiting to sync')}
            </p>
          </div>
        </div>
        <div className="library-save-controls">
          <div className="library-name-field">
            <label htmlFor="saved-name">Crosshair name</label>
            <input
              id="saved-name"
              className="text-input"
              value={p.savedName}
              maxLength={80}
              onChange={(e) => p.setSavedName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (p.editingFavorite) p.updateFavorite();
                  else p.saveFavorite();
                }
              }}
            />
          </div>
          {p.editingFavorite ? (
            <>
              <button className="primary-button" onClick={p.updateFavorite}>
                Update saved crosshair
              </button>
              <button className="quiet-button" onClick={p.saveFavorite}>
                Save as new
              </button>
            </>
          ) : (
            <button className="primary-button" onClick={p.saveFavorite}>
              <Star size={16} />
              Save to favorites
            </button>
          )}
        </div>
      </div>
    </>
  );
}
