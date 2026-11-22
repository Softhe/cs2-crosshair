// @ts-expect-error Vendored upstream JavaScript has no TypeScript declarations.
import { cfgStatements } from './vendor/sicc/settings/statements.js';
import { defaults } from './model';

/**
 * Names only the current game has (vendor settings/cvars.js: NEW_CVARS, NEW_CVARS_2000922, OUTLINE_COLOR_CVARS,
 * plus fill opacity and spread limit). One of these anywhere in a paste means it is current-game settings.
 */
export const CURRENT_ONLY_CVARS: ReadonlySet<string> = new Set([
  'cl_crosshair_length', 'cl_crosshair_thickness', 'cl_crosshair_gap', 'cl_crosshair_screen_height',
  'cl_crosshairoutline_r', 'cl_crosshairoutline_g', 'cl_crosshairoutline_b', 'cl_crosshairoutline_a',
  'cl_crosshaircolor_a', 'cl_crosshair_dynamic_spread_limit',
]);
/**
 * Names only the old game used (vendor HIDDEN_LEFTOVERS and REMOVED_NAMES). The current game still saves the first
 * three, hidden, so a current config file holds them too; they decide "old settings" only when no current-only
 * name is present.
 */
export const LEGACY_ONLY_CVARS: ReadonlySet<string> = new Set([
  'cl_crosshairsize', 'cl_crosshairthickness', 'cl_crosshairalpha',
  'cl_crosshairgap', 'cl_crosshairusealpha', 'cl_crosshaircolor', 'cl_crosshair_outlinethickness',
  'cl_crosshairgap_useweaponvalue', 'cl_fixedcrosshairgap',
]);

const PROMPT = /^(?:\[console\]|\])\s*/i;
/** Split pasted console text into statements: `;` and `//` count only outside quotes, prompts are removed. */
export function statements(text: string): string[] {
  return (cfgStatements(text) as string[]).map((raw) => raw.trim().replace(PROMPT, '').trim());
}
/** The cvar name a statement assigns (`name value`, `"name" "value"`, `name = value`), lower case. */
export function assignedName(statement: string): string | undefined {
  return /^"?(cl_[a-z0-9_]+)"?(?:\s*=\s*|\s+)\S/i.exec(statement)?.[1]?.toLowerCase();
}

/** A crosshair a config keeps inside an alias. Alias bodies are never applied unless the user picks one. */
export type AliasCrosshair = { name: string; body: string; count: number };

export type Detected =
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string }
  | { kind: 'config'; text: string; aliases?: AliasCrosshair[] }
  | { kind: 'legacy'; text: string; aliases?: AliasCrosshair[] }
  | { kind: 'aliases'; text: string; aliases: AliasCrosshair[] }
  | { kind: 'json'; text: string; value: Record<string, unknown> }
  | { kind: 'backup'; text: string }
  | { kind: 'unknown'; text: string; reason?: string };

/** `alias name "body"` or `alias name body`, as one console statement. */
const ALIAS = /^alias\s+"?([^\s"]+)"?\s+([\s\S]+)$/i;
/** Aliases whose body assigns crosshair settings, in file order; a later definition replaces an earlier one. */
export function aliasCrosshairs(text: string): AliasCrosshair[] {
  const found = new Map<string, AliasCrosshair>();
  for (const statement of statements(text)) {
    const match = ALIAS.exec(statement);
    if (!match) continue;
    const name = match[1]!, raw = match[2]!.trim();
    const body = raw.startsWith('"') ? raw.slice(1, raw.indexOf('"', 1) < 0 ? undefined : raw.indexOf('"', 1)) : raw;
    const count = statements(body).map(assignedName)
      .filter((key) => key !== undefined && (Object.hasOwn(defaults, key) || LEGACY_ONLY_CVARS.has(key))).length;
    found.delete(name);
    if (count) found.set(name, { name, body, count });
  }
  return [...found.values()];
}

