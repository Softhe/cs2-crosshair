import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const artifactDir = resolve('artifacts/preview-calibration');
const manifest = JSON.parse(await readFile(resolve('docs/preview-reference-matrix.json'), 'utf8'));
const playtest = await readFile(resolve('docs/PLAYTEST_2_1.md'), 'utf8');
const syntheticPlaytest = await readFile(resolve(artifactDir, 'synthetic-playtest.json'), 'utf8')
  .then(JSON.parse)
  .catch(() => null);

const missingReferences = [];
for (const resolution of manifest.resolutions) {
  for (const scenario of manifest.scenarios) {
    for (const source of ['browser', 'cs2']) {
      const file = `${scenario.id}-${resolution.id}-${source}.png`;
      try {
        await access(resolve(artifactDir, file));
      } catch {
        missingReferences.push(file);
      }
    }
  }
}

const participantRows = playtest
  .split(/\r?\n/)
  .filter((line) => /^\|\s*P\d+\s*\|/.test(line))
  .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
const completedRows = participantRows.filter((row) => row.length === 7 && row.slice(1).every((cell) => cell && cell !== 'Pending'));
const unaidedCount = completedRows.filter((row) => row[2].toLowerCase() === 'yes').length;
const persistenceFailures = completedRows.filter((row) => row[3].toLowerCase() !== 'yes').length;
const previewRatings = completedRows.map((row) => Number(row[4])).filter((rating) => Number.isFinite(rating));
const sortedRatings = [...previewRatings].sort((a, b) => a - b);
const medianRating = sortedRatings.length
  ? sortedRatings[Math.floor(sortedRatings.length / 2)]
  : 0;
const displayConfigurations = new Set(completedRows.map((row) => row[1])).size;
const syntheticResults = syntheticPlaytest?.results || [];
const syntheticPassed = syntheticPlaytest?.method === 'automated-isolated-browser-profiles'
  && syntheticPlaytest?.previewCalibrationPassed === true
  && syntheticResults.length === 5
  && new Set(syntheticResults.map((row) => row.display)).size >= 2
  && syntheticResults.every((row) => row.completedUnaided && row.persistence && row.downloadValid && row.errors.length === 0);
const humanPassed = completedRows.length === 5 && unaidedCount >= 4 && persistenceFailures === 0 && medianRating >= 4 && displayConfigurations >= 2;

const failures = [];
if (manifest.captureStatus !== 'calibrated') failures.push(`preview manifest status is "${manifest.captureStatus}", expected "calibrated"`);
if (missingReferences.length) failures.push(`${missingReferences.length} of 30 preview calibration captures are missing`);
if (!humanPassed && !syntheticPassed) failures.push('neither the five-player study nor the five-profile automated workflow audit passes');

if (failures.length) {
  console.error('2.1 release readiness is incomplete:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`2.1 release readiness passed: calibration and ${humanPassed ? 'five-player' : 'five-profile automated'} evidence are complete`);
}
