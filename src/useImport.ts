import { useRef, useState } from 'react';
import { decode, describeAdjustments, importConfig } from './codec';
import { convertLegacy } from './converter';
import { codeSettingKeys, type Settings } from './model';
import { message } from './startup';
import type { Notify } from './useToast';

const isLink = (text: string) => /^https?:\/\//i.test(text.trim());
const isCompleteLink = (text: string) => isLink(text) && new URL(text.trim()).searchParams.has('settings');

/**
 * The import box: an unapplied draft (null while it shows the applied code), its error, and applying
 * a share code, link, current config or pre-2023 config to the editor.
 */
export function useImport({ s, code, apply, setModal, notify }: {
  s: Settings;
  code: string;
  /** Load imported settings into the editor and record them. */
  apply: (settings: Settings) => void;
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
      let result: Settings;
      if (text.trim().startsWith('CS') || isLink(text)) {
        const parsed = decode(text, legacyHeight);
        notify(
          parsed.note ??
            (isCompleteLink(text)
              ? 'Crosshair and complete settings imported from link.'
              : 'Crosshair imported. Extra menu settings keep their current values.'),
          parsed.note ? 'warning' : 'success',
        );
        // A bare code carries only crosshair settings; the rest of the menu keeps its values.
        result = isCompleteLink(text)
          ? parsed.settings
          : { ...s, ...Object.fromEntries(codeSettingKeys.map((k) => [k, parsed.settings[k]!])) };
      } else if (/\bcl_crosshair(?:size|thickness|gap|alpha|usealpha|color)\b/i.test(text)) {
        result = convertLegacy(text, legacyHeight, legacyHeight, s).settings;
        notify('Old settings converted. Check the result in CS2. Use the converter panel to review warnings.', 'warning');
      } else {
        const imported = importConfig(text, s);
        result = imported.settings;
        if (imported.adjusted.length) notify(describeAdjustments(imported.adjusted), 'warning');
        else notify('Current CS2 config settings imported.', 'success');
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
    if (file.size > 200000) {
      setImportError('Config is too large.');
      return;
    }
    try {
      pasteCode(await file.text());
    } catch (error) {
      setImportError(message(error));
    }
  }

  return {
    importText, importDraft, setImportText, importError, setImportError, legacyHeight, setLegacyHeight,
    clipboardRequest, doImport, pasteCode, importFile,
  };
}
