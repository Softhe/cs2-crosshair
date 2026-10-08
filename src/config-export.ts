import { encode } from './codec';
import { commands, safeAlias, type Settings } from './model';

export function downloadConfig(settings: Settings, name: string): string {
  const alias = safeAlias(name), shortcut = alias || 'my_crosshair';
  const filename = alias ? `crosshair_${alias}.cfg` : 'crosshair.cfg';
  return [
    '// delli.cc Crosshair Studio',
    `// Crosshair code: ${encode(settings)}`,
    '// Paste the code into CS2 Settings > Crosshair / Scopes > Share or Import.',
    `// alias ${shortcut} "exec ${filename}"`,
    `// Add the alias line to autoexec.cfg without //, then type ${shortcut} in the console to load this file.`,
    '',
    commands(settings).split('; ').join('\n'),
    '',
  ].join('\n');
}
