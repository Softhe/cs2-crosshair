# Testing

Install dependencies with `npm ci`, then run:

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

Playwright starts the production preview on localhost. To use another port, set `PLAYWRIGHT_PORT`, for example `4181` when the editor development server occupies `4180`. CI starts a fresh server and does not reuse a running instance.

## Automated coverage

Unit tests exercise exact game fixtures, every representable share-code field value, 3,000 deterministic setting combinations, 9,000 config imports with different separators, malformed payloads, validation, aliases, library backups, and dynamic spread.

Browser tests run at desktop and mobile viewport sizes. They cover all ten styles, visible fields, RGBA colors, negative gap input and slider synchronization, clipboard operations and fallback, named config downloads and file re-imports, full links, presets, undo, reset, themes, observer controls, map switching, zoom, and library actions.

Canvas tests compare dot and outer-shape centers at 1×, 2×, 4×, and 8× with thicknesses 1 and 3. They protect the odd-thickness centering fix. UI tests assert that Grenade Line-up, Sniper Sights, and the sniper preview option are absent.

## Live game checks

On October 3, 2026, Computer Use imported a website-generated code for each of the ten styles into CS2, then copied it back through the game's menu. All ten strings matched exactly. Probes included thickness 3, half outline, scope scale 1.37, and negative gap -4. The original game crosshair was restored and verified afterward.

These checks establish menu import/export compatibility. Downloaded configs were compared with all 42 generated commands and imported back into the website; they were not executed in CS2. The tests do not establish identical gameplay rendering or physical mobile-device behavior. Chromium is the automated browser target.

Game screenshots and local test artifacts are retained in the development workspace. They are excluded from this public replacement to avoid publishing unrelated game account details.