// Prefixes are matched in any case and written back in upper case: chat and phones lower-case them.
const CS_CODE = /(?<![A-Za-z0-9])[Cc][Ss][A-Za-z0-9]{44}(?![A-Za-z0-9-])/g;
const CSGO_CODE = /(?<![A-Za-z0-9])[Cc][Ss][Gg][Oo](?:-[A-Za-z0-9]{5}){5}(?![A-Za-z0-9-])/g;
/** An old code whose dashes were lost: CSGO and 25 characters. */
const DASHLESS_CSGO_CODE = /(?<![A-Za-z0-9-])[Cc][Ss][Gg][Oo][A-Za-z0-9]{25}(?![A-Za-z0-9-])/g;
/** A web address carrying a crosshair: a code or settings parameter, or a code as the path. */
// A bare host starts only at the start of a word: tried from every letter, the host part backtracks
// quadratically, and a long run of letters (a large non-config file) would freeze the page.
const LINK = /(?:https?:\/\/[^\s/?"'<>`]+|(?<![a-z0-9.-])(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?)[/?][^\s"'<>`]*/gi;
/** A code a line wrap broke apart: `CS…` fragments joined by line breaks (and the spaces around them). */
const WRAPPED_CODE = /(?<![A-Za-z0-9])CS[A-Za-z0-9-]*(?:[ \t]*\r?\n[ \t]*[A-Za-z0-9-]+)+/g;
const WHOLE_CODE = /^(?:CS[A-Za-z0-9]{44}|CSGO(?:-[A-Za-z0-9]{5}){5})$/;
/** A code with its prefix in upper case and, for an old code, its dashes. */
export function normalizeCode(code: string): string {
  if (/^csgo/i.test(code) && code.length === 29) return 'CSGO' + code.slice(4).replace(/.{5}/g, '-$&');
  return /^csgo-/i.test(code) ? 'CSGO' + code.slice(4) : /^cs/i.test(code) ? 'CS' + code.slice(2) : code;
}
const codesIn = (text: string) => [...(text.match(CS_CODE) ?? []), ...(text.match(CSGO_CODE) ?? []),
  ...(text.match(DASHLESS_CSGO_CODE) ?? [])].map(normalizeCode);
const carriesCrosshair = (link: string) =>
  /[?&](?:code|crosshair|settings)=/i.test(link) || /\/CS(?:GO-|[A-Za-z0-9]{44})/.test(link);

/** Whether the text is a library backup file (`{"version":…,"entries":[…]}`). */
function isBackup(text: string): boolean {
  if (!text.startsWith('{')) return false;
  try {
    const data = JSON.parse(text) as unknown;
    return typeof data === 'object' && data !== null && 'entries' in data && 'version' in data;
  } catch {
    return false;
  }
}

/**
 * Work out what pasted or dropped text is, and pull a code or link out of surrounding text (quotes, a chat message,
 * a link without `https://`, a code broken by a line wrap). Crosshair cvars win over a code in a comment, so a
 * downloaded config imports all its settings.
 */
export function detectImport(input: string): Detected {
  const text = input.replace(/^\uFEFF/, '').trim();
  if (isBackup(text)) return { kind: 'backup', text };
  if (text.startsWith('{')) {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      return { kind: 'unknown', text, reason: 'This looks like JSON, but it is not valid JSON. Check that the whole text was copied.' };
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value))
      return { kind: 'json', text, value: value as Record<string, unknown> };
    return { kind: 'unknown', text, reason: 'This JSON is not a settings object.' };
  }

  const names = statements(text).map(assignedName).filter((name): name is string => name !== undefined);
  const aliases = /\balias\b/i.test(text) ? aliasCrosshairs(text) : [];
  if (names.some((name) => CURRENT_ONLY_CVARS.has(name))) return { kind: 'config', text, aliases };
  if (names.some((name) => LEGACY_ONLY_CVARS.has(name))) return { kind: 'legacy', text, aliases };
  if (names.length) return { kind: 'config', text, aliases };

  const links = [...new Set((text.match(LINK) ?? []).filter(carriesCrosshair))];
  if (links.length > 1) throw Error(`This text contains ${links.length} different crosshair links. Paste one at a time.`);
  if (links.length === 1) {
    const link = links[0]!.replace(/[.,;:!?)\]]+$/, '');
    // A different code beside the link (a chat message offering two crosshairs) is a choice for the user.
    const inLink = new Set(codesIn(link));
    let outside = text;
    for (const found of text.match(LINK) ?? []) outside = outside.replace(found, ' ');
    if (codesIn(outside).some((code) => !inLink.has(code)))
      throw Error('This text contains a crosshair link and a different code. Paste one at a time.');
    return { kind: 'link', text: /^https?:\/\//i.test(link) ? link : `https://${link}` };
  }

  let codes = [...new Set(codesIn(text))];
  if (!codes.length)
    codes = [...new Set((text.match(WRAPPED_CODE) ?? []).map((part) => part.replace(/\s+/g, '')).filter((part) => WHOLE_CODE.test(part)))];
  if (codes.length === 1) return { kind: 'code', text: codes[0]! };
  if (codes.length > 1) throw Error(`This text contains ${codes.length} different crosshair codes. Paste one at a time.`);
  const compact = normalizeCode(text.replace(/\s+/g, ''));
  if (WHOLE_CODE.test(compact)) return { kind: 'code', text: compact };
  if (aliases.length) return { kind: 'aliases', text, aliases };
  // Keep the decoder's specific message (checksum, version, length) for something that is clearly meant as a code.
  if (/^CS/i.test(text)) return { kind: 'code', text: normalizeCode(text) };
  return { kind: 'unknown', text };
}

/** Short name of the detected format, shown next to an unapplied import. */
export function describeDetected(detected: Detected): string {
  switch (detected.kind) {
    case 'code': return detected.text.startsWith('CSGO') ? 'Old CSGO share code' : 'CS2 share code';
    case 'link': return /[?&]settings=/i.test(detected.text) ? 'Link with all settings' : 'Crosshair link';
    case 'json': return `Settings JSON · ${Object.keys(detected.value).length} settings`;
    case 'backup': return 'Library backup';
    case 'legacy': return 'Pre-update config · will be converted';
    case 'aliases': return `Config · ${detected.aliases.length} crosshair ${detected.aliases.length === 1 ? 'alias' : 'aliases'}`;
    case 'config': {
      const count = new Set(statements(detected.text).map(assignedName).filter((name) => name !== undefined && Object.hasOwn(defaults, name))).size;
      return `CS2 config · ${count} ${count === 1 ? 'setting' : 'settings'}`;
    }
    case 'unknown': return 'Not recognized';
  }
}
