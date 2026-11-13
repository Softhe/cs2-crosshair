import { decode, encode } from './codec';
import { studioStart, validateSettings, type Settings } from './model';
import { read } from './storage';

export function message(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

/** The crosshair the studio opens with: a shared link, else the saved draft, else the studio start. */
export function initial(): { settings: Settings; error?: string; note?: string } {
  try {
    const params = new URLSearchParams(location.search);
    const code =
      params.get('code') ??
      params.get('crosshair') ??
      (location.pathname.startsWith('/CS') ? location.pathname.slice(1) : null);
    if (code) {
      const result = decode(code);
      const complete = params.get('settings');
      if (complete) {
        const full = validateSettings(JSON.parse(complete));
        if (encode(full) !== encode(result.settings))
          throw Error('The link contains conflicting crosshair settings.');
        return { settings: full, note: result.note };
      }
      return { settings: result.settings, note: result.note };
    }
    const full = params.get('settings');
    if (full) return { settings: validateSettings(JSON.parse(full)) };
    let draft: Settings;
    try {
      draft = validateSettings(read('draft', studioStart));
    } catch {
      // A stale or corrupt local draft is not the user's link error: start from defaults quietly.
      draft = studioStart;
    }
    return { settings: { ...draft, cl_crosshair_friendly_warning: 0 } };
  } catch (error) {
    return { settings: { ...studioStart }, error: message(error) };
  }
}

export function download(text: string, name: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
