import { useRef, useState } from 'react';
import { decode, describeConfigImport, importConfig } from './codec';
import { convertLegacy } from './converter';
import { detectImport, type AliasCrosshair } from './import-detect';
import { BACKUP_MAX_BYTES } from './library-backup';
import { codeSettingKeys, validateSettings, type Settings } from './model';
import { message } from './startup';
import type { Notify } from './useToast';

/** Largest config the importer reads (codec importConfig); library backups may be larger. */
const CONFIG_MAX_BYTES = 200000;
const kilobytes = (bytes: number) => Math.round(bytes / 1000);

/**
 * The import box: an unapplied draft (null while it shows the applied code), its error, and applying
 * a share code, link, current config or pre-2023 config to the editor. A library backup is handed to `onBackup`.
 */
export function useImport({ s, code, apply, onBackup, setModal, notify }: {
  s: Settings;
  code: string;
  /** Load imported settings into the editor and record them. */
  /** `review` is true when the panel shows conversion notes or alias choices to read next. */
  apply: (settings: Settings, review: boolean) => void;
  /** Merge a library backup that was pasted or chosen instead of a config. */
  onBackup: (text: string) => void;
  setModal: (value: null) => void;
  notify: Notify;
}) {
  const [importDraft, setDraft] = useState<string | null>(null);
  const [importError, setImportError] = useState('');
  const [legacyHeight, setLegacyHeight] = useState(1080);
  /** Notes from the last old-settings conversion, shown under the import box until the next import or dismissal. */
  const [conversionNotes, setConversionNotes] = useState<string[] | null>(null);
  // Bumped whenever the box changes, so a slow clipboard read cannot overwrite a newer edit.
  const clipboardRequest = useRef(0);
  const importText = importDraft ?? code;
  /** Crosshairs a config keeps inside aliases; the importer never applies alias bodies on its own. */
  const [aliasChoices, setAliasChoices] = useState<AliasCrosshair[]>([]);

  function setImportText(value: string | null) {
    setDraft(value);
    setAliasChoices([]);
  }

  function doImport(text = importText, options: { alias?: string } = {}) {
    try {
      const detected = detectImport(text);
      const aliases = 'aliases' in detected ? detected.aliases ?? [] : [];
      if (!options.alias) setAliasChoices(aliases);
      const names = aliases.map((alias) => alias.name).join(', ');
      const others = !options.alias && aliases.length
        ? ` This config also keeps crosshairs in ${aliases.length === 1 ? 'the alias' : 'the aliases'} ${names}; choose one under the box to load it instead.`
        : '';
      const from = options.alias ? ` from alias ${options.alias}` : '';
      let result: Settings;
      let notes: string[] | null = null;
      if (detected.kind === 'backup') {
        onBackup(detected.text);
        setDraft(null);
        setImportError('');
        return;
      }
      if (detected.kind === 'aliases') {
        throw Error(`This config keeps ${aliases.length === 1 ? 'a crosshair inside the alias' : `${aliases.length} crosshairs inside the aliases`} ${names}. Choose one below to load it.`);
      }
      if (detected.kind === 'json') {
        try {
          result = validateSettings({ ...s, ...detected.value });
        } catch (error) {
          throw Error(`Settings JSON could not be imported. ${message(error)}`);
        }
        notify(`Settings JSON imported (${Object.keys(detected.value).length} settings).`, 'success');
      } else if (detected.kind === 'code' || detected.kind === 'link') {
        const complete = detected.kind === 'link' && new URL(detected.text).searchParams.has('settings');
        const parsed = decode(detected.text, legacyHeight);
        if (parsed.warnings?.length) notes = parsed.warnings;
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
        const converted = convertLegacy(detected.text, legacyHeight, legacyHeight, s);
        result = converted.settings;
        notes = converted.warnings;
        notify(
          `Old settings${from} converted, assuming they were made for ${legacyHeight}p${notes.length ? `, with ${notes.length} note${notes.length === 1 ? '' : 's'} below the import box` : ''}. Check the result in CS2. To change the height, open Import options → Convert old settings.${others}`,
          'warning',
        );
      } else if (detected.kind === 'config') {
        const imported = importConfig(detected.text, s);
        result = imported.settings;
        const summary = describeConfigImport(imported);
        notify(`${options.alias ? summary.text.replace(' from the config.', `${from}.`) : summary.text}${others}`, summary.tone);
      } else {
        throw Error(detected.reason ?? 'No crosshair code, share link, crosshair settings or settings JSON found. Paste a CS code, a link, or cl_crosshair lines from a config.');
      }
      // An alias chosen from the list keeps the other choices on show, so the panel still has something to read.
      apply(result, Boolean(notes?.length) || aliases.length > 0 || (options.alias !== undefined && aliasChoices.length > 0));
      setConversionNotes(notes?.length ? notes : null);
      setDraft(null);
      setImportError('');
      setModal(null);
    } catch (error) {
      setImportError(message(error));
    }
  }

  /** Load one crosshair a config keeps in an alias; the other choices stay offered. */
  function chooseAlias(alias: AliasCrosshair) {
    clipboardRequest.current++;
    doImport(alias.body, { alias: alias.name });
  }

  function pasteCode(text: string) {
    clipboardRequest.current++;
    setImportText(text);
    setImportError('');
    doImport(text);
  }

  async function importFile(file: File) {
    const tooLarge = (kind: string, limit: number) =>
      `${file.name} is too large (${kilobytes(file.size)} KB). ${kind} can be up to ${kilobytes(limit)} KB.`;
    if (file.size > BACKUP_MAX_BYTES) {
      setImportError(tooLarge('Library backups', BACKUP_MAX_BYTES));
      return;
    }
    try {
      const text = await file.text();
      if (file.size > CONFIG_MAX_BYTES && detectImport(text).kind !== 'backup') {
        setImportError(tooLarge('Crosshair configs', CONFIG_MAX_BYTES));
        return;
      }
      pasteCode(text);
    } catch (error) {
      setImportError(message(error));
    }
  }

  return {
    importText, importDraft, setImportText, importError, setImportError, legacyHeight, setLegacyHeight,
    conversionNotes, setConversionNotes,
    clipboardRequest, doImport, pasteCode, importFile, aliasChoices, chooseAlias,
  };
}
