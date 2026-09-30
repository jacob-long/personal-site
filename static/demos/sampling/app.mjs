import {
  GROUPS, DEFAULT_POPULATION, MAX_DRAWS, MAX_SERIES, PRESETS, makePopulation,
  canonicalSetup, signature, methodLabel, drawSample, summarize, seededRandom
} from './engine.mjs?v=20260930-7';
import { dropNewDots } from './motion.mjs?v=20260930-7';

const $ = id => document.getElementById(id);
const colors = ['#176d77', '#3b64ae', '#ac5623', '#785493'];
const random = seededRandom(crypto.getRandomValues(new Uint32Array(1))[0]);
let population = makePopulation(DEFAULT_POPULATION);
let series = [];
let nextId = 1;
let activeId = null;
let last = null;
let busy = false;
let arrivals = null;
const pct = p => `${(p * 100).toFixed(1)}%`;
const points = p => `${p >= .0005 ? '+' : p <= -.0005 ? '−' : ''}${Math.abs(p * 100).toFixed(1)} points`;
const html = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const methodNotes = {
  random: 'Every student has the same chance of selection.',
  convenience: 'This scenario recruits 70% first-year, 20% middle-year, and 10% seniors.',
  proportional: 'Draw randomly within each year group, in proportion to its population share.',
  equal: 'Draw randomly within each year group, taking about the same number from each.'
};
const prompts = {
  variation: 'Draw a few samples. Does the estimate change even though the population stays the same?',
  size: 'Compare the two distributions. What changes when each sample has 500 students instead of 50?',
  bias: 'The convenience sample has 2,000 students. Where do its estimates land compared with the random samples?'
};

function announce(text) { $('announcement').textContent = text; }
function error(text = '') { $('control-error').textContent = text; $('control-error').hidden = !text; }
function getSetup() {
  return canonicalSetup({ n: Number($('sample-size').value), method: $('method').value, weighted: $('weighted').checked });
}
function setControls(setup) {
  $('sample-size').value = setup.n;
  $('size-slider').value = setup.n;
  $('method').value = setup.method;
  if (setup.method === 'equal') $('weighted').checked = setup.weighted !== false;
  syncControls();
}
function syncControls() {
  const method = $('method').value;
  $('method-note').textContent = methodNotes[method];
  $('weight-control').hidden = method !== 'equal';
  let setup;
  try { setup = getSetup(); } catch (_) {
    ['draw-one','draw-ten','draw-hundred'].forEach(id => $(id).disabled = true);
    $('setup-notice').textContent = 'Enter a whole-number sample size from 20 to 2,000.';
    return;
  }
  const match = series.find(s => signature(s.setup) === signature(setup));
  activeId = match?.id ?? null;
  const full = match ? match.samples.length >= MAX_DRAWS : series.length >= MAX_SERIES;
  ['draw-one','draw-ten','draw-hundred'].forEach(id => $(id).disabled = busy || full);
  $('setup-notice').textContent = match && full ? 'This setup has 200 draws. Clear draws to run it again.'
    : !match && full ? 'Four setups are already shown. Remove one before adding another.'
    : match ? 'New draws join this setup. Other comparisons stay on screen.'
    : 'Your next draw adds a comparison. Earlier results stay.';
  document.querySelectorAll('.series-select').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.id) === activeId)));
}
function newSeries(setup) {
  const used = new Set(series.map(s => s.color));
  return { id: nextId++, setup: canonicalSetup(setup), color: colors.find(c => !used.has(c)) || colors[0], samples: [] };
}
function activatePreset(key) {
  if (busy) return;
  const old = series;
  series = [];
  for (const setup of PRESETS[key]) {
    const existing = old.find(s => signature(s.setup) === signature(setup));
    series.push(existing || newSeries(setup));
  }
  // Assign distinct, stable preset colors, including when coming from custom setups.
  series.forEach((s, i) => s.color = colors[i]);
  if (last && !series.some(s => s.id === last.id)) last = null;
  document.querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.preset === key)));
  $('explore-prompt').textContent = prompts[key];
  setControls(series.at(-1).setup);
  error();
  render();
  announce(`${series.length} ${series.length === 1 ? 'setup' : 'setups'} ready. ${prompts[key]}`);
}

