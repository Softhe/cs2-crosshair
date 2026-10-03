import {copyFile} from 'node:fs/promises';

// GitHub Pages serves this document for legacy crosshair paths.
await copyFile('dist/index.html','dist/404.html');
