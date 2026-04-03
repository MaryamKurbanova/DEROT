/**
 * Serene artificial breath beds — clearly different inhale vs exhale.
 * Inhale: soft pink “open / light air”, gentle motion. Exhale: warm brown, darker, softer level.
 * node scripts/generate-breath-wavs.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../assets/sounds');
const SR = 44100;

function onePole(prev, x, a) {
  return (1 - a) * prev + a * x;
}

function smoothstep(t) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Soft pink — peaceful, not harsh like white noise. */
function makePink() {
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  return () => {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const x = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    return x * 0.038;
  };
}

function makeBrown() {
  let b = 0;
  return () => {
    const w = Math.random() * 2 - 1;
    b = b * 0.9968 + w * 0.012;
    return b;
  };
}

function applyEdgeFade(left, right, samples) {
  const n = left.length;
  const f = Math.min(samples, Math.floor(n / 2));
  for (let i = 0; i < f; i++) {
    const w = smoothstep(i / f);
    left[i] *= w;
    right[i] *= w;
    const j = n - 1 - i;
    left[j] *= w;
    right[j] *= w;
  }
}

/**
 * Inhale: light, airy pink; slow gentle swell; wide peaceful stereo (crossfeed).
 */
function makeInhaleTexture() {
  const pL = makePink();
  const pR = makePink();
  let lpL = 0;
  let lpR = 0;
  let lp2L = 0;
  let lp2R = 0;
  let airyL = 0;
  let airyR = 0;
  return (i, n) => {
    const t = i / SR;
    const xL = pL();
    const xR = pR();
    lpL = onePole(lpL, xL, 0.045);
    lpR = onePole(lpR, xR, 0.045);
    lp2L = onePole(lp2L, lpL, 0.12);
    lp2R = onePole(lp2R, lpR, 0.12);
    const hL = xL - lp2L;
    const hR = xR - lp2R;
    airyL = onePole(airyL, hL, 0.28);
    airyR = onePole(airyR, hR, 0.28);
    const softHiL = (hL - airyL) * 0.35;
    const softHiR = (hR - airyR) * 0.35;

    const l0 = lp2L * 0.88 + softHiL;
    const r0 = lp2R * 0.88 + softHiR;
    let l = l0 * 0.78 + r0 * 0.22;
    let r = r0 * 0.78 + l0 * 0.22;

    const lift = 0.76 + 0.24 * smoothstep(Math.min(1, t / 2.4));
    const drift = 1 + 0.035 * Math.sin(t * Math.PI * 2 * 0.06);
    l *= lift * drift;
    r *= lift * drift;

    return { l, r };
  };
}

/**
 * Exhale: warm brown “blanket”, heavy low-pass, narrow stereo — clearly darker & calmer than inhale.
 */
function makeExhaleTexture() {
  const bL = makeBrown();
  const bR = makeBrown();
  let L = 0;
  let R = 0;
  let L2 = 0;
  let R2 = 0;
  return (i, n) => {
    const t = i / SR;
    const u = i / Math.max(1, n - 1);
    const xL = bL();
    const xR = bR();
    L = onePole(L, xL, 0.025);
    R = onePole(R, xR, 0.025);
    L2 = onePole(L2, L, 0.055);
    R2 = onePole(R2, R, 0.055);

    const l0 = L2 * 1.08;
    const r0 = R2 * 1.08;
    const mono = (l0 + r0) * 0.5;
    const side = (l0 - r0) * 0.12;
    let l = mono + side;
    let r = mono - side;

    const settle = 0.92 - 0.22 * smoothstep(u);
    const slow = 1 + 0.025 * Math.sin(t * Math.PI * 2 * 0.035 + 1.2);
    l *= settle * slow;
    r *= settle * slow;

    return { l, r };
  };
}

function writeStereoWav(filename, left, right, targetPeak = 0.9) {
  const n = left.length;
  if (right.length !== n) throw new Error('channel length mismatch');

  let peak = 0;
  for (let i = 0; i < n; i++) {
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const norm = peak > 0 ? targetPeak / peak : 1;

  const dataSize = n * 4;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  let off = 44;
  const q = 0.97;
  for (let i = 0; i < n; i++) {
    const sl = Math.max(-1, Math.min(1, left[i] * norm * q));
    const sr = Math.max(-1, Math.min(1, right[i] * norm * q));
    buf.writeInt16LE(Math.round(sl * 32767), off);
    buf.writeInt16LE(Math.round(sr * 32767), off + 2);
    off += 4;
  }
  fs.writeFileSync(filename, buf);
}

function render(sec, fn) {
  const n = Math.floor(SR * sec);
  const left = new Float32Array(n);
  const right = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const { l, r } = fn(i, n);
    left[i] = l;
    right[i] = r;
  }
  return { left, right };
}

fs.mkdirSync(OUT, { recursive: true });

const EDGE = Math.floor(SR * 0.08);

const inFn = makeInhaleTexture();
const inh = render(6.5, (i, n) => inFn(i, n));
applyEdgeFade(inh.left, inh.right, EDGE);
writeStereoWav(path.join(OUT, 'breath-inhale.wav'), inh.left, inh.right, 0.86);

const exFn = makeExhaleTexture();
const exh = render(6.5, (i, n) => exFn(i, n));
applyEdgeFade(exh.left, exh.right, EDGE);
writeStereoWav(path.join(OUT, 'breath-exhale.wav'), exh.left, exh.right, 0.7);

console.log('Wrote serene breath-inhale.wav (pink air), breath-exhale.wav (brown calm) →', OUT);
