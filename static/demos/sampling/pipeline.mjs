import { seededRandom } from './engine.mjs?v=20260930-7';
import { DEMOGRAPHICS, SCALE_MAX, MAX_SAMPLES, MAX_SETUPS, makePopulation, setup, signature, label, drawSample, sampleStatistic, populationStatistic } from './pipeline-engine.mjs?v=20260930-7';
import { moveDot, reducedMotion } from './motion.mjs?v=20260930-7';

const $=id=>document.getElementById(id), pop=makePopulation();
// Fresh sampling seed per page load, independent of the fixed demographic-population seed.
// Reset controls do not recreate or rewind this stream.
const rng=seededRandom(crypto.getRandomValues(new Uint32Array(1))[0]);
const colors=['#176d77','#3b64ae','#ac5623','#785493'];
const fmt=x=>x.toFixed(2), count=x=>x.toLocaleString();
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let series=[], nextId=1, current=null, learned=false, busy=false, stopping=false;
let arrival=null, transfers=[];
let viewVariable='minutes';
const selectedCategories={classYear:0,gender:0};
const categoryNames={classYear:['First-years','Sophomores','Juniors','Seniors'],gender:['Women','Men','Nonbinary']};
const categorical=()=>viewVariable!=='minutes';
const category=()=>selectedCategories[viewVariable]??0;
const categoryName=()=>categoryNames[viewVariable]?.[category()]||'';
const stat=s=>sampleStatistic(s,viewVariable,category());
const truthValue=()=>populationStatistic(pop,viewVariable,category());
const scaleMax=()=>categorical()?100:SCALE_MAX;
const statWord=()=>categorical()?'percentage':'mean';
const valueText=v=>categorical()?`${Number(v.toFixed(1))}%`:`${fmt(v)} min`;
const axisTitle=()=>categorical()?`${categoryName()} (%)`:'Sample average (min/day)';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pending=()=>current && ['drawn','mean'].includes(current.phase);
const compact=()=>document.body.classList.contains('classroom') && innerWidth>760;
const selectedSetup=()=>setup({n:$('pipeline-n').value,method:$('pipeline-method').value});
const matching=s=>series.find(row=>signature(row.setup)===signature(s));
// New setups belong nearest the current sample.
// Keep creation order separate from batch order; inspecting an older row must not move it.
const displaySeries=()=>[...series].sort((a,b)=>b.id-a.id);
function status(text) { $('pipeline-status').textContent=text; }
function setControls(s) { $('pipeline-n').value=s.n; $('pipeline-method').value=s.method; }
function createSeries(s) {
  const used=new Set(series.map(row=>row.color));
  return {id:nextId++,setup:setup(s),color:colors.find(c=>!used.has(c))||colors[0],samples:[]};
}
function ensureSeries(s) {
  let row=matching(s);
  if(!row) {
    if(series.length>=MAX_SETUPS) return null;
    row=createSeries(s); series.push(row);
  }
  return row;
}

