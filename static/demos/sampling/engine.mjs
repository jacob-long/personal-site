// Finite-population sampling. No network, DOM, or third-party dependencies.
export const GROUPS = ['First-year', 'Middle-year', 'Senior'];
export const DEFAULT_POPULATION = { shares: [45, 35, 20], rates: [35, 55, 70] };
export const MAX_DRAWS = 200;
export const MAX_SERIES = 4;

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function allocate(weights, n) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map(w => n * w / sum);
  const counts = raw.map(Math.floor);
  const order = raw.map((v, i) => ({ i, remainder: v - counts[i] }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);
  const left = n - counts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < left; i++) counts[order[i].i]++;
  return counts;
}

export function makePopulation({ shares, rates }, size = 50000) {
  if (shares.length !== 3 || rates.length !== 3 ||
      shares.some(x => !Number.isFinite(x) || x < 10 || x > 80) ||
      Math.abs(shares.reduce((a, b) => a + b, 0) - 100) > 1e-8 ||
      rates.some(x => !Number.isFinite(x) || x < 0 || x > 100) ||
      !Number.isInteger(size) || size < 20000) {
    throw new Error('Group shares must each be 10–80% and total 100%; support must be 0–100%.');
  }
  const sizes = allocate(shares, size);
  const yes = sizes.map((n, i) => Math.round(n * rates[i] / 100));
  return {
    size, sizes, yes,
    shares: sizes.map(n => n / size),
    rates: yes.map((y, i) => y / sizes[i]),
    truth: yes.reduce((a, b) => a + b, 0) / size
  };
}

// Sequential draws without replacement: exactly hypergeometric, not binomial.
export function hypergeometric(successes, total, draws, random = Math.random) {
  if (![successes, total, draws].every(Number.isInteger) ||
      successes < 0 || successes > total || draws < 0 || draws > total) {
    throw new Error('Invalid finite-population draw.');
  }
  if (draws > total / 2) return successes - hypergeometric(successes, total, total - draws, random);
  let picked = 0;
  for (let i = 0; i < draws; i++) {
    if (random() < successes / total) { picked++; successes--; }
    total--;
  }
  return picked;
}

export function canonicalSetup(setup) {
  const { n, method } = setup;
  if (!Number.isInteger(n) || n < 20 || n > 2000 ||
      !['random', 'convenience', 'proportional', 'equal'].includes(method)) {
    throw new Error('Choose a sample size from 20 to 2,000 and a listed sampling method.');
  }
  return { n, method, weighted: method === 'equal' ? setup.weighted !== false : method === 'proportional' };
}

export function signature(setup) {
  const s = canonicalSetup(setup);
  return `${s.method}:${s.n}:${s.weighted}`;
}

export function methodLabel(setup) {
  const s = canonicalSetup(setup);
  if (s.method === 'random') return 'Random sample';
  if (s.method === 'convenience') return 'Convenience sample';
  if (s.method === 'proportional') return 'Proportional stratified';
  return s.weighted ? 'Equal groups · weighted' : 'Equal groups · unweighted';
}

function drawCounts(pop, setup, random) {
  if (setup.method === 'random') {
    const a = hypergeometric(pop.sizes[0], pop.size, setup.n, random);
    const b = hypergeometric(pop.sizes[1], pop.size - pop.sizes[0], setup.n - a, random);
    return [a, b, setup.n - a - b];
  }
  if (setup.method === 'convenience') return allocate([70, 20, 10], setup.n);
  if (setup.method === 'proportional') return allocate(pop.sizes, setup.n);
  return allocate([1, 1, 1], setup.n);
}

export function drawSample(pop, settings, random = Math.random) {
  const setup = canonicalSetup(settings);
  const counts = drawCounts(pop, setup, random);
  const yes = counts.map((n, i) => hypergeometric(pop.yes[i], pop.sizes[i], n, random));
  const rates = yes.map((y, i) => counts[i] ? y / counts[i] : null);
  const raw = yes.reduce((a, b) => a + b, 0) / setup.n;
  const estimate = setup.weighted
    ? rates.reduce((sum, p, i) => sum + pop.shares[i] * p, 0) : raw;
  let variance = null;
  if (setup.method === 'random') {
    variance = (1 - setup.n / pop.size) * raw * (1 - raw) / (setup.n - 1);
  } else if (setup.weighted) {
    variance = counts.reduce((sum, n, i) =>
      sum + pop.shares[i] ** 2 * (1 - n / pop.sizes[i]) * rates[i] * (1 - rates[i]) / (n - 1), 0);
  }
  // Suppress unreliable normal intervals at sparse/degenerate outcomes.
  const intervalReliable = setup.method === 'random'
    ? yes.reduce((a, b) => a + b, 0) >= 5 && setup.n - yes.reduce((a, b) => a + b, 0) >= 5
    : counts.every((n, i) => yes[i] >= 5 && n - yes[i] >= 5);
  const halfWidth = variance !== null && intervalReliable ? 1.96 * Math.sqrt(variance) : null;
  return {
    counts, yes, rates, raw, estimate, error: estimate - pop.truth,
    interval: halfWidth === null ? null : [Math.max(0, estimate - halfWidth), Math.min(1, estimate + halfWidth)],
    halfWidth,
    intervalReason: setup.method === 'convenience' ? 'bias'
      : setup.method === 'equal' && !setup.weighted ? 'unweighted'
        : !intervalReliable ? 'sparse' : 'available'
  };
}

export function expectedEstimate(pop, settings) {
  const s = canonicalSetup(settings);
  if (s.method === 'random' || s.weighted) return pop.truth;
  const weights = s.method === 'convenience' ? [70, 20, 10] : [1, 1, 1];
  const counts = allocate(weights, s.n);
  return counts.reduce((sum, n, i) => sum + n / s.n * pop.rates[i], 0);
}

export function theoreticalVariance(pop, settings) {
  const s = canonicalSetup(settings);
  if (s.method === 'random') return (1 - s.n / pop.size) * pop.truth * (1 - pop.truth) * pop.size / (pop.size - 1) / s.n;
  const counts = drawCounts(pop, s, () => 0.5);
  const weights = s.weighted ? pop.shares : counts.map(n => n / s.n);
  return counts.reduce((sum, n, i) => sum + weights[i] ** 2 * (1 - n / pop.sizes[i]) *
    pop.rates[i] * (1 - pop.rates[i]) * pop.sizes[i] / (pop.sizes[i] - 1) / n, 0);
}

export function summarize(values) {
  if (!values.length) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = values.length > 1
    ? Math.sqrt(values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1)) : null;
  return { mean, sd };
}

export const PRESETS = {
  variation: [{ n: 50, method: 'random' }],
  size: [{ n: 50, method: 'random' }, { n: 500, method: 'random' }],
  bias: [{ n: 50, method: 'random' }, { n: 500, method: 'random' }, { n: 2000, method: 'convenience' }]
};
