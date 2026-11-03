'use strict';
// Static, original experimental arrays. No model execution or synthetic field generation.
const evidence = window.TURBULENCE_EVIDENCE;
const byId = id => document.getElementById(id);
const view = {sample:0, component:0, row:32, col:32, split:'test', sigma:2};
const components = ['u','v','w'];
const plates = ['targetPlate','meanPlate','errorPlate','sigmaPlate'];
const mix = (a,b,t) => a.map((v,i)=>Math.round(v+(b[i]-v)*t));
function colour(t,signed){
  t=Math.max(0,Math.min(1,t));
  if(signed)return t<.5?mix([35,66,75],[224,228,207],t*2):mix([224,228,207],[160,77,49],(t-.5)*2);
  return t<.5?mix([20,32,27],[101,139,112],t*2):mix([101,139,112],[237,217,161],(t-.5)*2);
}
function current(){return evidence.samples[view.sample].components[view.component]}
function bounds(a,b){return [Math.min(...a,...b),Math.max(...a,...b)]}
function paintPlate(id,data,min,max,signed){
  const canvas=byId(id),ctx=canvas.getContext('2d');
  const small=document.createElement('canvas');small.width=64;small.height=64;
  const sx=small.getContext('2d'),im=sx.createImageData(64,64);
  data.forEach((v,i)=>{const rgb=colour((v-min)/(max-min||1),signed);im.data.set([...rgb,255],i*4)});
  sx.putImageData(im,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(small,0,0,512,512);
  ctx.strokeStyle='#fff9';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,(view.row+.5)*8);ctx.lineTo(512,(view.row+.5)*8);ctx.moveTo((view.col+.5)*8,0);ctx.lineTo((view.col+.5)*8,512);ctx.stroke();
  ctx.strokeStyle='#17241b';ctx.lineWidth=2;ctx.strokeRect(view.col*8-3,view.row*8-3,14,14);
}
function profile(c){
  const start=view.row*64,y=c.targets.slice(start,start+64),mu=c.ensemble_mean.slice(start,start+64),sd=c.ensemble_std.slice(start,start+64);
  const low=mu.map((v,i)=>v-2*sd[i]),high=mu.map((v,i)=>v+2*sd[i]);
  const lo=Math.min(...y,...low),hi=Math.max(...y,...high),span=hi-lo||1;
  const X=i=>48+i/63*650,Y=v=>220-(v-lo)/span*180;
  const line=a=>a.map((v,i)=>(i?'L':'M')+X(i).toFixed(2)+' '+Y(v).toFixed(2)).join(' ');
  const band=high.map((v,i)=>X(i).toFixed(2)+','+Y(v).toFixed(2)).concat(low.map((v,i)=>X(i).toFixed(2)+','+Y(v).toFixed(2)).reverse()).join(' ');
  let grid='';for(let i=0;i<4;i++){const v=lo+span*i/3;grid+=`<line x1="48" x2="698" y1="${Y(v)}" y2="${Y(v)}" stroke="#779682" opacity=".25"/><text x="39" y="${Y(v)+4}" text-anchor="end" fill="#b6c8b9" font-size="10">${v.toFixed(2)}</text>`}
  byId('lineProfile').innerHTML=`<g font-family="monospace">${grid}<polygon points="${band}" fill="#9cb995" opacity=".23"/><path d="${line(y)}" stroke="#e8e9dd" fill="none" stroke-width="2"/><path d="${line(mu)}" stroke="#dda785" fill="none" stroke-width="2"/><line x1="${X(view.col)}" x2="${X(view.col)}" y1="30" y2="225" stroke="#cbd5bd" stroke-dasharray="3 4"/><text x="48" y="250" fill="#b6c8b9" font-size="10">0</text><text x="698" y="250" text-anchor="end" fill="#b6c8b9" font-size="10">63 / COLUMN INDEX</text></g>`;
}
function renderField(){
  const s=evidence.samples[view.sample],c=current(),err=c.targets.map((v,i)=>Math.abs(v-c.ensemble_mean[i]));
  const [min,max]=bounds(c.targets,c.ensemble_mean),emax=Math.max(...err),smax=Math.max(...c.ensemble_std);
  paintPlate('targetPlate',c.targets,min,max,true);paintPlate('meanPlate',c.ensemble_mean,min,max,true);paintPlate('errorPlate',err,0,emax,false);paintPlate('sigmaPlate',c.ensemble_std,0,smax,false);
  byId('fieldScale').textContent=`TARGET / MEAN: ${min.toFixed(3)} → ${max.toFixed(3)}`;
  byId('errorScale').textContent=`ERROR: 0 → ${emax.toFixed(3)}`;
  byId('sigmaScale').textContent=`SPREAD σ: 0 → ${smax.toFixed(3)}`;
  byId('rowOutput').value=view.row;byId('colOutput').value=view.col;
  byId('probeRow').value=view.row;byId('probeCol').value=view.col;
  const i=view.row*64+view.col;
  byId('probeValues').innerHTML=[['Target',c.targets[i]],['Mean',c.ensemble_mean[i]],['Absolute error',err[i]],['Spread σ',c.ensemble_std[i]]].map(([k,v])=>`<dt>${k}</dt><dd>${v.toFixed(4)}</dd>`).join('');
  byId('sliceLabel').textContent=`CENTRAL DEPTH PLANE / INDEX ${s.depth_index} OF ${s.shape[0]}`;
  const rmse=Math.sqrt(err.reduce((sum,x)=>sum+x*x,0)/err.length);
  byId('fieldCaption').textContent=`Original output / Test sample index ${s.index}, component ${components[view.component]}, depth index ${s.depth_index}. This displayed plane has RMSE ${rmse.toFixed(4)} in stored standardised coordinates. This is a plane statistic, separate from the full-volume aggregate below. Ensemble spread is uncalibrated. The stored input and target are identical for the checked first cube.`;
  document.querySelectorAll('[data-component]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.component)===view.component)));
  profile(c);
}
function renderReliability(){
  const result=evidence.recomputed[view.split],coverage=result.coverage[view.sigma-1]*100;
  byId('resultCoverage').innerHTML=coverage.toFixed(2)+'<span>%</span>';
  byId('resultBar').style.width=coverage+'%';
  byId('resultReading').textContent=`${view.split==='test'?'Test':'Validation'} / ±${view.sigma}σ covers ${coverage.toFixed(2)}% of ${result.n_values.toLocaleString('en-GB')} stored component values across ${result.n_cubes} cubes. The values are spatially correlated. This is an observed fraction, not an independent-sample confidence interval.`;
  document.querySelectorAll('[data-sigma]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.sigma)===view.sigma)));
}
byId('sampleSelect').addEventListener('change',e=>{view.sample=Number(e.target.value);renderField()});
document.querySelectorAll('[data-component]').forEach(b=>b.addEventListener('click',()=>{view.component=Number(b.dataset.component);renderField()}));
for(const [id,key] of [['probeRow','row'],['probeCol','col']])byId(id).addEventListener('input',e=>{view[key]=Number(e.target.value);renderField()});
for(const id of plates){
  const probe=e=>{const r=e.currentTarget.getBoundingClientRect();view.col=Math.max(0,Math.min(63,Math.floor((e.clientX-r.left)/r.width*64)));view.row=Math.max(0,Math.min(63,Math.floor((e.clientY-r.top)/r.height*64)));renderField()};
  byId(id).addEventListener('pointerdown',probe);byId(id).addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||e.buttons)probe(e)});
}
byId('resultSplit').addEventListener('change',e=>{view.split=e.target.value;renderReliability()});
document.querySelectorAll('[data-sigma]').forEach(b=>b.addEventListener('click',()=>{view.sigma=Number(b.dataset.sigma);renderReliability()}));
renderField();renderReliability();
