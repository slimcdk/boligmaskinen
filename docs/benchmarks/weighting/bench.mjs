// Weighting benchmark: 3 preferences (one with missing data) and 1 requirement over N cells.
// Build the engine first: npx esbuild ../../../frontend/src/app/scoring/blocks.ts --bundle --format=esm --platform=node --outfile=blocks.mjs
import { evaluateBlocks } from './blocks.mjs';

const N = 4_251_411; // all Danish land at 100 m
let seed = 42;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const forest = new Float32Array(N), noise = new Float32Array(N), school = new Float32Array(N), zone = new Float32Array(N);
for (let i = 0; i < N; i++) {
  forest[i] = rand() * 8000;
  noise[i] = rand() < 0.05 ? NaN : 40 + rand() * 35;
  school[i] = rand() * 10000;
  zone[i] = 1 + Math.floor(rand() * 3);
}

const median = (xs) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
function time(label, fn, runs = 7) {
  fn(); // warm up the JIT
  const times = [];
  for (let r = 0; r < runs; r++) { const t = performance.now(); fn(); times.push(performance.now() - t); }
  console.log(`${label.padEnd(44)} ${median(times).toFixed(1).padStart(7)} ms`);
}

// A: the prototype's block engine (formulas compiled to closures)
const blocks = [
  { id: 'f', name: 'Forest', role: 'want', weight: 4, code: 'let full = slider(300, 0, 20000, 50)\nlet zero = slider(3000, 0, 20000, 50)\nramp(forest, full, zero)' },
  { id: 'n', name: 'Quiet', role: 'want', weight: 4, code: 'ramp(noise, 45, 65)' },
  { id: 's', name: 'School', role: 'want', weight: 2, code: 'ramp(school, 1000, 5000)' },
  { id: 'z', name: 'Zone', role: 'must', weight: 2, code: 'zone == BYZONE || zone == LANDZONE' },
];
const values = { forest, noise, school, zone };
const inputs = { names: Object.keys(values), values: (name) => values[name] ?? null };
let check = 0;
time('Node 24: block engine (closures)', () => { const r = evaluateBlocks(blocks, N, inputs); check = r.histogram[50]; });
const checkA = check;

// B: what a code generator would emit for the same blocks (one fused loop, JIT-compiled by V8)
const out = new Float32Array(N), hist = new Uint32Array(101);
const ramp = (x, full, zero) => { const u = (zero - x) / (zero - full); return u < 0 ? 0 : u > 1 ? 1 : u; };
time('Node 24: generated loop', () => {
  hist.fill(0);
  for (let i = 0; i < N; i++) {
    const z = zone[i];
    if (!(z === 1 || z === 2)) { out[i] = -1; continue; }
    let sum = 0, w = 0;
    sum += 4 * ramp(forest[i], 300, 3000); w += 4;
    const n = noise[i];
    if (n === n) { sum += 4 * ramp(n, 45, 65); w += 4; }
    sum += 2 * ramp(school[i], 1000, 5000); w += 2;
    const s = (sum / w) * 100;
    out[i] = s;
    hist[Math.round(s)]++;
  }
  check = hist[50];
});
console.log(`check: histogram[50] = ${checkA} (engine) / ${check} (loop)`);