function controls() {
  const s=selectedSetup(), row=matching(s), draft=pending();
  const room=row ? row.samples.length<MAX_SAMPLES : series.length<MAX_SETUPS;
  $('pipeline-n').disabled=$('pipeline-method').disabled=busy||!!draft;
  $('sample-draw').disabled=busy||!!draft||!room;
  $('sample-mean').disabled=busy||current?.phase!=='drawn';
  $('sample-save').disabled=busy||current?.phase!=='mean';
  $('repeat-ten').disabled=$('repeat-fifty').disabled=busy||!!draft||!learned||!room;
  $('repeat-all').disabled=busy||!!draft||!learned||series.every(r=>r.samples.length>=MAX_SAMPLES);
  $('repeat-all').textContent=series.length>1 ? '50 per setup' : '50 samples';
  $('repeat-all').hidden=series.length<2;
  $('reset').disabled=$('classroom').disabled=$('pace').disabled=$('population-line').disabled=busy;
  $('display-variable').disabled=$('display-category').disabled=busy;
  $('category-field').hidden=!categorical();
  $('summary-action').textContent=categorical()?'Find the percentage':'Find their average';
  $('plot-action').textContent=categorical()?'Add one percentage below':'Add one mean below';
  $('truth-label').textContent=categorical()?'Show the population percentage':'Show the population average';
  $('distribution-title').textContent=`One dot = one whole sample’s ${statWord()}`;
  $('pipeline-path').textContent=`Individual observations → sample → sample ${statWord()}`;
  $('research-question').textContent=categorical()?`What percentage of students are ${categoryName().toLowerCase()}?`:'How much time do students spend on social media each day?';
  $('variable-description').textContent=`10,000 hypothetical students · ${categorical()?'one category’s percentage':'minutes per day'}`;
  $('clear').disabled=busy||!series.some(r=>r.samples.length)&&!current;
  document.querySelectorAll('.setup-select,.sample-picker,.remove').forEach(el=>{
    el.disabled=busy||!!draft||(el.classList.contains('sample-picker')&&Number(el.dataset.length)===0)||(el.classList.contains('remove')&&series.length===1);
  });
  document.querySelectorAll('.setup-select').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.id)===row?.id)));
  ['sample-draw','sample-mean','sample-save'].forEach(id=>$(id).classList.toggle('primary',!$(id).disabled));
  $('stop').hidden=!busy; $('stop').disabled=stopping;
  $('stop').textContent=stopping ? 'Finishing this sample…' : 'Stop after this sample';
  $('method-help').textContent=s.method==='random' ? 'Every student has the same chance of being selected.' : 'In this scenario, recruitment on social media overrepresents heavier users.';
  $('setup-help').textContent=draft ? 'Finish this sample before changing the setup.'
    : !room ? row ? 'This setup has 200 samples. Clear the plotted samples to run it again.' : 'Four setups are shown. Remove one to add another.'
      : row ? 'New samples join this setup; other comparisons stay.' : 'The next sample adds a new comparison.';
  $('repeat-help').textContent=learned ? `Each repetition draws the students, finds their ${categorical()?'percentage':'average'}, and adds one dot.` : 'First, take one sample through all three steps.';
  $('population-value').hidden=!$('population-line').checked;
  $('population-value').innerHTML=`Population ${categorical()?'percentage':'average'}<strong>${valueText(truthValue())}</strong>`;
}

function geometry(container,base,plotHeight,maxRadius,values) {
  const width=Math.max(240,container.getBoundingClientRect().width), left=24, right=24;
  const x=v=>left+v/scaleMax()*(width-left-right);
  const binWidth=categorical()?(width<430?4:width<650?2:1):(width<430?12:width<650?6:3);
  const bins=new Map();
  const dots=values.map((value,index)=>{
    const bin=Math.round(value/binWidth)*binWidth, stack=(bins.get(bin)||0)+1;
    bins.set(bin,stack); return {value,index,bin,stack};
  });
  const max=Math.max(1,...bins.values()), spacing=Math.min(maxRadius*2+1.5,plotHeight/(max+1));
  const radius=Math.max(1.3,Math.min(maxRadius,spacing/2-.4));
  dots.forEach(p=>{p.cx=x(p.bin);p.cy=base-p.stack*spacing;p.r=radius;});
  const ticks=categorical()?(width<430?[0,25,50,75,100]:[0,20,40,60,80,100]):(width<430?[0,120,240,360]:[0,60,120,180,240,300,360]);
  return {width,left,right,x,binWidth,dots,ticks};
}
function axes(g,top,base,titleY,title) {
  return g.ticks.map(v=>`<line class="plot-grid" x1="${g.x(v)}" x2="${g.x(v)}" y1="${top}" y2="${base}"/><text x="${g.x(v)}" y="${base+16}" text-anchor="middle">${v}</text>`).join('')+
    `<line class="plot-axis" x1="${g.left}" x2="${g.width-g.right}" y1="${base}" y2="${base}"/><text x="${g.width/2}" y="${titleY}" text-anchor="middle">${title}</text>`;
}
function observationMetrics() {
  if(categorical())return compact()?{base:47,height:103,meanY:64,plotHeight:30}:{base:80,height:157,meanY:116,plotHeight:60};
  return compact() ? {base:58,height:117,meanY:85,plotHeight:40} : {base:84,height:159,meanY:123,plotHeight:60};
}

