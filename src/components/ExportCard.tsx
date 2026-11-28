import { Copy, Download, Link, Star } from 'lucide-react';
import { autoexec, commands, type Settings } from '../model';

export type ExportCardProps = {
  s: Settings;
  alias: string;
  aliasError: string;
  setAlias: (value: string) => void;
  copy: (text: string, label: string) => void;
  shareLink: () => string;
  exportCfg: () => void;
  /** Open the save form under the settings. */
  onSave: () => void;
};

export function ExportCard(p: ExportCardProps) {
  return (
    <>
      <div className="split-actions">
        <button
          onClick={() => {
            void p.copy(p.shareLink(), 'Share link');
          }}
        >
          <Link size={15} />
          Copy link
        </button>
        <button onClick={p.exportCfg}>
          <Download size={15} />
          Download .cfg
        </button>
        <button onClick={p.onSave}>
          <Star size={15} />
          Save to library
        </button>
        <span className="format-note">
          Code: crosshair and scope dot. Link and .cfg: all {Object.keys(p.s).length} settings.
        </span>
      </div>
      <details className="export-advanced">
        <summary>Advanced export</summary>
        <div className="advanced-export-content">
          <p className="code-hint">
            The share code is what CS2 imports, and it carries only crosshair and scope dot settings. Links and config
            files also keep the other menu settings, such as sniper and friendly-crosshair options.
          </p>
          <label className="field-label" htmlFor="alias">
            Alias name<span>Optional</span>
          </label>
          <input
            id="alias"
            className="text-input"
            placeholder="e.g. my_crosshair"
            value={p.alias}
            maxLength={48}
            onChange={(e) => p.setAlias(e.target.value)}
            aria-invalid={!!p.aliasError}
            aria-describedby="alias-hint"
          />
          <p id="alias-hint" className={p.aliasError ? 'error-text' : 'code-hint'}>
            {p.aliasError || 'Switch crosshairs by typing this name in the console.'}
          </p>
          <button
            className="full quiet-button"
            disabled={!!p.aliasError}
            onClick={() => void p.copy(autoexec(p.s, p.alias), 'Autoexec shortcut')}
          >
            <Copy size={14} />
            Copy autoexec shortcut
          </button>
          <div className="card-separator" />
          <details className="console-details">
            <summary>
              Console commands <span>{Object.keys(p.s).length} settings</span>
            </summary>
            <textarea readOnly value={commands(p.s).split('; ').join('\n')} aria-label="Generated console commands" />
          </details>
          <button
            className="full quiet-button"
            onClick={() => {
              void p.copy(commands(p.s), 'Console commands');
            }}
          >
            <Copy size={14} />
            Copy console commands<kbd>Ctrl ↵</kbd>
          </button>
        </div>
      </details>
    </>
  );
}