async function runDraws(count, all = false) {
  if (busy) return;
  error();
  let targets;
  if (all) targets = series.filter(s => s.samples.length < MAX_DRAWS);
  else {
    let setup;
    try { setup = getSetup(); } catch(e) { error(e.message); return; }
    let target = series.find(s => signature(s.setup) === signature(setup));
    if (!target) {
      if (series.length >= MAX_SERIES) { error('Remove one setup to make room for another comparison.'); return; }
      target = newSeries(setup);
      series.push(target);
      document.querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    }
    targets = [target];
  }
  busy = true;
  document.querySelectorAll('button,input,select,summary').forEach(el => {
    if ('disabled' in el) { el.dataset.wasDisabled = String(el.disabled); el.disabled = true; }
  });
  // Yield to paint the disabled controls; the work is small but must not double-submit.
  await new Promise(resolve => requestAnimationFrame(resolve));
  let drawn = 0;
  const starts = new Map(targets.map(s => [s.id, s.samples.length]));
  try {
    for (const target of targets) {
      const amount = Math.min(count, MAX_DRAWS - target.samples.length);
      for (let i = 0; i < amount; i++) target.samples.push(drawSample(population, target.setup, random));
      if (amount > 0) { last = { id: target.id, sample: target.samples.at(-1) }; activeId = target.id; }
      drawn += amount;
    }
  } catch(e) { error(`The sample could not be drawn: ${e.message}`); }
  finally {
    busy = false;
    document.querySelectorAll('[data-was-disabled]').forEach(el => {
      el.disabled = el.dataset.wasDisabled === 'true'; delete el.dataset.wasDisabled;
    });
  }
  if (last) setControls(series.find(s => s.id === last.id).setup);
  arrivals = { starts, startedAt: performance.now() };
  render();
  announce(`Added ${drawn} ${drawn === 1 ? 'sample' : 'samples'}.${last ? ` Last estimate ${pct(last.sample.estimate)}; population ${pct(population.truth)}.` : ''}`);
}

function render() {
  $('truth-value').textContent = pct(population.truth);
  const focus = document.activeElement;
  const focusedId = focus?.classList.contains('series-select') ? focus.dataset.id : null;
  $('series-list').innerHTML = series.map(s => {
    const stats = summarize(s.samples.map(d => d.estimate));
    let summary = !stats ? 'No draws yet. Add samples to see a distribution.'
      : s.samples.length === 1 ? `Last estimate <strong>${pct(stats.mean)}</strong> · draw again to see variation.`
      : `Mean across draws <strong>${pct(stats.mean)}</strong> <span>(${points(stats.mean - population.truth)} from population)</span>`;
    if (s.setup.method === 'equal' && !s.setup.weighted) summary += ' <span class="warning">Unweighted: group shares are not corrected.</span>';
    return `<article class="series-card" style="--series:${s.color}" data-series-id="${s.id}">
      <div class="series-heading"><button class="series-select" data-id="${s.id}" aria-pressed="${s.id === activeId}" aria-label="Select ${html(methodLabel(s.setup))}, ${s.setup.n} students">
        <span class="series-swatch" aria-hidden="true"></span><span class="series-name">${html(methodLabel(s.setup))}</span><span class="series-meta">n = ${s.setup.n.toLocaleString()} students</span></button>
        <div class="series-actions"><span>${s.samples.length} / ${MAX_DRAWS} draws</span><button class="remove-series" data-remove="${s.id}" aria-label="Remove ${html(methodLabel(s.setup))}, ${s.setup.n} students" ${series.length === 1 ? 'disabled' : ''}>Remove</button></div></div>
      <div class="chart" id="chart-${s.id}"></div><p class="series-summary">${summary}</p></article>`;
  }).join('');
  document.querySelectorAll('.series-select').forEach(button => button.addEventListener('click', () => {
    const selected = series.find(s => s.id === Number(button.dataset.id));
    setControls(selected.setup);
    last = selected.samples.length ? { id: selected.id, sample: selected.samples.at(-1) } : null;
    renderLast();
    drawCharts();
    announce(`Selected ${methodLabel(selected.setup)}, ${selected.setup.n} students.`);
  }));
  document.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
    const id = Number(button.dataset.remove);
    series = series.filter(s => s.id !== id);
    if (last?.id === id) last = null;
    if (activeId === id) setControls(series[0].setup);
    document.querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    render();
    $('draw-one').focus();
  }));
  syncControls();
  $('repeat-all').disabled = busy || series.every(s => s.samples.length >= MAX_DRAWS);
  $('clear-results').disabled = busy || !series.some(s => s.samples.length);
  drawCharts();
  renderLast();
  if (focusedId) document.querySelector(`.series-select[data-id="${focusedId}"]`)?.focus();
}

