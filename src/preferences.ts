// Account-synced preview preferences. Pure so the server validates with the same rules.

/** How CS2 is configured: the game render resolution and whether it is stretched to the monitor. */
export type GameView = { enabled: boolean; width: number; height: number; stretched: boolean };
export type Preferences = { gameView: GameView };

export const defaultGameView: GameView = { enabled: false, width: 1280, height: 960, stretched: true };
/** Resolutions CS2 lists under each aspect-ratio setting, when the monitor supports them. */
export const gameResolutionGroups: { label: string; sizes: [number, number][] }[] = [
  { label: '4:3', sizes: [[640, 480], [800, 600], [1024, 768], [1152, 864], [1280, 960], [1440, 1080], [1600, 1200], [1920, 1440]] },
  { label: '5:4', sizes: [[1280, 1024]] },
  { label: '16:10', sizes: [[1280, 800], [1440, 900], [1680, 1050], [1920, 1200], [2560, 1600]] },
  { label: '16:9', sizes: [[1280, 720], [1366, 768], [1600, 900], [1920, 1080], [2560, 1440], [3840, 2160]] },
];
export const gameResolutions = gameResolutionGroups.flatMap((group) => group.sizes);

const side = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

export function gameView(value: unknown): GameView {
  const v = value && typeof value === 'object' ? value as Partial<GameView> : {};
  const valid = side(v.width, 320, 15360) && side(v.height, 240, 8640);
  return {
    enabled: v.enabled === true,
    width: valid ? v.width! : defaultGameView.width,
    height: valid ? v.height! : defaultGameView.height,
    stretched: typeof v.stretched === 'boolean' ? v.stretched : defaultGameView.stretched,
  };
}

/** Rejects anything other than a well-formed preferences object instead of repairing it. */
export function validatePreferences(value: unknown): Preferences {
  const v = value as Preferences;
  if (!v || typeof v !== 'object' || !v.gameView || typeof v.gameView !== 'object') throw Error('Invalid preferences.');
  const view = gameView(v.gameView);
  if (JSON.stringify(view) !== JSON.stringify({ enabled: v.gameView.enabled, width: v.gameView.width, height: v.gameView.height, stretched: v.gameView.stretched }))
    throw Error('Invalid preferences.');
  return { gameView: view };
}

/**
 * Monitor pixels per game pixel on each axis. Stretched output fills the monitor, so a 4:3 game on a
 * 16:9 monitor gets wider pixels than tall ones. Otherwise the game keeps its aspect ratio with black bars.
 */
export function gameViewStretch(view: GameView, monitor: { width: number; height: number }): [number, number] {
  const x = monitor.width / view.width, y = monitor.height / view.height;
  if (!(x > 0 && y > 0 && Number.isFinite(x) && Number.isFinite(y))) return [1, 1];
  return view.stretched ? [x, y] : [Math.min(x, y), Math.min(x, y)];
}
