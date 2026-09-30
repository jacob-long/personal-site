import { seededRandom } from './engine.mjs?v=20260930-7';
import { makeUsagePopulation, drawUsageSample } from './means-engine.mjs?v=20260930-7';
import { SCALE_MAX } from './pipeline-engine.mjs?v=20260930-7';
import { moveDot, reducedMotion } from './motion.mjs?v=20260930-7';

const $ = id => document.getElementById(id);
const pop = makeUsagePopulation();
const random = seededRandom(crypto.getRandomValues(new Uint32Array(1))[0]);
const LIMIT = 200;
let n = 10, current = null, phase = 'empty', history = [];
let busy = false, stopRequested = false, arrival = null, transfer = null;
const minutes = x => x.toFixed(2);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function status(text) { $('mean-status').textContent = text; }

function controls() {
  const full = history.length >= LIMIT;
  $('mean-n').disabled = busy;
  $('mean-reset').disabled = busy;
  $('mean-draw').disabled = busy || full || !['empty','plotted'].includes(phase);
  $('mean-show').disabled = busy || phase !== 'drawn';
  $('mean-plot').disabled = busy || phase !== 'mean' || full;
  $('mean-ten').disabled = $('mean-fifty').disabled = busy || full || phase !== 'plotted';
  $('mean-stop').hidden = !busy;
  $('mean-stop').disabled = stopRequested;
  $('mean-stop').textContent = stopRequested ? 'Finishing this sample…' : 'Stop after this sample';
  $('repeat-note').textContent = full ? '200 sample averages plotted. Start over to run it again.'
    : history.length ? `${history.length} of 200 sample averages plotted.`
      : 'First, take one sample through all three steps.';
  // Highlight the next manual action, not three competing primary buttons.
  ['mean-draw','mean-show','mean-plot'].forEach(id => $(id).classList.toggle('primary', !$(id).disabled));
}

function render() {
  controls();
  $('mean-values').textContent = current
    ? `${current.values.map(x=>x.toFixed(1)).join(', ')} minutes. Total: ${current.sum.toFixed(1)} minutes across ${n} students.`
    : 'No sample drawn yet.';
  drawChart();
}

