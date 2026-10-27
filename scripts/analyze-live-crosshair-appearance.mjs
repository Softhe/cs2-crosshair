import sharp from 'sharp';
import {fileURLToPath} from 'node:url';

// The CS2 NVIDIA profile had Image Sharpening enabled. Disabling it removed the
// mismatch. Historic fitted coefficients below are rejected diagnostics only.
const directory = new URL('../docs/evidence/crosshair-calibration/', import.meta.url);
const load = async file => {
  const {data, info} = await sharp(fileURLToPath(new URL(file, directory))).removeAlpha().raw().toBuffer({resolveWithObject: true});
  return (x, y) => Array.from(data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3));
};
const background = await load('live-background.png');
const foreground = new Set(['47,44', '47,45', '44,47', '45,47', '47,47', '49,47', '50,47', '47,49', '47,50']);
const occupied = (x, y) => foreground.has(`${x},${y}`);
if (process.argv.includes('--assert-native')) {
  const nativeBackground = await load('driver-off-background.png');
  let failed = false;
  for (const [file, color] of [
    ['driver-off-green.png', [0, 255, 168]],
    ['driver-off-muted.png', [40, 80, 120]],
  ]) {
    const image = await load(file);
    let maximumError = 0, squaredError = 0, differingChannels = 0;
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
      const predicted = occupied(x, y) ? color : nativeBackground(x, y), actual = image(x, y);
      for (let channel = 0; channel < 3; channel++) {
        const difference = Math.abs(actual[channel] - predicted[channel]);
        maximumError = Math.max(maximumError, difference);
        squaredError += difference ** 2;
        if (difference) differingChannels++;
      }
    }
    console.log(JSON.stringify({file, maximumError, differingChannels, rgbRmse: Math.sqrt(squaredError / (96 * 96 * 3)), passed: maximumError <= 1}));
    if (maximumError > 1) failed = true;
  }
  process.exit(failed ? 1 : 0);
}
const weights = [0.2126, 0.7152, 0.0722];
const luma = rgb => rgb.reduce((sum, value, channel) => sum + value * weights[channel], 0);
const fixtures = [
  ['live-green.png', [0, 255, 168]],
  ['live-muted.png', [40, 80, 120]],
  ['live-black.png', [0, 0, 0]],
];
const sets = [];
for (const [file, color] of fixtures) {
  const image = await load(file), rows = [];
  for (let y = 40; y <= 54; y++) for (let x = 40; x <= 54; x++) {
    const bg = background(x, y), actual = image(x, y), raw = occupied(x, y) ? color : bg;
    const features = [0, 0, 0];
    let affected = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!occupied(x + dx, y + dy)) continue;
      affected = true;
      features[!dx && !dy ? 0 : dx && dy ? 2 : 1] += luma(color) - luma(background(x + dx, y + dy));
    }
    // Exclude clipped channels when estimating the signed grayscale correction.
    const residuals = actual.map((value, channel) => ({value, delta: value - raw[channel]}))
      .filter(({value}) => value > 0 && value < 255).map(({delta}) => delta);
    rows.push({actual, raw, features, affected, residual: residuals.length ? residuals.reduce((sum, value) => sum + value, 0) / residuals.length : null});
  }
  sets.push({file, rows});
}
const training = sets.slice(0, 2).flatMap(set => set.rows).filter(row => row.affected && row.residual !== null);
const matrix = Array.from({length: 3}, (_, i) => Array.from({length: 4}, (_, j) => training.reduce((sum, row) =>
  sum + row.features[i] * (j === 3 ? row.residual : row.features[j]), 0)));
for (let i = 0; i < 3; i++) {
  const divisor = matrix[i][i];
  for (let j = i; j < 4; j++) matrix[i][j] /= divisor;
  for (let k = 0; k < 3; k++) if (k !== i) {
    const factor = matrix[k][i];
    for (let j = i; j < 4; j++) matrix[k][j] -= factor * matrix[i][j];
  }
}
const kernel = matrix.map(row => row[3]);
const round = number => Number(number.toFixed(3));
let rawMismatch = false;
console.log(JSON.stringify({status: 'Rejected rendering model. NVIDIA profile sharpening caused the mismatch. Use --assert-native for the driver-off captures.', training: fixtures.slice(0, 2).map(([file]) => file), lumaWeights: weights, kernel: {center: kernel[0], axial: kernel[1], diagonal: kernel[2], sum: kernel[0] + 4 * kernel[1] + 4 * kernel[2]}, note: 'A fixed luma kernel is a falsifiable diagnostic approximation. Errors remaining on held-out black pixels prevent treating it as an exact shader.'}, null, 2));
for (const {file, rows} of sets) {
  const rawErrors = [], fittedErrors = [];
  let maximumError = 0, clippedChannels = 0;
  for (const row of rows.filter(row => row.affected)) {
    const correction = row.features.reduce((sum, value, index) => sum + value * kernel[index], 0);
    for (let channel = 0; channel < 3; channel++) {
      const prediction = Math.max(0, Math.min(255, row.raw[channel] + correction));
      const error = row.actual[channel] - prediction;
      rawErrors.push((row.actual[channel] - row.raw[channel]) ** 2);
      fittedErrors.push(error ** 2);
      maximumError = Math.max(maximumError, Math.abs(error));
      if (row.actual[channel] === 0 || row.actual[channel] === 255) clippedChannels++;
    }
  }
  const rmse = errors => round(Math.sqrt(errors.reduce((sum, value) => sum + value, 0) / errors.length));
  if (rmse(rawErrors) > 1) rawMismatch = true;
  console.log(JSON.stringify({file, role: file === 'live-black.png' ? 'held out' : 'training', affectedPixels: rawErrors.length / 3, clippedChannels, rawRgbRmse: rmse(rawErrors), fittedRgbRmse: rmse(fittedErrors), maximumChannelError: round(maximumError)}));
}
// Optional red-capable measurement for the unresolved raw-overlay mismatch.
// This diagnostic is deliberately separate from the passing regression suite.
if (process.argv.includes('--assert-raw') && rawMismatch) {
  console.error('Raw opaque overlay differs from the live game captures by more than one RGB value RMS.');
  process.exitCode = 1;
}
