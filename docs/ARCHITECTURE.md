# Architecture

The site is a static React and TypeScript application built with Vite. It runs in the browser and has no server API.

| File | Responsibility |
| --- | --- |
| `src/main.tsx` | Editor controls, imports, exports, navigation, dialogs, and library actions |
| `src/model.ts` | Settings, validation, style visibility, presets, config commands, and aliases |
| `src/codec.ts` | Current and legacy share-code decoding, encoding, and config parsing |
| `src/Preview.tsx` | Canvas rendering, zoom, scope dots, and resize handling |
| `src/preview-motion.ts` | Synthetic dynamic spread |
| `src/storage.ts` | Local preferences and validated library backups |
| `src/clipboard.ts` | Clipboard writes, readback when already permitted, and copy fallback |
| `src/style.css` | Editor layout, themes, and responsive styles |

Settings use convar names as keys. The model validates imported values before the editor loads them. The current share-code protocol carries 24 fields. Configs and full website links preserve 42 settings, including compatibility fields for grenade and sniper preferences. Those preferences have no editor sections.

Current codes are checksummed 32-byte payloads encoded with a `CS` prefix. Unknown versions and reserved bits are rejected. See [the protocol](PROTOCOL.md) for the byte layout and game probes.

The canvas draws around one center point and scales the geometry for preview zoom. Odd thicknesses use the exact half-thickness so dots and outer shapes remain concentric. Dynamic motion is synthetic and does not affect exported settings.

Browser storage uses keys beginning with `delli.v3.`. Backups are validated JSON. The app does not evaluate imports, feedback, names, or aliases as scripts. Aliases and filenames have restricted character sets.

The build copies `index.html` to `404.html` so GitHub Pages can load legacy paths. Such requests initially have HTTP status 404, even when the client renders a valid crosshair. New links use query parameters at `/` to avoid this limitation.
