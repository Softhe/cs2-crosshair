# Third-party notices

The codebase is a fresh implementation. The replacement does not copy application code or assets from earlier commits of this repository.

## Valve map preview assets

`public/maps/*.webp` contains the seven crosshair menu backgrounds extracted from the locally installed Counter-Strike 2 build 1.41.8.8. Counter-Strike and these assets belong to Valve Corporation. Their inclusion does not grant a new license to Valve's assets. This independent project is not affiliated with or endorsed by Valve.

The original textures were decoded using [Source 2 Viewer](https://github.com/ValveResourceFormat/ValveResourceFormat), version 20.0. That development tool is not part of the app. WebP encoding uses sharp, a development dependency.

## Fonts and icons

Inter and JetBrains Mono are distributed by the corresponding Fontsource packages under the SIL Open Font License. Lucide icons use the ISC license. Their package licenses remain available in `node_modules` alongside their sources.

React and React DOM use the MIT license. All dependencies are recorded in `package-lock.json`.