function renderCurrent() {
  const c=current, s=c?.sample, shown=c && c.phase!=='drawn';
  $('sample-context').textContent=c ? `${label(c.row.setup)} · individual observations` : 'Individual observations';
  $('sample-title').textContent=c ? `Sample ${c.index+1} · ${count(s.n)} students` : 'One sample, many students';
  $('sample-state').textContent=!c ? 'No sample yet' : c.phase==='drawn' ? (categorical()?'Not yet summarized':'Not yet averaged') : c.phase==='mean' ? 'Ready to plot' : c.reviewing ? 'Inspecting a saved sample' : `One plotted ${statWord()}`;
  $('calculation-label').textContent=shown ? (categorical()?`${categoryName()} ÷ all students`:'Total minutes ÷ students') : c ? (categorical()?'Next: find the percentage':'Next: find their average') : 'Next: draw the students';
  $('calculation').textContent=shown ? (categorical()?`${s.demographics[viewVariable].counts[category()]} ÷ ${count(s.n)} × 100 = ${valueText(stat(s))}`:`${s.total.toFixed(1)} ÷ ${count(s.n)} = ${fmt(s.mean)} min`) : '';
  drawObservations();
  renderCampus();
  if($('sample-details').open) renderDetails();
}
function drawObservations() {
  const m=observationMetrics(), c=current, s=c?.sample, shown=c && c.phase!=='drawn';
  const g=geometry($('observations'),m.base,m.plotHeight,4,categorical()?[]:s?.values||[]);
  $('observation-key').hidden=!categorical();
  $('observation-key').innerHTML=categorical()?`<span><i class="key-selected" aria-hidden="true"></i>${categoryName()}</span><span><i class="key-other" aria-hidden="true"></i>${viewVariable==='classYear'?'Other years':'Other genders'}</span><span>One dot = one student</span>`:'';
  if(categorical()&&s) {
    const width=g.width-g.left-g.right, height=m.plotHeight;
    const columns=Math.max(1,Math.min(s.n,Math.ceil(Math.sqrt(s.n*width/height))));
    const rows=Math.ceil(s.n/columns), gap=Math.min(12,width/columns,height/rows);
    const start=g.width/2-(columns-1)*gap/2;
    g.dots=s.indices.map((_,i)=>({index:i,cx:start+(i%columns)*gap,cy:17+(Math.floor(i/columns)+.5)*gap,r:Math.min(4,Math.max(.8,gap*.32))}));
  }
  $('observations').style.setProperty('--series',c?.row.color||colors[0]);
  const description=categorical()?`${s?`${s.n} students. ${s.demographics[viewVariable].counts[category()]} are ${categoryName().toLowerCase()}.`: 'No sample drawn yet.'} Filled dots mark the selected category; hollow dots mark everyone else. Dot positions only arrange students, not a numeric scale.${shown?` Their sample percentage is ${valueText(stat(s))}.`:''}`
    :`${s ? `${s.n} individual observations. One small dot is one student.${shown ? ` Their mean is ${fmt(s.mean)} minutes.` : ' Their mean has not been revealed.'}` : 'No sample drawn yet.'} Positions are binned to ${g.binWidth} minutes for display.`;
  const chartAxes=categorical()?(shown?axes(g,m.meanY,m.meanY,m.height-5,'Outlined dot = sample percentage (%)'):'')
    :axes(g,18,m.base,m.height-5,shown ? 'Outlined dot = sample average (min/day)' : 'One small dot = one student’s use (min/day)');
  $('observations').innerHTML=`<svg id="observation-svg" xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${m.height}" viewBox="0 0 ${g.width} ${m.height}" role="img" aria-labelledby="obs-title obs-desc">
    <title id="obs-title">Individual students in the selected sample</title><desc id="obs-desc">${description}</desc>
    ${chartAxes}
    ${g.dots.map(p=>`<circle class="observation ${categorical()?(s.demographics[viewVariable].values[p.index]===category()?'category-selected':'category-other'):''}" data-student="${s.indices[p.index]+1}" cx="${p.cx}" cy="${p.cy}" r="${p.r}"><title>Student ${s.indices[p.index]+1}: ${s.values[p.index].toFixed(1)} min · ${DEMOGRAPHICS.map(f=>f.categories[s.demographics[f.key].values[p.index]]).join(' · ')}</title></circle>`).join('')}
    ${!s ? `<text x="${g.width/2}" y="${m.base-20}" text-anchor="middle">Draw a sample to see its students</text>` : ''}
    ${shown ? `<circle class="mean-source" data-value="${stat(s)}" cx="${g.x(stat(s))}" cy="${m.meanY}" r="5.5"><title>Sample ${statWord()} from ${s.n} students: ${valueText(stat(s))}</title></circle>` : ''}
  </svg>`;
  if(arrival && s) {
    const elapsed=performance.now()-arrival.start;
    $('observations').querySelectorAll('.observation').forEach((node,i)=>moveDot(node,{dy:12-g.dots[i].cy,delay:i*arrival.stagger,duration:arrival.duration,elapsed}));
  }
}
function demographicTables(sample,withCounts=false) {
  const percent=x=>`${Number((100*x).toFixed(1))}%`;
  return DEMOGRAPHICS.map(field=>{
    const campus=pop.demographics[field.key], selected=sample?.demographics[field.key];
    return `<table class="demographic-table" data-demographic="${field.key}"><caption>${field.label}</caption><thead><tr><th scope="col"><span class="sr-only">${field.label}</span></th><th scope="col">Campus</th><th scope="col">Sample</th></tr></thead><tbody>${field.categories.map((name,i)=>
      `<tr><th scope="row">${name}</th><td>${percent(campus.shares[i])}</td><td class="demographic-sample">${selected?percent(selected.shares[i]):'—'}${selected&&withCounts?`<span class="demographic-count">${selected.counts[i]} of ${count(sample.n)}</span>`:''}</td></tr>`).join('')}</tbody></table>`;
  }).join('');
}
function renderCampus() {
  $('campus-sample-context').textContent=current ? `Sample ${current.index+1} · ${count(current.sample.n)} students · ${label(current.row.setup)}` : 'Draw a sample to compare it with the campus.';
  $('campus-demographics').innerHTML=demographicTables(current?.sample);
}
function renderDetails() {
  const s=current?.sample;
  if(!s) { $('sample-mix').innerHTML='';$('sample-records').innerHTML='';$('sample-record-label').textContent='No sample selected.';return; }
  $('sample-mix').innerHTML=demographicTables(s,true);
  $('sample-record-label').textContent=`${count(s.n)} stored observations from Sample ${current.index+1}. These are the students behind its ${statWord()}.`;
  $('sample-records').innerHTML=s.values.map((v,i)=>`<tr><td>${String(s.indices[i]+1).padStart(5,'0')}</td>${DEMOGRAPHICS.map(f=>`<td>${f.categories[s.demographics[f.key].values[i]]}</td>`).join('')}<td>${v.toFixed(1)}</td></tr>`).join('');
}

