import { Copy, Download, Link } from 'lucide-react';
import { autoexec, commands, type Settings } from '../model';

export type ExportCardProps = {
  s: Settings;
  alias: string;
  aliasError: string;
  setAlias: (value: string) => void;
  copy: (text: string, label: string) => void;
  shareLink: () => string;
  exportCfg: () => void;
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
      </div>
      <p className="code-hint">
        Links and config files include every setting. The code above carries crosshair and scope dot settings.
      </p>
      <details className="export-advanced">
        <summary>Advanced export</summary>
        <div className="advanced-export-content">
          <label className="field-label" htmlFor="alias">
            ALIAS NAME<span>OPTIONAL</span>
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