function domain() {
  if (!$('zoom').checked) return [0, 100];
  const values = [population.truth * 100, ...series.flatMap(s => s.samples.map(d => d.estimate * 100))];
  const lo = Math.min(...values), hi = Math.max(...values);
  // A minimum 10-point window avoids visually exaggerating nearly identical estimates.
  const pad = Math.max(3, (10 - (hi - lo)) / 2);
  return [Math.max(0, Math.floor((lo - pad) / 5) * 5), Math.min(100, Math.ceil((hi + pad) / 5) * 5)];
}

function drawCharts() {
  const [low, high] = domain();
  for (const s of series) {
    const container = $(`chart-${s.id}`);
    if (!container) continue;
    const width = Math.max(240, container.getBoundingClientRect().width);
    const left = 29, right = 22, inner = width - left - right;
    const binWidth = [0.25,0.5,1,2,5].find(v => inner * v / (high - low) >= 6) || 5;
    const bins = new Map();
    const dots = s.samples.map((sample, i) => {
      const bin = Math.round(sample.estimate * 100 / binWidth) * binWidth;
      const stack = (bins.get(bin) || 0) + 1; bins.set(bin, stack);
      return { sample, bin, stack, i };
    });
    const maxStack = Math.max(1, ...bins.values());
    const compact = document.body.classList.contains('classroom') && innerWidth > 760;
    const plotHeight = compact ? 76 : Math.max(105, Math.min(205, maxStack * 6.7));
    const top = compact ? 8 : 15, bottom = compact ? 39 : 43;
    const height = top + plotHeight + bottom;
    // Dense stacks may overlap, but must remain visible on a classroom projector.
    const radius = Math.max(compact ? 1.5 : 1.1, Math.min(3.05, plotHeight / (maxStack * 2 + 1)));
    const spacing = Math.min(6.7, plotHeight / (maxStack + 1));
    const base = top + plotHeight;
    const x = value => left + (Math.max(low, Math.min(high, value)) - low) / (high - low) * inner;
    const tickStep = (high - low) <= 20 ? 5 : (high - low) <= 50 ? 10 : width < 460 ? 25 : 20;
    let ticks = [];
    for (let v = Math.ceil(low / tickStep) * tickStep; v <= high; v += tickStep) ticks.push(v);
    if (!ticks.length) ticks = [low, high];
    const grid = ticks.map(v => `<line class="chart-grid" x1="${x(v)}" y1="${top}" x2="${x(v)}" y2="${base}"/><text x="${x(v)}" y="${base+18}" text-anchor="middle">${v}%</text>`).join('');
    const desc = !s.samples.length ? 'No samples drawn yet.' : `${s.samples.length} sample estimates, ranging from ${pct(Math.min(...s.samples.map(v=>v.estimate)))} to ${pct(Math.max(...s.samples.map(v=>v.estimate)))}. Mean ${pct(summarize(s.samples.map(v=>v.estimate)).mean)}.`;
    const marks = dots.map(({ sample, bin, stack, i }) => `<circle class="sample-dot ${i === dots.length-1 ? 'latest' : ''}" cx="${x(bin)}" cy="${base - stack * spacing}" r="${radius}"><title>Draw ${i+1}: ${pct(sample.estimate)} support; ${s.setup.n} students; ${points(sample.error)} from population</title></circle>`).join('');
    const empty = !dots.length ? `<text class="empty-chart" x="${width/2}" y="${top + plotHeight/2}" text-anchor="middle">${width < 410 ? 'Draw samples to begin' : 'Draw samples to build the distribution'}</text>` : '';
    container.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title-${s.id} desc-${s.id}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <title id="title-${s.id}">${html(methodLabel(s.setup))}, n=${s.setup.n}</title><desc id="desc-${s.id}">${desc} Population support is ${pct(population.truth)}. Each dot is a complete sample; positions are binned to ${binWidth} percentage points. All panels use a ${low}% to ${high}% scale.</desc>
      ${grid}<line class="truth-mark" x1="${x(population.truth*100)}" x2="${x(population.truth*100)}" y1="${top}" y2="${base}"/>${marks}${empty}
      <text class="axis-title" x="${left + inner/2}" y="${height-5}" text-anchor="middle">Estimated support (%)</text></svg>`;
    if (arrivals?.starts.has(s.id)) {
      dropNewDots(container.querySelectorAll('.sample-dot'), arrivals.starts.get(s.id), arrivals.startedAt, top);
    }
  }
}

function renderLast() {
  $('last-empty').hidden = !!last;
  $('last-content').hidden = !last;
  if (!last) { $('last-context').textContent = 'No sample selected'; return; }
  const s = series.find(item => item.id === last.id);
  if (!s) { last = null; renderLast(); return; }
  const d = last.sample;
  $('last-draw').style.setProperty('--active-series', s.color);
  $('last-context').textContent = `${methodLabel(s.setup)} · draw ${s.samples.length}`;
  $('sample-estimate').textContent = pct(d.estimate);
  $('sample-error').textContent = points(d.error);
  $('sample-count').textContent = s.setup.n.toLocaleString();
  $('weight-explanation').hidden = !s.setup.weighted && s.setup.method !== 'equal';
  $('weight-explanation').textContent = s.setup.weighted
    ? `Population-weighted estimate: ${pct(d.estimate)}. The unweighted share of sampled students saying yes is ${pct(d.raw)}.`
    : `Unweighted estimate: each sampled student counts equally, even though the group mix differs from the population.`;
  $('interval-detail').hidden = !$('show-interval').checked;
  if (d.intervalReason === 'bias') $('interval-detail').textContent = 'No population uncertainty interval shown. A conventional random-sampling margin of error would not account for this selection bias.';
  else if (d.intervalReason === 'unweighted') $('interval-detail').textContent = 'No population uncertainty interval shown. Turn on population weights to estimate overall support from this equal-group sample.';
  else if (d.intervalReason === 'sparse') $('interval-detail').textContent = 'No interval shown: too few yes or no responses for a reliable normal approximation.';
  else $('interval-detail').textContent = `Approximate 95% interval: ${pct(d.interval[0])}–${pct(d.interval[1])} (margin ±${(d.halfWidth*100).toFixed(1)} percentage points). Accounts for random sampling under this design, not other sources of error.`;
  $('composition').innerHTML = GROUPS.map((name,i) => {
    const pop = population.shares[i]*100, sample = d.counts[i]/s.setup.n*100;
    return `<div class="composition-row"><span class="composition-label">${name}</span><div class="bar-pair" role="img" aria-label="${name}: ${pop.toFixed(1)} percent of population; ${sample.toFixed(1)} percent of sample">
      <div class="bar-line"><div class="bar-track"><div class="bar" style="width:${pop}%"></div></div><span class="bar-value">${pop.toFixed(0)}%</span></div>
      <div class="bar-line"><div class="bar-track"><div class="bar sample" style="width:${sample}%"></div></div><span class="bar-value">${sample.toFixed(0)}%</span></div></div></div>`;
  }).join('');
  $('group-rows').innerHTML = GROUPS.map((name,i) => `<tr><th scope="row">${name}</th><td>${d.counts[i]}</td><td>${pct(population.rates[i])}</td><td>${d.rates[i] === null ? 'No students' : pct(d.rates[i])}</td></tr>`).join('');
}

function applyPopulation(config) {
  let next;
  try { next = makePopulation(config); }
  catch(e) { $('population-error').textContent = e.message; $('population-error').hidden = false; return; }
  population = next;
  series.forEach(s => s.samples = []);
  last = null;
  $('population-error').hidden = true;
  $('equal-rates').textContent = 'Try 50% support in every group';
  render();
  announce(`Population updated. Support is now ${pct(population.truth)}. All previous samples were cleared.`);
}
function populationDraft() {
  return { shares: GROUPS.map((_,i) => Number($(`share-${i}`).value)), rates: GROUPS.map((_,i) => Number($(`rate-${i}`).value)) };
}

document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => activatePreset(b.dataset.preset)));
$('sample-size').addEventListener('input', () => {
  if ($('sample-size').validity.valid) $('size-slider').value = $('sample-size').value;
  syncControls(); error();
});
$('size-slider').addEventListener('input', () => { $('sample-size').value = $('size-slider').value; syncControls(); error(); });
$('method').addEventListener('change', () => { syncControls(); error(); });
$('weighted').addEventListener('change', syncControls);
$('draw-one').addEventListener('click', () => runDraws(1));
$('draw-ten').addEventListener('click', () => runDraws(10));
$('draw-hundred').addEventListener('click', () => runDraws(100));
$('repeat-all').addEventListener('click', () => runDraws(100, true));
$('clear-results').addEventListener('click', () => { series.forEach(s => s.samples = []); last = null; render(); announce('All draws cleared. Population and setups are unchanged.'); });
$('zoom').addEventListener('change', drawCharts);
$('show-interval').addEventListener('change', renderLast);
$('population-form').addEventListener('submit', event => { event.preventDefault(); applyPopulation(populationDraft()); });
GROUPS.forEach((_,i) => $(`rate-${i}`).addEventListener('input', () => {
  $(`rate-value-${i}`).textContent = `${$(`rate-${i}`).value}%`;
  $('equal-rates').textContent = 'Try 50% support in every group';
}));
$('equal-rates').addEventListener('click', () => {
  GROUPS.forEach((_,i) => { $(`rate-${i}`).value = 50; $(`rate-value-${i}`).textContent = '50%'; });
  $('equal-rates').textContent = '50% entered above · apply to use';
});
$('reset-all').addEventListener('click', () => {
  population = makePopulation(DEFAULT_POPULATION); series = []; last = null;
  GROUPS.forEach((_,i) => {
    $(`share-${i}`).value = DEFAULT_POPULATION.shares[i];
    $(`rate-${i}`).value = DEFAULT_POPULATION.rates[i];
    $(`rate-value-${i}`).textContent = `${DEFAULT_POPULATION.rates[i]}%`;
  });
  $('equal-rates').textContent = 'Try 50% support in every group';
  $('population-error').hidden = true; $('show-interval').checked = false; $('zoom').checked = false;
  $('weighted').checked = true;
  activatePreset('variation'); announce('Default population and settings restored. All samples cleared.');
});
$('presentation').addEventListener('click', () => {
  const enabled = document.body.classList.toggle('classroom');
  $('presentation').setAttribute('aria-pressed', String(enabled));
  $('presentation').textContent = enabled ? 'Exit classroom view' : 'Classroom view';
  requestAnimationFrame(drawCharts);
});
let frame;
new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(drawCharts); }).observe($('series-list'));
activatePreset('variation');
