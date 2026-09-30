// Both continuous-variable interfaces use the same fixed fictional population.
export { makePopulation as makeUsagePopulation } from './pipeline-engine.mjs?v=20260930-7';

export function drawUsageSample(pop, n, random = Math.random) {
  if (![5,10,30].includes(n) || n > pop.size) throw new Error('Choose 5, 10, or 30 students.');
  // Partial Fisher–Yates shuffle using a sparse map: exact SRS without replacement.
  const swaps = new Map(), indices = [];
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(random() * (pop.size-i));
    indices.push(swaps.get(j) ?? j);
    swaps.set(j, swaps.get(i) ?? i);
  }
  const values = indices.map(i => pop.values[i]);
  // Integer tenths ensure the displayed sum matches the visible observations exactly.
  const sum = values.reduce((total, x) => total + Math.round(x*10), 0) / 10;
  return { indices, values, n, sum, mean:sum/n };
}
