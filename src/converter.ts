import { defaults, validateSettings, type Settings } from './model';
// @ts-expect-error Vendored upstream JavaScript has no TypeScript declarations.
import { parseLegacyTextWithNotes } from './vendor/sicc/settings/import.js';
// @ts-expect-error Vendored upstream JavaScript has no TypeScript declarations.
import { inferCommunity } from './vendor/sicc/solver/community.js';
// @ts-expect-error Vendored upstream JavaScript has no TypeScript declarations.
import { nativeCommands, styleBlocker } from './vendor/sicc/settings/native.js';

export type Conversion = { settings: Settings; warnings: string[]; report: Record<string, unknown> };

/** Convert an old version-1 code or old cvars with the pinned community reconstruction. */
export function convertLegacy(text: string, oldHeight=1080, newHeight=oldHeight, base=defaults): Conversion {
  if(text.length>200000) throw Error('Config is too large.');
  for(const height of [oldHeight,newHeight]) {
    if(!Number.isInteger(height)||height<240||height>65535) throw Error('Game height must be an integer between 240 and 65535.');
  }
  const parsed=parseLegacyTextWithNotes(text);
  const blocker=styleBlocker(parsed.config.style);
  if(blocker) throw Error(blocker);
  const report=inferCommunity({settings:parsed.config, options:{oldHeight,currentHeight:newHeight,authoredHeight:newHeight,goal:'pixels'},records:[],measurements:[]});
  if(report.blockers.length) throw Error(report.blockers.join(' '));
  const settings={...base};
  for(const line of nativeCommands(parsed.config,report.chosen.native,report.exportOverrides)) {
    const match=/^(cl_\w+)\s+(-?\d+(?:\.\d+)?)$/.exec(line);
    if(match && match[1] in defaults) settings[match[1]]=Number(match[2]);
  }
  return {settings:validateSettings(settings),warnings:[...parsed.notes.map((note: {text?:string}|string)=>typeof note==='string'?note:note.text??JSON.stringify(note)),...report.warnings.map((warning:{text:string})=>warning.text)],report};
}
