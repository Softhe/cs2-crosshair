import sharp from 'sharp';
import {fileURLToPath} from 'node:url';

// Rejected hypothesis: green-only captures can resemble filtered opacity.
// Live muted/black captures reveal signed grayscale changes and reject this as
// a general appearance model. See analyze-live-crosshair-appearance.mjs.
const directory = new URL('../docs/evidence/crosshair-calibration/', import.meta.url);
const fixtures = ['baseline-original.png', 'thickness-2.png', 'thickness-3.png', 'thickness-2-gap-4.png', 'reference-810.png'];
const load = async file => {
  const {data, info} = await sharp(fileURLToPath(new URL(file, directory))).removeAlpha().raw().toBuffer({resolveWithObject: true});
  return (x, y) => Array.from(data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3));
};
const background = await load('background.png');
const images = await Promise.all(fixtures.map(load));
const mask = pixel => Number(pixel[1] - pixel[0] > 40 && pixel[2] - pixel[0] > 20);
const samples = image => {
  const result = [];
  for (let y = 559; y <= 583; y++) for (let x = 949; x <= 973; x++) {
    const actual = image(x, y), bg = background(x, y);
    const features = [mask(actual), 0, 0];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx || dy) features[dx && dy ? 2 : 1] += mask(image(x + dx, y + dy));
    }
    result.push({actual, bg, features});
  }
  return result;
};
const sets = images.map(samples);
const training = sets.slice(0, 2).flat();
const matrix = Array.from({length: 3}, (_, i) => Array.from({length: 4}, (_, j) => training.reduce((sum, sample) =>
  sum + sample.features[i] * (j === 3 ? 1 - sample.actual[0] / sample.bg[0] : sample.features[j]), 0)));
for (let i = 0; i < 3; i++) {
  const divisor = matrix[i][i];
  for (let j = i; j < 4; j++) matrix[i][j] /= divisor;
  for (let k = 0; k < 3; k++) if (k !== i) {
    const factor = matrix[k][i];
    for (let j = i; j < 4; j++) matrix[k][j] -= factor * matrix[i][j];
  }
}
const kernel = matrix.map(row => row[3]);
const round = n => Number(n.toFixed(3));
console.log(JSON.stringify({status: 'Rejected as a general appearance model by the live muted and black captures.', training: fixtures.slice(0, 2), kernel: {center: kernel[0], axial: kernel[1], diagonal: kernel[2], sum: kernel[0] + 4 * kernel[1] + 4 * kernel[2]}, note: 'Foreground mask is measured from game RGB. Fit uses the red channel, whose requested foreground value is zero. Held-out RGB errors are diagnostic, not proof of the game shader.'}, null, 2));
for (let index = 0; index < fixtures.length; index++) {
  const errors = {raw: [], retainedRgb: [], retainedGray: [], foregroundRgb: [], foregroundGray: []};
  let unchangedRegionDifferences = 0, affectedPixels = 0;
  for (const {actual, bg, features} of sets[index]) {
    const occupied = features[0];
    if (!features.some(Boolean)) {
      if (actual.some((value, channel) => Math.abs(value - bg[channel]) > 2)) unchangedRegionDifferences++;
      continue;
    }
    affectedPixels++;
    const alpha = Math.max(0, Math.min(1, features.reduce((sum, value, i) => sum + value * kernel[i], 0)));
    const color = [0, 255, 168];
    for (let channel = 0; channel < 3; channel++) {
      const raw = occupied ? color[channel] : bg[channel];
      const rgb = Math.min(255, color[channel] * occupied + bg[channel] * (1 - alpha));
      const gray = Math.min(255, color[channel] * occupied + bg[occupied ? 0 : channel] * (1 - alpha));
      errors.raw.push((actual[channel] - raw) ** 2);
      errors.retainedRgb.push((actual[channel] - rgb) ** 2);
      errors.retainedGray.push((actual[channel] - gray) ** 2);
      if (occupied) {
        errors.foregroundRgb.push((actual[channel] - rgb) ** 2);
        errors.foregroundGray.push((actual[channel] - gray) ** 2);
      }
    }
  }
  console.log(JSON.stringify({file: fixtures[index], role: index < 2 ? 'training' : 'held out', affectedPixels, unchangedRegionDifferences, rmse8bit: Object.fromEntries(Object.entries(errors).map(([name, values]) => [name, round(Math.sqrt(values.reduce((sum, value) => sum + value, 0) / values.length))]))}));
}
