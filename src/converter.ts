import { defaults, validateSettings, HEIGHT_MIN, HEIGHT_MAX, type Settings } from './model';
// @ts-expect-error Vendored upstream JavaScript has no TypeScript declarations.
import { parseLegacyTextWithNotes } from './vendor/sicc/settings/import.js';
// @ts-expect-error Vendored upstream JavaScript has no TypeScript declarations.
import { inferCommunity } from './vendor/sicc/solver/community.js';
// @ts-expect-error Vendored upstream JavaScript has no TypeScript declarations.
import { nativeCommands, styleBlocker } from './vendor/sicc/settings/native.js';
// @ts-expect-error Vendored upstream JavaScript has no TypeScript declarations.
import { COMMUNITY_MODEL } from './vendor/sicc/geometry/community.js';

/** Reconstruction label, read from the vendored model so it cannot go stale. */
export const COMMUNITY_MODEL_VERSION: string = typeof COMMUNITY_MODEL?.version === 'string' ? COMMUNITY_MODEL.version : 'community-static-v11';

export type Conversion = { settings: Settings; warnings: string[]; report: Record<string, unknown> };

/** Convert an old version-1 code or old cvars with the pinned community reconstruction. */
export function convertLegacy(text: string, oldHeight=1080, newHeight=oldHeight, base=defaults): Conversion {
  if(text.length>200000) throw Error('Config is too large.');
  for(const height of [oldHeight,newHeight]) {
    if(!Number.isInteger(height)||height<HEIGHT_MIN||height>HEIGHT_MAX) throw Error(`Game height must be an integer between ${HEIGHT_MIN} and ${HEIGHT_MAX}.`);
  }
  const parsed=parseLegacyTextWithNotes(text);
  const blocker=styleBlocker(parsed.config.style);
  if(blocker) throw Error(blocker);
  const report=inferCommunity({settings:parsed.config, options:{oldHeight,currentHeight:newHeight,authoredHeight:newHeight,goal:'pixels'},records:[],measurements:[]});
  if(report.blockers.length) throw Error(report.blockers.join(' '));
  const settings={...base};
  for(const line of nativeCommands(parsed.config,report.chosen.native,report.exportOverrides)) {
    const match=/^(cl_\w+)\s+(-?\d+(?:\.\d+)?)$/.exec(line);
    const key=match?.[1];
    if(key!==undefined && Object.hasOwn(defaults,key)) settings[key]=Number(match?.[2]);
  }
  return {settings:validateSettings(settings),warnings:[...parsed.notes.map((note: {text?:string}|string)=>typeof note==='string'?note:note.text??JSON.stringify(note)),...report.warnings.map((warning:{text:string})=>warning.text)],report};
}
