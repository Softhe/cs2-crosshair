// @ts-expect-error Vendored upstream JavaScript has no TypeScript declarations.
import { cfgStatements } from './vendor/sicc/settings/statements.js';

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

export type Detected =
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string }
  | { kind: 'config'; text: string }
  | { kind: 'legacy'; text: string }
  | { kind: 'backup'; text: string }
  | { kind: 'unknown'; text: string };

const CS_CODE = /(?<![A-Za-z0-9])CS[A-Za-z0-9]{44}(?![A-Za-z0-9-])/g;
const CSGO_CODE = /(?<![A-Za-z0-9])CSGO(?:-[A-Za-z0-9]{5}){5}(?![A-Za-z0-9-])/g;
/** A web address carrying a crosshair: a code or settings parameter, or a code as the path. */
const LINK = /(?:https?:\/\/[^\s/"'<>`]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?)\/[^\s"'<>`]*/gi;
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
  const text = input.trim();
  if (isBackup(text)) return { kind: 'backup', text };

  const names = statements(text).map(assignedName).filter((name): name is string => name !== undefined);
  if (names.some((name) => CURRENT_ONLY_CVARS.has(name))) return { kind: 'config', text };
  if (names.some((name) => LEGACY_ONLY_CVARS.has(name))) return { kind: 'legacy', text };
  if (names.length) return { kind: 'config', text };

  const links = [...new Set((text.match(LINK) ?? []).filter(carriesCrosshair))];
  if (links.length === 1) {
    const link = links[0]!.replace(/[.,;:!?)\]]+$/, '');
    return { kind: 'link', text: /^https?:\/\//i.test(link) ? link : `https://${link}` };
  }
  if (links.length > 1) throw Error(`This text contains ${links.length} different crosshair links. Paste one at a time.`);

  const compact = text.replace(/\s+/g, '');
  const codes = [...new Set([...(text.match(CS_CODE) ?? []), ...(text.match(CSGO_CODE) ?? [])])];
  if (codes.length === 1) return { kind: 'code', text: codes[0]! };
  if (codes.length > 1) throw Error(`This text contains ${codes.length} different crosshair codes. Paste one at a time.`);
  if (/^CS[A-Za-z0-9]{44}$|^CSGO(?:-[A-Za-z0-9]{5}){5}$/.test(compact)) return { kind: 'code', text: compact };
  // Keep the decoder's specific message (checksum, version) for something that is clearly meant as a code.
  if (/^CS/.test(text)) return { kind: 'code', text };
  return { kind: 'unknown', text };
}