function renderRows() {
  const focused=document.activeElement;
  const focusSelector=focused?.classList.contains('sample-picker')?`.sample-picker[data-row="${focused.dataset.row}"]`
    : focused?.classList.contains('setup-select')?`.setup-select[data-id="${focused.dataset.id}"]`:null;
  $('distributions').innerHTML=displaySeries().map(row=>{
    const viewed=current?.row===row && current.phase==='saved' ? current.index : null;
    const latest=row.samples.at(-1);
    return `<section class="pipeline-series" data-row="${row.id}" style="--series:${row.color}">
      <div class="pipeline-series-heading"><div><button class="setup-select" data-id="${row.id}" aria-pressed="false"><i aria-hidden="true"></i>${escape(label(row.setup))} · n = ${count(row.setup.n)}</button>
      <p class="setup-count">${row.samples.length} ${row.samples.length===1?'dot = 1 sample':'dots = '+row.samples.length+' samples'} of ${count(row.setup.n)} students</p></div>
      <div class="series-actions"><select class="sample-picker" data-row="${row.id}" data-length="${row.samples.length}" aria-label="Inspect sample: ${escape(label(row.setup))}, ${row.setup.n} students">
      <option value="" ${viewed===null?'selected':''}>Inspect sample…</option>${row.samples.map((s,i)=>`<option value="${i}" ${viewed===i?'selected':''}>Sample ${i+1} · ${valueText(stat(s))}</option>`).join('')}</select><button class="remove" data-remove="${row.id}" aria-label="Remove ${escape(label(row.setup))}, ${row.setup.n} students">Remove</button></div></div>
      <div class="pipeline-plot means-plot" id="plot-${row.id}"></div><p class="distribution-caption">${viewed!==null ? `Viewing Sample ${viewed+1}: <strong>${valueText(stat(row.samples[viewed]))}</strong>` : latest ? `Latest sample ${statWord()}: <strong>${valueText(stat(latest))}</strong>` : `No sample ${statWord()}s plotted yet.`}</p></section>`;
  }).join('');
  document.querySelectorAll('.sample-picker').forEach(el=>el.addEventListener('change',()=>{
    if(el.value!=='') inspect(Number(el.dataset.row),Number(el.value));
  }));
  document.querySelectorAll('.setup-select').forEach(el=>el.addEventListener('click',()=>{
    if(busy||pending())return;
    const row=series.find(r=>r.id===Number(el.dataset.id));
    if(row.samples.length) inspect(row.id,row.samples.length-1);
    else {setControls(row.setup);current=null;arrival=null;transfers=[];render();status(`Ready for a sample of ${count(row.setup.n)} students: ${label(row.setup).toLowerCase()}.`);}
  }));
  document.querySelectorAll('.remove').forEach(el=>el.addEventListener('click',()=>{
    if(busy||pending()||series.length===1)return;
    const id=Number(el.dataset.remove);series=series.filter(r=>r.id!==id);
    if(current?.row.id===id)current=null;
    setControls(displaySeries()[0].setup);arrival=null;transfers=[];
    render();$('sample-draw').focus();status('Setup removed. The other samples are unchanged.');
  }));
  drawDistributions();controls();
  if(focusSelector)document.querySelector(focusSelector)?.focus();
}
function drawDistributions() {
  transfers=transfers.filter(t=>performance.now()-t.start<t.duration);
  for(const row of series) {
    const el=$(`plot-${row.id}`);if(!el)continue;
    const small=compact(), base=small?49:99, height=small?85:138;
    const g=geometry(el,base,small?39:87,3.6,row.samples.map(stat));
    const selected=current?.row===row && current.phase==='saved'?current.index:-1;
    const truth=$('population-line').checked ? `<line class="population-mark" x1="${g.x(truthValue())}" x2="${g.x(truthValue())}" y1="8" y2="${base}"/>` : '';
    el.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${height}" viewBox="0 0 ${g.width} ${height}" role="img" aria-labelledby="title-${row.id} desc-${row.id}"><title id="title-${row.id}">${escape(label(row.setup))}: sample ${statWord()}s from ${row.setup.n} students${categorical()?` · ${categoryName()}`:''}</title><desc id="desc-${row.id}">${row.samples.length} ${statWord()}s. Each point is a complete sample of ${row.setup.n} students, not one student. Use the Inspect sample menu for a keyboard-accessible selection. Display bins are ${g.binWidth} ${categorical()?'percentage points':'minutes'} wide.</desc>
      ${axes(g,8,base,height-5,axisTitle())}${truth}
      ${g.dots.map(p=>`<circle class="sample-mean ${selected===p.index?'selected':''}" data-index="${p.index}" data-value="${p.value}" cx="${p.cx}" cy="${p.cy}" r="${selected===p.index?Math.max(3,p.r):p.r}"><title>Sample ${p.index+1}: ${valueText(p.value)}${categorical()?` ${categoryName().toLowerCase()}`:''}; ${row.setup.n} students</title></circle>`).join('')}
      ${!g.dots.length ? `<text x="${g.width/2}" y="${base-14}" text-anchor="middle">One sample will become one dot</text>` : ''}
      <rect class="plot-hit" x="${g.left-15}" y="0" width="${g.width-g.left-g.right+30}" height="${base+8}" aria-hidden="true"/>
    </svg>`;
    el.querySelector('.plot-hit').addEventListener('click',event=>{
      if(busy||pending()||!g.dots.length)return;
      const rect=el.querySelector('svg').getBoundingClientRect();
      const px=event.clientX-rect.left,py=event.clientY-rect.top;
      const nearest=g.dots.reduce((best,p)=>Math.hypot(p.cx-px,p.cy-py)<Math.hypot(best.cx-px,best.cy-py)?p:best);
      if(Math.hypot(nearest.cx-px,nearest.cy-py)<35)inspect(row.id,nearest.index);
    });
    for(const transfer of transfers.filter(t=>t.rowId===row.id)) {
      const node=el.querySelector(`[data-index="${transfer.index}"]`);if(!node)continue;
      const source=$('observation-svg').getBoundingClientRect(), target=node.getBoundingClientRect();
      const sourceX=source.left+24+transfer.value/scaleMax()*(source.width-48);
      moveDot(node,{dx:sourceX-(target.left+target.width/2),dy:source.top+observationMetrics().meanY-(target.top+target.height/2),duration:transfer.duration,elapsed:performance.now()-transfer.start});
    }
  }
}
function render() { controls();renderCurrent();renderRows(); }
function inspect(rowId,index) {
  if(busy||pending())return;
  const row=series.find(r=>r.id===rowId), sample=row?.samples[index];if(!sample)return;
  current={row,index,sample,phase:'saved',reviewing:true};arrival=null;transfers=[];
  setControls(row.setup);render();
  status(`This dot is Sample ${index+1}: ${count(sample.n)} students, ${categorical()?`${valueText(stat(sample))} ${categoryName().toLowerCase()}`:`averaging ${valueText(stat(sample))}`}. Their original observations are shown above.`);
}
function begin(row,fast=false) {
  current={row,index:row.samples.length,sample:drawSample(pop,row.setup,rng),phase:'drawn',reviewing:false};
  arrival={start:performance.now(),duration:fast?60:320,stagger:fast?0:Math.min(25,150/current.sample.n)};
  setControls(row.setup);controls();renderCurrent();
}
function reveal() { current.phase='mean';controls();renderCurrent(); }
function save(duration=600) {
  if(!current||current.phase!=='mean')return;
  const c=current;c.row.samples.push(c.sample);c.phase='saved';learned=true;
  transfers.push({rowId:c.row.id,index:c.index,value:stat(c.sample),start:performance.now(),duration});
  renderCurrent();renderRows();controls();
}
function startOver() {
  if(busy)return;
  series=[];current=null;arrival=null;transfers=[];learned=false;
  viewVariable='minutes';selectedCategories.classYear=selectedCategories.gender=0;
  $('display-variable').value='minutes';$('display-category').innerHTML='';
  series.push(createSeries({n:10,method:'random'}));setControls(series[0].setup);
  $('population-line').checked=true;$('sample-details').open=false;
  render();status('Start by drawing one sample of 10 students.');
}
async function repeat(amount,all=false) {
  if(busy||pending()||!learned)return;
  const row=all?null:ensureSeries(selectedSetup());
  const targets=(all?series:row?[row]:[]).filter(r=>r.samples.length<MAX_SAMPLES);
  if(!targets.length)return;
  const limit=targets.reduce((sum,r)=>sum+Math.min(amount,MAX_SAMPLES-r.samples.length),0);
  busy=true;stopping=false;renderRows();controls();
  const pace={teaching:[320,220,420,60],quick:[100,90,190,15],fast:[20,20,100,0]}[$('pace').value];
  let added=0, failure=null;
  status(`Repeating the whole process: up to ${limit} new samples. Each produces one ${statWord()}.`);
  try {
    for(const target of targets) {
      if(stopping)break;
      const number=Math.min(amount,MAX_SAMPLES-target.samples.length);
      if(reducedMotion()) {
        for(let i=0;i<number;i++) {
          const sample=drawSample(pop,target.setup,rng);target.samples.push(sample);added++;
          current={row:target,index:target.samples.length-1,sample,phase:'saved',reviewing:false};
        }
        continue;
      }
      for(let i=0;i<number&&!stopping;i++) {
        begin(target,true);await pause(pace[0]);reveal();await pause(pace[1]);
        save(pace[2]);await pause(Math.max(20,pace[2]-30)+pace[3]);added++;
      }
    }
  } catch(error) { failure=error.message; }
  finally {
    busy=false;stopping=false;arrival=null;
    if(current)setControls(current.row.setup);render();
    status(failure ? `Sampling stopped: ${failure}` : `Added ${added} sample ${statWord()}s. Each plotted dot still stands for an entire sample. Select any dot to see its students again.`);
  }
}

$('sample-draw').addEventListener('click',()=>{
  if(busy||pending())return;const row=ensureSeries(selectedSetup());if(!row||row.samples.length>=MAX_SAMPLES)return;
  begin(row);renderRows();status(`Sample ${current.index+1} contains ${count(current.sample.n)} students. Each small dot above is one observation.`);
});
$('sample-mean').addEventListener('click',()=>{if(!busy&&current?.phase==='drawn'){reveal();status(`${count(current.sample.n)} observations give one ${statWord()}: ${valueText(stat(current.sample))}${categorical()?` ${categoryName().toLowerCase()}`:''}.`);}});
$('sample-save').addEventListener('click',()=>{if(!busy&&current?.phase==='mean'){save();status(`Sample ${current.index+1} became one plotted ${statWord()}. Its ${count(current.sample.n)} individual students remain visible above.`);}});
['pipeline-n','pipeline-method'].forEach(id=>$(id).addEventListener('change',()=>{controls();status('The next sample will use these settings. Existing samples are unchanged.');}));
function changeView() {
  arrival=null;transfers=[];render();
  status(`Now showing ${categorical()?`the percentage of ${categoryName().toLowerCase()}`:'average social-media minutes'}. The students and saved samples have not changed.`);
}
$('display-variable').addEventListener('change',()=>{
  if(busy)return;viewVariable=$('display-variable').value;
  $('display-category').innerHTML=categorical()?categoryNames[viewVariable].map((name,i)=>`<option value="${i}">${name}</option>`).join(''):'';
  if(categorical())$('display-category').value=category();
  changeView();
});
$('display-category').addEventListener('change',()=>{if(!busy&&categorical()){selectedCategories[viewVariable]=Number($('display-category').value);changeView();}});
$('repeat-ten').addEventListener('click',()=>repeat(10));$('repeat-fifty').addEventListener('click',()=>repeat(50));$('repeat-all').addEventListener('click',()=>repeat(50,true));
$('stop').addEventListener('click',()=>{stopping=true;controls();});
$('clear').addEventListener('click',()=>{
  if(busy)return;series.forEach(r=>r.samples=[]);current=null;arrival=null;transfers=[];render();status('All plotted samples cleared. The population and setups are unchanged.');
});
$('reset').addEventListener('click',startOver);
$('population-line').addEventListener('change',()=>{controls();drawDistributions();});
$('sample-details').addEventListener('toggle',()=>{if($('sample-details').open)renderDetails();});
$('campus-details').addEventListener('toggle',()=>{if($('campus-details').open)renderCampus();});
$('classroom').addEventListener('click',()=>{
  const on=document.body.classList.toggle('classroom');$('classroom').textContent=on?'Exit classroom view':'Classroom view';$('classroom').setAttribute('aria-pressed',String(on));
  requestAnimationFrame(()=>{drawObservations();drawDistributions();});
});
let frame;
new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{drawObservations();drawDistributions();});}).observe(document.querySelector('.pipeline-workspace'));
startOver();
