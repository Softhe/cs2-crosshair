import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const artifactDir = resolve('artifacts/preview-calibration');
const manifest = JSON.parse(await readFile(resolve('docs/preview-reference-matrix.json'), 'utf8'));
const measurementReport = await readFile(resolve('artifacts/preview-calibration/measurements.json'), 'utf8')
	.then(JSON.parse)
	.catch(() => ({ calibrated: false, measurements: [] }));
const measurementMap = new Map(measurementReport.measurements.map((item) => [`${item.scenario}-${item.resolution}`, item]));
await mkdir(artifactDir, { recursive: true });
const exists = async (path) => access(path).then(() => true).catch(() => false);
const rows = [];

for (const resolution of manifest.resolutions) {
	for (const scenario of manifest.scenarios) {
		const stem = `${scenario.id}-${resolution.id}`;
		const browserFile = `${stem}-browser.png`;
		const cs2File = `${stem}-cs2.png`;
		rows.push({ scenario, resolution, browserFile, cs2File,
			browserExists: await exists(resolve(artifactDir, browserFile)),
			cs2Exists: await exists(resolve(artifactDir, cs2File)) });
	}
}

const completePairs = rows.filter((row) => row.browserExists && row.cs2Exists).length;
const image = (file, present, label) => present
	? `<img src="${file}" alt="${label}" loading="lazy">`
	: `<div class="missing">Missing ${label}</div>`;
const cards = rows.map(({ scenario, resolution, browserFile, cs2File, browserExists, cs2Exists }) => {
	const measurement = measurementMap.get(`${scenario.id}-${resolution.id}`);
	const geometry = measurement ? `<p class="geometry">Geometry (CS2 → Browser): ${measurement.cs2.width}×${measurement.cs2.height} → ${measurement.browser.width}×${measurement.browser.height}; max edge delta ${measurement.maxGeometryDelta}px · <b>${measurement.pass ? 'PASS' : 'FAIL'}</b></p>` : '';
	return `
<article><header><strong>${scenario.id}</strong><span>${resolution.id} · ${scenario.checks.join(', ')}</span></header>
${geometry}
<div class="comparison">
<figure><figcaption>CS2</figcaption>${image(cs2File, cs2Exists, 'CS2 center crop')}</figure>
<figure><figcaption>Browser</figcaption>${image(browserFile, browserExists, 'browser center crop')}</figure>
<figure><figcaption>Difference</figcaption>${browserExists && cs2Exists ? `<canvas width="96" height="96" data-diff data-a="${cs2File}" data-b="${browserFile}" aria-label="Absolute pixel difference"></canvas>` : '<div class="missing">Both crops required</div>'}</figure>
<figure class="overlay"><figcaption>50% overlay</figcaption>${browserExists && cs2Exists ? `<div><img src="${cs2File}" alt=""><img src="${browserFile}" alt="Aligned browser and CS2 overlay"></div>` : '<div class="missing">Both crops required</div>'}</figure>
</div></article>`;
}).join('');

const report = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>CS2 preview calibration</title><style>
body{margin:0;padding:24px;background:#050607;color:#eef6f4;font:14px system-ui}h1{margin:0 0 6px}.status{color:#9bb0ab;margin-bottom:24px}
article{border:1px solid #26302f;background:#0b0e0e;border-radius:10px;margin:0 0 20px;overflow:hidden}header{padding:12px 16px;display:flex;gap:12px;justify-content:space-between}header span,figcaption{color:#9bb0ab}
.geometry{margin:0;padding:0 16px 12px;color:#b9cbc7}.geometry b{color:#79dda8}
.comparison{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#26302f}figure{margin:0;padding:12px;background:#080a0a}figcaption{margin-bottom:8px}
img,canvas,.missing{width:100%;aspect-ratio:1;object-fit:contain;background:#020303;image-rendering:pixelated}.missing{display:grid;place-items:center;color:#d9a441}.overlay>div{position:relative}.overlay img+img{position:absolute;inset:0;opacity:.5}@media(max-width:900px){.comparison{grid-template-columns:repeat(2,1fr)}}
</style><body><h1>CS2 preview calibration report</h1><p class="status">${completePairs}/${rows.length} aligned 96×96 reference pairs complete · geometry ${measurementReport.calibrated ? 'calibrated within 1px' : 'not yet calibrated'}.</p>${cards}
<script>for(const canvas of document.querySelectorAll('[data-diff]')){const context=canvas.getContext('2d'),a=new Image(),b=new Image();Promise.all([new Promise(r=>{a.onload=r;a.src=canvas.dataset.a}),new Promise(r=>{b.onload=r;b.src=canvas.dataset.b})]).then(()=>{context.drawImage(a,0,0);const first=context.getImageData(0,0,96,96);context.clearRect(0,0,96,96);context.drawImage(b,0,0);const second=context.getImageData(0,0,96,96);for(let i=0;i<first.data.length;i+=4){first.data[i]=Math.abs(first.data[i]-second.data[i]);first.data[i+1]=Math.abs(first.data[i+1]-second.data[i+1]);first.data[i+2]=Math.abs(first.data[i+2]-second.data[i+2]);first.data[i+3]=255}context.putImageData(first,0,0)})}</script></body></html>`;

await writeFile(resolve(artifactDir, 'report.html'), report);
console.log(`Preview calibration report: ${completePairs}/${rows.length} pairs; ${resolve(artifactDir, 'report.html')}`);
if (process.env.REQUIRE_CS2_REFERENCES === '1' && completePairs !== rows.length) process.exitCode = 1;
