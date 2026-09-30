import { allocate, seededRandom } from './engine.mjs?v=20260930-7';
export const GROUPS = ['Lower use', 'Moderate use', 'Higher use'];
export const SCALE_MAX = 360;
export const SHARES = [.4,.4,.2];
export const CONVENIENCE = [.05,.25,.7];
// Invented campus characteristics, not estimates of real students. The class-year
// association makes this selection bias visible; gender can match despite outcome bias.
export const DEMOGRAPHICS = [
  {key:'classYear', label:'Class year', categories:['First-year','Sophomore','Junior','Senior'],
    withinUsage:[[.15,.20,.30,.35],[.30,.30,.225,.175],[.60,.30,.05,.05]]},
  {key:'gender', label:'Gender', categories:['Woman','Man','Nonbinary'],
    withinUsage:[[.55,.42,.03],[.55,.42,.03],[.55,.42,.03]]}
];
export const MAX_SAMPLES = 200;
export const MAX_SETUPS = 4;
export function makePopulation() {
  // Fictional daily social-media minutes: lower (0–60), moderate (60–180), higher (180–360).
  const sizes = [4000,4000,2000], shapes = [[0,30,60],[60,90,180],[180,240,360]];
  const values = [], groups = [], members = [];
  for (let g=0;g<3;g++) {
    const [a,c,b] = shapes[g], ids = [];
    for (let i=0;i<sizes[g];i++) {
      const u=(i+.5)/sizes[g];
      const raw=u<(c-a)/(b-a) ? a+Math.sqrt(u*(b-a)*(c-a)) : b-Math.sqrt((1-u)*(b-a)*(b-c));
      ids.push(values.length); groups.push(g); values.push(Math.round(raw*10)/10);
    }
    members.push(ids);
  }
  const summary = xs => {
    const mean=xs.reduce((s,v)=>s+v,0)/xs.length;
    return {mean,variance:xs.reduce((s,v)=>s+(v-mean)**2,0)/(xs.length-1)};
  };
  // Assign once, separately from the sampling RNG. Shuffle within usage groups so
  // demographic labels do not simply track the sorted individual minute values.
  const demographicRandom=seededRandom(3322026), demographics={};
  for(const field of DEMOGRAPHICS) {
    const labels=Array(values.length), counts=field.categories.map(()=>0);
    members.forEach((ids,g)=>{
      const assignments=allocate(field.withinUsage[g],ids.length).flatMap((n,k)=>Array(n).fill(k));
      for(let i=assignments.length-1;i>0;i--) {
        const j=Math.floor(demographicRandom()*(i+1));
        [assignments[i],assignments[j]]=[assignments[j],assignments[i]];
      }
      ids.forEach((id,i)=>{labels[id]=assignments[i];counts[assignments[i]]++;});
    });
    demographics[field.key]={values:labels,counts,shares:counts.map(n=>n/values.length)};
  }
  return {values,groups,members,sizes,size:values.length,shares:SHARES,
    demographics,...summary(values), groupStats:members.map(ids=>summary(ids.map(i=>values[i])))};
}
export function setup(settings) {
  const n=Number(settings.n), method=settings.method;
  if(!Number.isInteger(n)||n<5||n>1000||!['random','convenience'].includes(method)) throw new Error('Choose 5–1,000 students and a listed sampling method.');
  return {n,method};
}
export function signature(s) { const v=setup(s); return `${v.method}:${v.n}`; }
export function label(s) { return s.method==='random' ? 'Random sample' : 'Social-media recruitment'; }
function pick(size,n,random) {
  const swaps=new Map(), ids=[];
  for(let i=0;i<n;i++) {
    const j=i+Math.floor(random()*(size-i));
    ids.push(swaps.get(j)??j);
    swaps.set(j,swaps.get(i)??i);
  }
  return ids;
}
export function drawSample(pop,settings,random=Math.random) {
  const s=setup(settings);
  const indices=s.method==='random' ? pick(pop.size,s.n,random)
    : allocate(CONVENIENCE,s.n).flatMap((n,g)=>pick(pop.sizes[g],n,random).map(i=>pop.members[g][i]));
  const values=indices.map(i=>pop.values[i]), groups=indices.map(i=>pop.groups[i]);
  const counts=GROUPS.map((_,g)=>groups.filter(v=>v===g).length);
  const total=values.reduce((sum,v)=>sum+Math.round(v*10),0)/10;
  const demographics={};
  for(const field of DEMOGRAPHICS) {
    const labels=indices.map(i=>pop.demographics[field.key].values[i]), counts=field.categories.map(()=>0);
    labels.forEach(k=>counts[k]++);
    demographics[field.key]={values:labels,counts,shares:counts.map(n=>n/s.n)};
  }
  return {n:s.n,indices,values,groups,counts,demographics,total,mean:total/s.n};
}
export function expectedMean(pop,settings) {
  const s=setup(settings);
  return s.method==='random' ? pop.mean
    : allocate(CONVENIENCE,s.n).reduce((sum,count,g)=>sum+count/s.n*pop.groupStats[g].mean,0);
}
export function theoreticalVariance(pop,settings) {
  const s=setup(settings);
  if(s.method==='random') return (1-s.n/pop.size)*pop.variance/s.n;
  return allocate(CONVENIENCE,s.n).reduce((sum,count,g)=>count===0 ? sum : sum+
    (count/s.n)**2*(1-count/pop.sizes[g])*pop.groupStats[g].variance/count,0);
}

// Re-express a saved sample; changing the displayed variable never resamples students.
function demographicField(variable,category) {
  const field=DEMOGRAPHICS.find(f=>f.key===variable);
  if(!field||!Number.isInteger(category)||category<0||category>=field.categories.length)
    throw new Error('Choose a listed variable and category.');
  return field;
}
export function sampleStatistic(sample,variable='minutes',category=0) {
  if(variable==='minutes')return sample.mean;
  demographicField(variable,category);
  return 100*sample.demographics[variable].counts[category]/sample.n;
}
export function populationStatistic(pop,variable='minutes',category=0) {
  if(variable==='minutes')return pop.mean;
  demographicField(variable,category);
  return 100*pop.demographics[variable].counts[category]/pop.size;
}
