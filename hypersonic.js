import {machFromArea,staticState,nozzleReference,hotNozzle,mslApproximation,nearestVisible} from './plume-math.js';
import {initialiseDepth} from './hypersonic-depth.js';

const $ = id => document.getElementById(id);
const FIGURES = 'research/hypersonic/figures/';
const SOURCE = 'research/hypersonic/source/';
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = (value, digits=2) => new Intl.NumberFormat('en-GB',{maximumFractionDigits:digits,minimumFractionDigits:digits}).format(value);
const clamp = (value,lo,hi) => Math.min(hi,Math.max(lo,value));
const parameters = new URLSearchParams(location.search);
const state = {case:['mccabe','mdtn','msl'].includes(parameters.get('case'))?parameters.get('case'):'mccabe',injector:['off','normal','canted'].includes(parameters.get('injector'))?parameters.get('injector'):'off',profile:parameters.get('profile')==='radial'?'radial':'axial',probe:12,radius:.06,mesh:'msl',meshSize:20,feature:'expansion',position:.75,gamma:1.4,scale:1,totalTemperature:300,totalPressure:5,cut:false,camera:{yaw:-.58,pitch:.42,zoom:1}};
let data,depth;
const cases = {
  mccabe:{label:'A / McCABE GEOMETRY',title:'A baseline with a known profile.',description:'The original 500-point contour reconstructs the published boundary-layer-corrected nozzle. The design target is Mach 5-class; a circular-area isentropic calculation gives approximately 4.84.',conditions:[['Geometry source','500-point CSV'],['Flow medium','Nitrogen reference'],['Reported atmosphere','600 Pa / 300 K'],['Baseline closure','Spalart–Allmaras']],scale:1,totalTemperature:300,totalPressure:5,gasConstant:296.8,source:'nozzle_profile.csv',caption:'Surface of revolution from the original 500-point CSV. Geometry only; no simulated volume is invented.'},
  mdtn:{label:'B / HOT MDTN GEOMETRY',title:'A hotter, higher-expansion case.',description:'The contour is rebuilt from the original MATLAB generator. Its linear convergence and parabolic divergence define an ideal reference. The script’s length and some reported dimensions differ; this view follows the script.',conditions:[['Geometry source','Original MATLAB generator'],['Reported atmosphere','699 Pa / 210 K'],['Chamber temperature','3,300 K'],['Closure','k–ω SST']],scale:.25,totalTemperature:3300,totalPressure:20.265,gasConstant:287,source:'Nozzle2QuarterScale.m',caption:'Parametric reconstruction of the original MATLAB generator, at the selected scale. This is not the report’s separate MSL-derived injector geometry.'},
  msl:{label:'C / MSL-DERIVED REFERENCE',title:'The baseline for flow control.',description:'Reported quarter-scale throat and exit areas define this conical diverging-section approximation. The plume study uses a Mach 5-class nitrogen jet; the 3D injector comparison operates at h/d = 10.',conditions:[['Reference areas','69 / 1,930 mm²'],['Reported atmosphere','690 Pa / 290 K'],['Axisymmetric baseline','h/d = 34.5'],['3D control comparison','h/d = 10']],scale:1,totalTemperature:300,totalPressure:1.675,gasConstant:296.8,source:'Second_Version.pdf#page=35',caption:'Reference diverging section reconstructed from reported areas and the 80%-length / 15° approximation. Not an exported CAD surface or a solved field.'}
};
function updateURL(){
  const url=new URL(location.href);
  url.searchParams.set('case',state.case);url.searchParams.set('injector',state.injector);url.searchParams.set('profile',state.profile);
  history.replaceState(null,'',url);
}
function pressed(selector,attribute,value){document.querySelectorAll(selector).forEach(button=>button.setAttribute('aria-pressed',String(button.dataset[attribute]===value)));}
function conditions(rows){return rows.map(([key,value])=>`<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('');}
function stat(label,value,note){return `<div><span>${escape(label)}</span><strong>${escape(value)}</strong><small>${escape(note)}</small></div>`;}
function geometry(){
  if(state.case==='mdtn')return hotNozzle(state.scale);
  if(state.case==='msl')return mslApproximation(state.scale);
  return data.mccabe.geometry.map(([x,y])=>[x/1000*state.scale,y/1000*state.scale]);
}
function restoreAssumptions(){
  Object.assign(state,{scale:cases[state.case].scale,gamma:1.4,totalTemperature:cases[state.case].totalTemperature,totalPressure:cases[state.case].totalPressure});
  $('nozzleScale').value=state.scale;$('gammaInput').value=state.gamma;$('totalTemperature').value=state.totalTemperature;$('totalPressure').value=state.totalPressure;
}
function setCase(value){
  state.case=value;restoreAssumptions();pressed('[data-case]','case',value);
  const entry=cases[value];$('geometryLabel').textContent=entry.label;$('caseTitle').textContent=entry.title;$('caseDescription').textContent=entry.description;$('caseConditions').innerHTML=conditions(entry.conditions);$('geometryCaption').textContent=entry.caption;$('caseSource').href=SOURCE+entry.source;
  $('fieldView').value=value==='mccabe'?'mccabe-mach':value==='mdtn'?'mdtn-mach':'msl-mach';
  renderGeometry();renderField();updateURL();
}
function plotFrame(width,height,{xmax,ymax,xlabel,ylabel,yticks=5,xticks=5,dark=false}){
  const left=width<700?65:75,right=width-22,top=42,bottom=height-60;
  const x = value => left+value/xmax*(right-left), y=value=>bottom-value/ymax*(bottom-top);
  let grid='';
  for(let i=0;i<=yticks;i++){const value=ymax*i/yticks;grid+=`<line class="grid" x1="${left}" y1="${y(value)}" x2="${right}" y2="${y(value)}"/><text text-anchor="end" x="${left-11}" y="${y(value)+4}">${number(value,ymax<=1?2:0)}</text>`;}
  for(let i=0;i<=xticks;i++){const value=xmax*i/xticks;grid+=`<line class="grid" x1="${x(value)}" y1="${top}" x2="${x(value)}" y2="${bottom}"/><text text-anchor="middle" x="${x(value)}" y="${bottom+24}">${number(value,xmax<1?2:1)}</text>`;}
  grid+=`<text class="svg-label" x="${left}" y="20">${escape(ylabel)}</text><text class="svg-label" text-anchor="middle" x="${(left+right)/2}" y="${height-13}">${escape(xlabel)}</text>`;
  return {x,y,left,right,top,bottom,markup:grid};
}
function seriesPath(series,x,y){
  let previous=false,path='';
  for(const [a,b]of series){if(b===null){previous=false;continue;}path+=`${previous?'L':'M'}${x(a).toFixed(2)},${y(b).toFixed(2)} `;previous=true;}
  return path;
}
function renderGeometry(){
  const points=geometry(),throat=points.reduce((a,b)=>b[1]<a[1]?b:a),exit=points.at(-1),ratio=(exit[1]/throat[1])**2;
  const exitMach=machFromArea(ratio,state.gamma);
  const exitState=staticState(exitMach,state.gamma,cases[state.case].gasConstant,state.totalTemperature,state.totalPressure*1e6);
  $('scaleValue').textContent=number(state.scale,2)+'×';$('gammaValue').textContent=number(state.gamma,2);
  $('nozzleStats').innerHTML=stat('EXPANSION RATIO / Aₑ/A*',number(ratio,2),'Calculated from circular areas')+stat('IDEAL EXIT MACH',number(exitMach,3),'Isentropic reference')+stat('IDEAL EXIT TEMPERATURE',number(exitState.temperature,1)+' K','Static temperature, not T₀')+stat('IDEAL EXIT VELOCITY',number(exitState.velocity,0)+' m/s','Using the selected gas constant');
  const width=1050,height=330,pad=65,right=1020,mid=160;
  const maximum=Math.max(...points.map(p=>p[1])),length=exit[0];
  const px=x=>pad+x/length*(right-pad),py=r=>mid-r/maximum*108;
  const outline=points.map(([x,r],i)=>`${i?'L':'M'}${px(x).toFixed(2)},${py(r).toFixed(2)}`).join(' ');
  const lower=points.map(([x,r],i)=>`${i?'L':'M'}${px(x).toFixed(2)},${(2*mid-py(r)).toFixed(2)}`).join(' ');
  const position=length*state.position;
  const local=nozzleReference(points,position,state.gamma,cases[state.case].gasConstant,state.totalTemperature,state.totalPressure*1e6);
  $('nozzlePositionValue').textContent=number(position*1000,1)+' mm';
  let ticks='';for(let i=0;i<=5;i++)ticks+=`<text text-anchor="middle" x="${px(length*i/5)}" y="302">${number(length*i/5*1000,0)}</text>`;
  $('nozzleContour').innerHTML=`<line class="grid" x1="${pad}" y1="${mid}" x2="${right}" y2="${mid}"/><path d="${outline}" fill="none" stroke="#d8ad87" stroke-width="2.5"/><path d="${lower}" fill="none" stroke="#a9c2b1" stroke-width="2.5"/><line x1="${px(throat[0])}" y1="35" x2="${px(throat[0])}" y2="280" stroke="currentColor" stroke-dasharray="4 6" opacity=".4"/><text x="${px(throat[0])+10}" y="27">THROAT / ${number(throat[1]*1000,2)} mm</text><line x1="${px(position)}" y1="40" x2="${px(position)}" y2="280" stroke="#e7c6a2"/><circle cx="${px(position)}" cy="${py(local.radius)}" r="5" fill="#e7c6a2"/><text x="${pad}" y="27">RADIUS / MAX ${number(maximum*1000,1)} mm</text>${ticks}<text text-anchor="middle" class="svg-label" x="540" y="327">AXIAL COORDINATE / mm · SELECTED SCALE ${number(state.scale,2)}×</text>`;
  $('localState').innerHTML=`<span>RADIUS <strong>${number(local.radius*1000,2)} mm</strong></span><span>IDEAL MACH <strong>${number(local.mach,3)}</strong></span><span>STATIC T <strong>${number(local.temperature,1)} K</strong></span><span>STATIC p <strong>${number(local.pressure/1000,2)} kPa</strong></span>`;
  renderReferenceCurve(points,local);
  drawNozzle();
  depth?.geometryChanged();
}
function renderReferenceCurve(points,local){
  const metric=$('referenceQuantity').value;
  const samples=points.map(([position])=>{
    const value=nozzleReference(points,position,state.gamma,cases[state.case].gasConstant,state.totalTemperature,state.totalPressure*1e6);
    return [position,metric==='temperature'?value.temperature/state.totalTemperature:metric==='pressure'?value.pressure/(state.totalPressure*1e6):value[metric]];
  });
  const maximum=(metric==='temperature'||metric==='pressure')?1:Math.ceil(Math.max(...samples.map(p=>p[1]))/(metric==='velocity'?500:1))*(metric==='velocity'?500:1);
  const names={mach:'IDEAL MACH NUMBER / M',temperature:'STATIC TEMPERATURE / T/T₀',pressure:'STATIC PRESSURE / p/p₀',velocity:'IDEAL VELOCITY / m/s'};
  const f=plotFrame(1050,300,{xmax:points.at(-1)[0],ymax:maximum,xlabel:'AXIAL COORDINATE / m · ANALYTICAL REFERENCE, NOT CFD',ylabel:names[metric],yticks:metric==='temperature'||metric==='pressure'?4:5});
  const markup=f.markup;
  const x=points.at(-1)[0]*state.position,value=metric==='temperature'?local.temperature/state.totalTemperature:metric==='pressure'?local.pressure/(state.totalPressure*1e6):local[metric];
  $('referenceChart').innerHTML=markup+`<path d="${seriesPath(samples,f.x,f.y)}" fill="none" stroke="#d8ad87" stroke-width="2.5"/><line x1="${f.x(x)}" x2="${f.x(x)}" y1="${f.top}" y2="${f.bottom}" stroke="#bdd1b9" stroke-dasharray="4 6"/><circle cx="${f.x(x)}" cy="${f.y(value)}" r="5" fill="#f0c7a1"/>`;
}
const canvas=$('nozzleCanvas'),context=canvas.getContext('2d');
function drawNozzle(){
  if(!data||!context)return;
  const rectangle=canvas.getBoundingClientRect(),width=rectangle.width,height=rectangle.height;if(!width||!height)return;
  const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);
  const points=geometry(),length=points.at(-1)[0],rmax=Math.max(...points.map(p=>p[1])),normaliser=Math.max(length,2.4*rmax),scale=Math.min(width/1.35,height/1.05)*state.camera.zoom;
  const cy=Math.cos(state.camera.yaw),sy=Math.sin(state.camera.yaw),cp=Math.cos(state.camera.pitch),sp=Math.sin(state.camera.pitch);
  function project(x,y,z){
    x=(x-length/2)/normaliser;y/=normaliser;z/=normaliser;
    const rx=x*cy+z*sy,rz=-x*sy+z*cy,ry=y*cp-rz*sp,depth=y*sp+rz*cp;
    return [width/2+rx*scale,height/2-ry*scale,depth];
  }
  function point(p,angle){return project(p[0],p[1]*Math.cos(angle),p[1]*Math.sin(angle));}
  const sampled=points.filter((_,i)=>i%Math.max(1,Math.floor(points.length/100))===0);if(sampled.at(-1)!==points.at(-1))sampled.push(points.at(-1));
  const start=state.cut?Math.PI/2:0,segments=state.cut?27:36,extent=state.cut?Math.PI*1.5:Math.PI*2,faces=[];
  for(let i=0;i<sampled.length-1;i++)for(let j=0;j<segments;j++){
    const angle=start+extent*j/segments,next=start+extent*(j+1)/segments;
    const face=[point(sampled[i],angle),point(sampled[i+1],angle),point(sampled[i+1],next),point(sampled[i],next)];
    faces.push({points:face,depth:face.reduce((sum,p)=>sum+p[2],0)/4,shade:.5+.5*Math.cos(angle-1.1)});
  }
  faces.sort((a,b)=>a.depth-b.depth);
  for(const face of faces){context.beginPath();face.points.forEach((p,i)=>i?context.lineTo(p[0],p[1]):context.moveTo(p[0],p[1]));context.closePath();const k=face.shade;context.fillStyle=`rgb(${Math.round(70+100*k)},${Math.round(90+110*k)},${Math.round(78+95*k)})`;context.fill();context.strokeStyle='rgba(205,222,203,.13)';context.lineWidth=.5;context.stroke();}
  const marker=nozzleReference(points,length*state.position,state.gamma,cases[state.case].gasConstant,state.totalTemperature,state.totalPressure*1e6);
  context.beginPath();for(let i=0;i<=90;i++){const angle=start+extent*i/90,p=point([length*state.position,marker.radius*1.012],angle);i?context.lineTo(p[0],p[1]):context.moveTo(p[0],p[1]);}context.strokeStyle='#f0c7a1';context.lineWidth=2;context.stroke();
  context.fillStyle='#c2d0be';context.font='10px monospace';context.textAlign='left';context.fillText(state.cut?'QUARTER SECTION / EXPOSED GEOMETRY':'SURFACE OF REVOLUTION / GEOMETRY',15,height-16);
  const inlet=project(0,0,0),outlet=project(length,0,0);context.fillStyle='#e1c5a7';context.fillText('INLET',clamp(inlet[0]-15,8,width-90),clamp(inlet[1]+rmax/normaliser*scale+25,20,height-35));context.fillText('EXIT',clamp(outlet[0],8,width-70),clamp(outlet[1]+rmax/normaliser*scale+25,20,height-35));
}
let drag=null;
canvas.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY,yaw:state.camera.yaw,pitch:state.camera.pitch};canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointermove',event=>{if(!drag)return;state.camera.yaw=drag.yaw+(event.clientX-drag.x)*.008;state.camera.pitch=clamp(drag.pitch+(event.clientY-drag.y)*.008,-1.3,1.3);drawNozzle();});
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{drag=null;});
canvas.addEventListener('wheel',event=>{event.preventDefault();state.camera.zoom=clamp(state.camera.zoom*Math.exp(-event.deltaY*.001),.55,2.2);drawNozzle();},{passive:false});
canvas.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(event.key))return;event.preventDefault();if(event.key==='ArrowLeft')state.camera.yaw-=.12;if(event.key==='ArrowRight')state.camera.yaw+=.12;if(event.key==='ArrowUp')state.camera.pitch=clamp(state.camera.pitch+.12,-1.3,1.3);if(event.key==='ArrowDown')state.camera.pitch=clamp(state.camera.pitch-.12,-1.3,1.3);if(['+','='].includes(event.key))state.camera.zoom=clamp(state.camera.zoom+.1,.55,2.2);if(event.key==='-')state.camera.zoom=clamp(state.camera.zoom-.1,.55,2.2);drawNozzle();});
new ResizeObserver(()=>drawNozzle()).observe(canvas);
function renderProfile(){
  const radial=state.profile==='radial',series=radial?data.mccabe.radialVelocity:data.mccabe.axialVelocity;
  state.probe=clamp(state.probe,0,series.length-1);$('profileProbe').max=series.length-1;$('profileProbe').value=state.probe;
  pressed('[data-profile]','profile',state.profile);
  const sample=series[state.probe],frame=plotFrame(900,390,{xmax:radial?.075:.6,ymax:900,xlabel:radial?'RADIAL COORDINATE / m':'AXIAL PROBE COORDINATE / m',ylabel:'SAVED VELOCITY MAGNITUDE / m/s',yticks:3});
  $('velocityChart').innerHTML=frame.markup+`<path d="${seriesPath(series,frame.x,frame.y)}" fill="none" stroke="#496e60" stroke-width="2.5"/><line x1="${frame.x(sample[0])}" x2="${frame.x(sample[0])}" y1="${frame.top}" y2="${frame.bottom}" stroke="#9c583b" stroke-dasharray="4 5"/>`+series.map(([x,y],i)=>`<circle class="profile-point" data-point="${i}" cx="${frame.x(x)}" cy="${frame.y(y)}" r="${i===state.probe?6:3.5}" fill="${i===state.probe?'#9c583b':'#496e60'}"><title>Observation ${i+1}: ${number(x,5)} m, ${number(y,3)} m/s</title></circle>`).join('');
  $('profileKind').textContent=radial?'McCABE / RADIAL EXIT-PLANE PROBE':'McCABE / AXIAL LINE PROBE';
  $('profileObservation').textContent=number(sample[1],1)+' m/s';
  $('profileValues').innerHTML=conditions([['Observation',`${state.probe+1} / ${series.length}`],['Probe coordinate',number(sample[0],6)+' m'],['Source value',number(sample[1],4)+' m/s']]);
  $('profileInterpretation').textContent=radial?'The core is relatively even, with a rise toward the outer samples and a zero-valued wall endpoint. A peak and a uniform core answer different questions; neither alone establishes agreement across the whole flow.':'The saved points show a slow chamber region, rapid acceleration and a downstream plateau. The axial coordinate includes the probe’s own origin; it is not silently reassigned to the nozzle throat.';
  $('profileDownload').href=SOURCE+(radial?'GasVelocityNozzleExitPlane.csv':'McCabeNozzleGasVelocityNozzleAxis.csv');
  $('velocityChart').querySelectorAll('[data-point]').forEach(point=>point.addEventListener('click',()=>{state.probe=Number(point.dataset.point);renderProfile();}));
  updateURL();
}
const fieldNotes={
  'mccabe-mach':{image:'mccabe-mach.png',caption:'Final report / Figure 24 / printed p32. McCabe Mach contours, mirrored for presentation.',context:'This is the McCabe case. Colour encodes the source’s Mach field, including downstream expansion; it is not a single uniform exit Mach number.'},
  'mccabe-schlieren':{image:'mccabe-schlieren.png',caption:'Final report / Figure 26 / printed p34. Original pseudo-Schlieren diagnostic.',context:'The density-change diagnostic emphasises shocks. Brightness does not represent gas velocity, and this saved image does not establish transient behaviour.'},
  'mccabe-shadowgraph':{image:'mccabe-shadowgraph.png',caption:'Final report / Figure 27 / printed p34. Original shadowgraph diagnostic.',context:'A complementary density-based diagnostic makes compression and expansion structures visible. The labels are those in the original report.'},
  'mdtn-mach':{image:'mdtn-mach.png',caption:'Final report / Figure 28 / printed p35. Hot Martian Descent Thruster Nozzle.',context:'This higher-expansion case uses the reported 3,300 K chamber and air plume model. Do not transfer the separate MSL-derived injector reductions to this field.'},
  'msl-mach':{image:'msl-mach.png',caption:'Report B / Figure 29 / printed p43. MSL-derived axisymmetric plume.',context:'The axisymmetric configuration uses h/d = 34.5. The later three-dimensional injector comparison changes the impingement distance to h/d = 10.'},
  'msl-schlieren':{image:'msl-schlieren.png',caption:'Report B / Figure 31 / printed p45. Combined Mach and pseudo-Schlieren view.',context:'Annotations identify the bow shock, stagnation bubble and redirected wall flow. Differences from the inclined published benchmark remain part of the validation limits.'}
};
const features={
  expansion:{title:'A jet adjusts to its surroundings.',text:'An underexpanded nozzle jet continues to expand after the exit. Expansion and compression waves create a structured flow whose Mach number varies in space. Look for the near-exit wave pattern and changes along the plume; these influence what reaches the surface.'},
  bubble:{title:'The centre is not always the peak.',text:'The impingement shock decelerates the approaching gas. A recirculating or stagnating region can sit above the plate, while the strongest surface-pressure peak occurs farther out. Its size, centre pressure and annular peak are separate quantities.'},
  wall:{title:'Turning the plume creates a wall flow.',text:'After impingement, gas travels radially outward. Pressure variations and near-wall velocity gradients determine different surface loads. Follow the pressure and shear together in the injector comparison to see why one favourable quantity cannot settle the design.'}
};
function renderField(){
  const field=fieldNotes[$('fieldView').value],feature=features[state.feature];
  $('flowImage').src=FIGURES+field.image;$('flowImage').alt=field.caption;$('flowCaption').textContent=field.caption;$('fieldContext').textContent=field.context;
  $('fieldZoom').onclick=()=>showImages([field.image],field.caption+' '+field.context);
  $('featureTitle').textContent=feature.title;$('featureReading').textContent=feature.text;pressed('[data-feature]','feature',state.feature);
}
const meshNotes={
  msl:{sizes:[10,20,30],selected:20,label:'MSL-DERIVED / AXISYMMETRIC PLUME',title:'The intermediate base size was carried forward.',reading:'The report compares 10, 20 and 30 mm base sizes using Mach-disc structure and centreline behaviour. It selects 20 mm for the subsequent analysis. The finest case shows unsteady structure; sharper images alone do not resolve convergence or modelling uncertainty.',settings:[['Reported selection','20 mm'],['Surface growth rate','1.1'],['Plate treatment','16 prism layers'],['Nozzle treatment','7 prism layers']],prefix:'msl-mesh-',scale:'msl-mesh-scale.png',caption:'Report B / Figure 27 / printed pp41–42. Mach-disc detail; common source scale.'},
  injector:{sizes:[7,9,11],selected:9,label:'3D INJECTOR-OFF / PRESSURE FOOTPRINT',title:'A mesh choice precedes the comparison.',reading:'The off case is evaluated at 7, 9 and 11 mm. The report carries the 9 mm base into the active-injection cases to manage cost. The asymmetric hotspots and domain extent remain acknowledged limitations.',settings:[['Reported selection','9 mm'],['Surface growth rate','1.05'],['Plate treatment','7 prism layers'],['Primary nozzle interior','5 prism layers']],prefix:'injector-mesh-',scale:'injector-mesh-scale.png',caption:'Report B / Figure 32 / printed p46. Pressure footprint, with the original absolute/normalised scale.'}
};
function renderMesh(){
  const config=meshNotes[state.mesh];if(!config.sizes.includes(state.meshSize))state.meshSize=config.selected;
  $('meshChoices').innerHTML=config.sizes.map(size=>`<button type="button" data-mesh-size="${size}" aria-pressed="${state.meshSize===size}">${size} mm${size===config.selected?' / SELECTED':''}</button>`).join('');
  $('meshChoices').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{state.meshSize=Number(button.dataset.meshSize);renderMesh();}));
  const image=config.prefix+state.meshSize+'.png';$('meshImage').src=FIGURES+image;$('meshImage').alt=config.label+', base '+state.meshSize+' mm';$('meshScale').src=FIGURES+config.scale;$('meshCaption').textContent=config.caption+' Displayed base size: '+state.meshSize+' mm.';
  $('meshCaseLabel').textContent=config.label;$('meshTitle').textContent=config.title;$('meshReading').textContent=config.reading;$('meshSettings').innerHTML=conditions(config.settings);
  $('meshZoom').onclick=()=>showImages([image,config.scale],$('meshCaption').textContent);
  depth?.mesh();
}
const injectors={
  off:{number:'01',title:'Start with the undisturbed interaction.',reading:'Without secondary injection, the pressure footprint shows a concentrated annular structure. The radial profile has a prominent off-axis peak and a secondary outer feature. This is the comparison baseline for the two interventions.',color:'#b0c6b7',label:'INJECTION OFF'},
  normal:{number:'02',title:'Redistribution carries a trade-off.',reading:'Perpendicular jets alter the plume and diffuse parts of the footprint. Central pressure rises, and the dominant shear peak exceeds the off case. A reduced pressure peak therefore does not imply that every surface load improved.',color:'#79bfca',label:'PERPENDICULAR'},
  canted:{number:'03',title:'A small cant changes the compromise.',reading:'The reported 5° cant introduces a tangential component. The plotted pressure and shear peaks are lower and outer loading is redistributed. This is one tested orientation, not a continuous optimisation of injector angle or evidence of captured regolith.',color:'#e3ae8c',label:'CANTED / 5°'}
};
function renderLoads(){
  if(depth){depth.loads();return;}
  $('radiusValue').textContent=number(state.radius,3)+' m';
  for(const metric of ['pressure','shear']){
    const f=plotFrame(650,370,{xmax:.35,ymax:metric==='pressure'?10000:250,xlabel:'RADIUS FROM PLUME AXIS / m',ylabel:metric==='pressure'?'SURFACE PRESSURE / Pa':'SURFACE SHEAR / Pa',xticks:7,yticks:5});
    let body=f.markup;
    for(const key of ['off','normal','canted'].filter(k=>k!==state.injector).concat(state.injector))body+=`<path d="${seriesPath(data.injectors[key][metric],f.x,f.y)}" fill="none" stroke="${injectors[key].color}" stroke-width="${key===state.injector?3:1.5}" opacity="${key===state.injector?1:.48}"/>`;
    body+=`<line x1="${f.x(state.radius)}" x2="${f.x(state.radius)}" y1="${f.top}" y2="${f.bottom}" stroke="#ead4b7" stroke-dasharray="4 5"/>`;
    const sample=nearestVisible(data.injectors[state.injector][metric],state.radius);
    if(sample)body+=`<circle cx="${f.x(sample[0])}" cy="${f.y(sample[1])}" r="5" fill="${injectors[state.injector].color}"/>`;
    $(metric+'Chart').innerHTML=body;
  }
  const p=nearestVisible(data.injectors[state.injector].pressure,state.radius),s=nearestVisible(data.injectors[state.injector].shear,state.radius);
  const peak=metric=>Math.max(...data.injectors[state.injector][metric].filter(p=>p[1]!==null).map(p=>p[1]));
  $('loadReadouts').innerHTML=stat('PRESSURE NEAR THE PROBE',p?'≈ '+number(p[1],0)+' Pa':'Curve obscured',p?'Visible sample at '+number(p[0],4)+' m':'No nearby visible source pixels')+stat('SHEAR NEAR THE PROBE',s?'≈ '+number(s[1],0)+' Pa':'Curve obscured',s?'Visible sample at '+number(s[0],4)+' m':'No nearby visible source pixels')+stat('VISIBLE PRESSURE PEAK','≈ '+number(peak('pressure'),0)+' Pa','Approximate radial-cut maximum')+stat('VISIBLE SHEAR PEAK','≈ '+number(peak('shear'),0)+' Pa','Approximate radial-cut maximum');
}
function setInjector(value){
  state.injector=value;pressed('[data-injector]','injector',value);
  const entry=injectors[value];$('injectorNumber').textContent=entry.number;$('injectorTitle').textContent=entry.title;$('injectorReading').textContent=entry.reading;
  for(const metric of ['Mach','Pressure']){
    const image=value+'-'+metric.toLowerCase()+'.png';$('injector'+metric+'Image').src=FIGURES+image;$('injector'+metric+'Image').alt=entry.label+' / '+metric+' source field';$('injector'+metric+'Zoom').onclick=()=>showImages([image,metric==='Mach'?'injector-mach-scale.png':'injector-pressure-scale.png'],entry.label+' — Report B, Figure '+(metric==='Mach'?'34':'35')+'. Original static field, with the common source scale.');
  }
  renderLoads();updateURL();
}
function showImages(images,caption){
  const dialog=$('imageDialog');$('dialogImages').className=images.length===2?'dual':'';$('dialogImages').replaceChildren(...images.map(filename=>{const img=document.createElement('img');img.src=FIGURES+filename;img.alt=caption;return img;}));$('dialogCaption').textContent=caption;if(!dialog.open)dialog.showModal();
}
$('closeImage').addEventListener('click',()=>$('imageDialog').close());$('imageDialog').addEventListener('click',event=>{if(event.target===$('imageDialog'))$('imageDialog').close();});
document.querySelectorAll('[data-image]').forEach(button=>button.addEventListener('click',()=>showImages([button.dataset.image],button.dataset.caption)));
$('showSourcePlots').addEventListener('click',()=>showImages(['pressure-source.png','shear-source.png'],'Report B, Figures 36 and 37, printed p51. Original chart images used for the approximate native traces. The manuscript’s written reduction percentages require reconciliation with these plotted peaks.'));
document.querySelectorAll('[data-case]').forEach(button=>button.addEventListener('click',()=>setCase(button.dataset.case)));
document.querySelectorAll('[data-injector]').forEach(button=>button.addEventListener('click',()=>setInjector(button.dataset.injector)));
document.querySelectorAll('[data-profile]').forEach(button=>button.addEventListener('click',()=>{state.profile=button.dataset.profile;state.probe=state.profile==='radial'?8:12;renderProfile();}));
document.querySelectorAll('[data-feature]').forEach(button=>button.addEventListener('click',()=>{state.feature=button.dataset.feature;renderField();}));
$('profileProbe').addEventListener('input',event=>{state.probe=Number(event.target.value);renderProfile();});
$('radiusProbe').addEventListener('input',event=>{state.radius=Number(event.target.value);renderLoads();});
$('fieldView').addEventListener('change',renderField);
$('meshStudy').addEventListener('change',event=>{state.mesh=event.target.value;state.meshSize=meshNotes[state.mesh].selected;renderMesh();});
for(const [id,key,min,max] of [['nozzleScale','scale',.25,1],['gammaInput','gamma',1.2,1.67],['totalTemperature','totalTemperature',100,4000],['totalPressure','totalPressure',.01,30]]){
  $(id).addEventListener('input',event=>{const value=Number(event.target.value);if(!event.target.value||!Number.isFinite(value))return;state[key]=clamp(value,min,max);renderGeometry();});
  $(id).addEventListener('change',event=>{event.target.value=state[key];});
}
$('nozzlePosition').addEventListener('input',event=>{state.position=Number(event.target.value)/1000;renderGeometry();});
$('referenceQuantity').addEventListener('change',()=>renderGeometry());
$('resetAssumptions').addEventListener('click',()=>{restoreAssumptions();renderGeometry();});
$('geometryCut').addEventListener('click',()=>{state.cut=!state.cut;$('geometryCut').setAttribute('aria-pressed',String(state.cut));$('geometryCut').textContent=state.cut?'RESTORE THE COMPLETE SURFACE':'OPEN A QUARTER SECTION';drawNozzle();});
$('resetCamera').addEventListener('click',()=>{state.camera={yaw:-.58,pitch:.42,zoom:1};drawNozzle();});
const sections=[...document.querySelectorAll('main>section[id]')];
const chapterObserver=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting);if(visible.length){const target=visible.at(-1).target.id;document.querySelectorAll('.plume-chapters a').forEach(a=>a.classList.toggle('is-active',a.hash==='#'+target));}},{rootMargin:'-15% 0px -60% 0px'});
sections.forEach(section=>chapterObserver.observe(section));
async function start(){
  try{
    const response=await fetch('research/hypersonic/data.json');if(!response.ok)throw new Error('The numerical data could not be loaded.');data=await response.json();
    setCase(state.case);renderProfile();renderMesh();setInjector(state.injector);
    depth=initialiseDepth({data,state,cases,geometry,setCase,setInjector,renderMesh,stat,conditions,escape,number,seriesPath});
    $('loadStatus').textContent='';document.body.dataset.plumeReady='true';
  }catch(error){$('loadStatus').textContent='Numerical exhibits could not load. Reload this page to retry; the research text and source links remain available.';console.error(error);}
}
start();