function drawChart() {
  const width = Math.max(240, $('mean-chart').getBoundingClientRect().width);
  const left = 23, right = 23, inner = width-left-right;
  const x = value => left + value/SCALE_MAX*inner;
  const ticks = width < 440 ? [0,120,240,360] : [0,60,120,180,240,300,360];
  const ticksAt = base => ticks.map(v => `<text class="mean-tick" x="${x(v)}" y="${base+18}" text-anchor="middle">${v}</text>`).join('');
  const grid = (top,base) => ticks.map(v=>`<line class="mean-grid" x1="${x(v)}" x2="${x(v)}" y1="${top}" y2="${base}"/>`).join('');
  const binSize = width < 440 ? 12 : 6;
  function points(values, base, height, maxRadius) {
    const bins = new Map();
    const locations = values.map(value => {
      const bin = Math.round(value/binSize)*binSize;
      const stack = (bins.get(bin) || 0)+1;
      bins.set(bin,stack);
      return {value, bin, stack};
    });
    const max = Math.max(1,...bins.values());
    const spacing = Math.min(maxRadius*2+2, height/(max+1));
    const radius = Math.max(1.6,Math.min(maxRadius,spacing/2-.5));
    return locations.map(p=>({...p, cx:x(p.bin), cy:base-p.stack*spacing, radius}));
  }
  const people = points(current?.values || [], 125, 66, 4.5);
  const averages = points(history.map(s=>s.mean), 425, 117, 4);
  const shown = phase === 'mean' || phase === 'plotted';
  const meanY = 168;
  const truth = $('mean-truth').checked;
  const truthMarks = truth ? [[57,125],[308,425]].map(([top,base])=>`<line class="mean-truth-line" x1="${x(pop.mean)}" x2="${x(pop.mean)}" y1="${top}" y2="${base}"/>`).join('') : '';
  const equation = shown ? `${current.sum.toFixed(1)} ÷ ${n} = ${minutes(current.mean)} min` : current ? 'Next: find their average.' : 'First: draw a sample.';
  const description = `${current ? `${n} individual daily social-media usage times in the current sample.${shown ? ` Their average is ${minutes(current.mean)} minutes per day.` : ' Their average is not revealed yet.'}` : 'No current sample.'} The bottom plot contains ${history.length} sample averages; each is computed from ${n} students. Both plots use a 0 to ${SCALE_MAX} minutes-per-day horizontal scale. Dots are stacked in ${binSize}-minute bins for display.${truth ? ` Population average ${minutes(pop.mean)} minutes per day.` : ''}`;
  $('mean-chart').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 506" width="${width}" height="506" role="img" aria-labelledby="mean-chart-title mean-chart-desc">
    <title id="mean-chart-title">Individual students and the averages of repeated samples</title><desc id="mean-chart-desc">${description}</desc>
    <text class="mean-panel-title" x="${left}" y="22">This sample${current ? `: ${n} students` : ''}</text>
    <text class="mean-subtitle" x="${left}" y="43">One teal dot = one student</text>
    ${grid(57,125)}<line class="mean-axis" x1="${left}" x2="${width-right}" y1="125" y2="125"/>
    ${people.map((p,i)=>`<circle class="person-dot" data-person="${i}" cx="${p.cx}" cy="${p.cy}" r="${p.radius}"><title>Student ${i+1}: ${p.value.toFixed(1)} minutes</title></circle>`).join('')}
    ${!current ? `<text class="mean-placeholder" x="${width/2}" y="95" text-anchor="middle">Draw students to see their times</text>` : ''}
    ${ticksAt(125)}
    ${shown ? `<circle class="current-mean" cx="${x(current.mean)}" cy="${meanY}" r="6"><title>Average of these ${n} students: ${minutes(current.mean)} minutes</title></circle>` : ''}
    <text class="mean-subtitle" x="${width/2}" y="189" text-anchor="middle">${shown ? 'Blue marker = their average (min/day)' : 'Social-media use (minutes per day)'}</text>
    <text class="mean-subtitle" x="${left}" y="215">${shown ? 'Total minutes ÷ students' : ''}</text>
    <text class="mean-equation" x="${left}" y="241" id="mean-equation">${equation}</text>
    <text class="mean-panel-title" x="${left}" y="277">Sample averages</text>
    <text class="mean-subtitle" x="${width-right}" y="277" text-anchor="end">${history.length} ${history.length === 1 ? 'dot' : 'dots'}</text>
    <text class="mean-subtitle" x="${left}" y="298">One blue dot = one sample of ${n} students</text>
    ${grid(308,425)}<line class="mean-axis" x1="${left}" x2="${width-right}" y1="425" y2="425"/>
    ${averages.map((p,i)=>`<circle class="mean-dot ${i === averages.length-1 ? 'latest' : ''}" data-mean="${i}" cx="${p.cx}" cy="${p.cy}" r="${p.radius}"><title>Sample ${i+1}: average ${minutes(p.value)} minutes from ${n} students</title></circle>`).join('')}
    ${!averages.length ? `<text class="mean-placeholder" x="${width/2}" y="373" text-anchor="middle">No averages plotted yet</text>` : ''}
    ${ticksAt(425)}${truthMarks}
    <text class="mean-subtitle" x="${width/2}" y="469" text-anchor="middle">Average social-media use (min/day)</text>
    ${truth ? `<text class="mean-tick" x="${width/2}" y="493" text-anchor="middle">Dashed line: population average ${minutes(pop.mean)} min</text>` : ''}
  </svg>`;
  if (arrival && current) {
    const elapsed = performance.now()-arrival.startedAt;
    $('mean-chart').querySelectorAll('.person-dot').forEach((node,i)=>moveDot(node, {
      dy: 54-people[i].cy, delay: arrival.stagger*i, duration:arrival.duration, elapsed
    }));
  }
  if (transfer && averages[transfer.index]) {
    const point = averages[transfer.index];
    moveDot($('mean-chart').querySelector(`[data-mean="${transfer.index}"]`), {
      dx: x(transfer.mean)-point.cx, dy: meanY-point.cy,
      duration:transfer.duration, elapsed:performance.now()-transfer.startedAt
    });
  }
}

function drawCurrent(fast = false) {
  current = drawUsageSample(pop,n,random);
  phase = 'drawn';
  arrival = { startedAt:performance.now(), duration:fast ? 120 : 340, stagger:fast ? 0 : Math.min(30,220/n) };
  render();
}
function showMean() { phase = 'mean'; render(); }
function plotMean(duration = 650) {
  history.push(current);
  phase = 'plotted';
  transfer = {index:history.length-1, mean:current.mean, startedAt:performance.now(), duration};
  render();
}
function reset() {
  current = null; phase = 'empty'; history = []; arrival = null; transfer = null;
  stopRequested = false;
  status(`Start by drawing ${n} students.`);
  render();
}

async function repeat(count) {
  if (busy || phase !== 'plotted' || history.length >= LIMIT) return;
  const amount = Math.min(count,LIMIT-history.length);
  busy = true; stopRequested = false; controls();
  status(`Repeating the same three steps for ${amount} new samples of ${n} students.`);
  let added = 0;
  try {
    if (reducedMotion()) {
      for (let i = 0; i < amount; i++) { current = drawUsageSample(pop,n,random); history.push(current); added++; }
      phase = 'plotted'; arrival = null; transfer = null;
    } else {
      const fast = count > 10;
      for (let i = 0; i < amount && !stopRequested; i++) {
        drawCurrent(true);
        await pause(fast ? 140 : 300);
        showMean();
        await pause(fast ? 100 : 220);
        plotMean(fast ? 220 : 400);
        await pause(fast ? 250 : 460);
        added++;
      }
    }
  } finally {
    busy = false; stopRequested = false;
    status(`Added ${added} sample averages. ${history.length} dots below represent ${history.length} separate samples of ${n} students—not ${history.length} individual students.`);
    render();
  }
}

$('mean-draw').addEventListener('click', () => { drawCurrent(); status(`${n} students, ${n} daily usage times. Now find their average.`); });
$('mean-show').addEventListener('click', () => { showMean(); status(`These ${n} observations give one average: ${minutes(current.mean)} minutes.`); });
$('mean-plot').addEventListener('click', () => {
  plotMean(); status(`One whole sample became one dot. The bottom plot now has ${history.length} ${history.length === 1 ? 'sample average' : 'sample averages'}.`);
});
$('mean-n').addEventListener('change', () => { n = Number($('mean-n').value); reset(); });
$('mean-reset').addEventListener('click', reset);
$('mean-truth').addEventListener('change', drawChart);
$('mean-ten').addEventListener('click', () => repeat(10));
$('mean-fifty').addEventListener('click', () => repeat(50));
$('mean-stop').addEventListener('click', () => { stopRequested = true; controls(); });
let frame;
new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(drawChart); }).observe($('mean-chart'));
render();
