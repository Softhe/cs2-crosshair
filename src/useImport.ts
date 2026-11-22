import { useRef, useState } from 'react';
import { decode, describeConfigImport, importConfig } from './codec';
import { convertLegacy } from './converter';
import { detectImport } from './import-detect';
import { BACKUP_MAX_BYTES } from './library-backup';
import { codeSettingKeys, type Settings } from './model';
import { message } from './startup';
import type { Notify } from './useToast';

/** Largest config the importer reads (codec importConfig); library backups may be larger. */
const CONFIG_MAX_BYTES = 200000;

/**
 * The import box: an unapplied draft (null while it shows the applied code), its error, and applying
 * a share code, link, current config or pre-2023 config to the editor. A library backup is handed to `onBackup`.
 */
export function useImport({ s, code, apply, onBackup, setModal, notify }: {
  s: Settings;
  code: string;
  /** Load imported settings into the editor and record them. */
  apply: (settings: Settings) => void;
  /** Merge a library backup that was pasted or chosen instead of a config. */
  onBackup: (text: string) => void;
  setModal: (value: null) => void;
  notify: Notify;
}) {
  const [importDraft, setImportText] = useState<string | null>(null);
  const [importError, setImportError] = useState('');
  const [legacyHeight, setLegacyHeight] = useState(1080);
  // Bumped whenever the box changes, so a slow clipboard read cannot overwrite a newer edit.
  const clipboardRequest = useRef(0);
  const importText = importDraft ?? code;

  function doImport(text = importText) {
    try {
      const detected = detectImport(text);
      let result: Settings;
      if (detected.kind === 'backup') {
        onBackup(detected.text);
        setImportText(null);
        setImportError('');
        return;
      }
      if (detected.kind === 'code' || detected.kind === 'link') {
        const complete = detected.kind === 'link' && new URL(detected.text).searchParams.has('settings');
        const parsed = decode(detected.text, legacyHeight);
        notify(
          parsed.note ??
            (complete
              ? 'Crosshair and complete settings imported from link.'
              : 'Crosshair imported. Extra menu settings keep their current values.'),
          parsed.note ? 'warning' : 'success',
        );
        // A bare code carries only crosshair settings; the rest of the menu keeps its values.
        result = complete
          ? parsed.settings
          : { ...s, ...Object.fromEntries(codeSettingKeys.map((k) => [k, parsed.settings[k]!])) };
      } else if (detected.kind === 'legacy') {
        result = convertLegacy(detected.text, legacyHeight, legacyHeight, s).settings;
        notify('Old settings converted. Check the result in CS2. Use the converter panel to review warnings.', 'warning');
      } else if (detected.kind === 'config') {
        const imported = importConfig(detected.text, s);
        result = imported.settings;
        const summary = describeConfigImport(imported);
        notify(summary.text, summary.tone);
      } else {
        throw Error('No crosshair code, share link or crosshair settings found. Paste a CS code, a link, or cl_crosshair lines from a config.');
      }
      apply(result);
      setImportText(null);
      setImportError('');
      setModal(null);
    } catch (error) {
      setImportError(message(error));
    }
  }

  function pasteCode(text: string) {
    clipboardRequest.current++;
    setImportText(text);
    setImportError('');
    doImport(text);
  }

  async function importFile(file: File) {
    if (file.size > BACKUP_MAX_BYTES) {
      setImportError('This file is too large to be a config or library backup.');
      return;
    }
    try {
      const text = await file.text();
      if (file.size > CONFIG_MAX_BYTES && detectImport(text).kind !== 'backup') {
        setImportError('Config is too large.');
        return;
      }
      pasteCode(text);
    } catch (error) {
      setImportError(message(error));
    }
  }

  return {
    importText, importDraft, setImportText, importError, setImportError, legacyHeight, setLegacyHeight,
    clipboardRequest, doImport, pasteCode, importFile,
  };
}
