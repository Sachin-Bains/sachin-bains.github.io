import {machFromArea,staticState,nearestVisible} from './plume-math.js';
import {normalShock,chokedMassFlow,visiblePeak,differenceSeries,firstLayerHeight} from './plume-analysis.js';

/** Extends the existing case study; all archived CFD remains immutable. */
export function initialiseDepth(api){
  const {data,state,cases,geometry,setCase,setInjector,renderMesh,stat,conditions,escape,number,seriesPath}=api;
  const $=id=>document.getElementById(id),source='research/hypersonic/source/';
  const keys=['off','normal','canted'];
  const names={off:'Injection off',normal:'Perpendicular',canted:'Canted / 5°'};
  const colours={off:'#b0c6b7',normal:'#79bfca',canted:'#e3ae8c'};
  const ambient={mccabe:600,mdtn:699,msl:690};
  let route=state.case,previousCase=null,mode='absolute',region='plate',shockFromExit=true;
  const routes={
    mccabe:{kicker:'A / FOUNDATION · REPORT A',title:'Establish the nozzle model.',question:'Can the reconstructed published contour produce the expected acceleration and a physically interpretable exit profile?',rows:[['Construction','Published McCabe coordinates reconstructed into a 500-point profile, then exported for CAD.'],['Model','Axisymmetric compressible flow; nitrogen chamber at 300 K and 5 MPa; Spalart–Allmaras baseline.'],['Inspect','Original axial and exit-plane velocity CSVs; Mach, pseudo-Schlieren and shadowgraph fields.']],conclusion:'The geometry and saved profiles make the foundation inspectable. Peak agreement alone is not a full validation of the downstream plume.',page:'2557662B_ENG4110P_Final.pdf#page=24'},
    mdtn:{kicker:'B / HOT-FLOW BRANCH · REPORT A',title:'Extend the operating regime.',question:'How does a much larger expansion ratio behave under a hot chamber condition and a thin Martian atmosphere?',rows:[['Construction','Linear converging and parabolic diverging MATLAB profile; script-derived quarter-scale length 375 mm and exit radius 150 mm.'],['Model','Axisymmetric ideal non-reacting air plume; chamber 3,300 K and 20.265 MPa; atmosphere 699 Pa and 210 K; k–ω SST.'],['Inspect','Reported exit Mach peak ≈ 7.52, nonuniform exit profile and external Mach field; proposed 20°/45° microjet geometry.']],conclusion:'The hot-nozzle results are a separate branch. Its microjet placements were proposed; the report explicitly records that their mitigation results were not completed.',page:'2557662B_ENG4110P_Final.pdf#page=34'},
    msl:{kicker:'C / IMPINGEMENT BASELINE · REPORT B',title:'Make the surface interaction tractable.',question:'Can a computationally affordable model capture the major flow structures of a Mach 5-class landing plume?',rows:[['Construction','Reported throat and exit areas, expansion ratio about 28. A problematic parabolic approximation was replaced by a conical nozzle.'],['Model','2D axisymmetric, h/d = 34.5; k–ω SST; 10/20/30 mm mesh-base comparison, carrying 20 mm forward.'],['Inspect','Mach-disc sensitivity, nozzle-exit behaviour and annotated plume diagnostics. The published engine’s 22.5° inclination is omitted.']],conclusion:'This establishes a working baseline for the investigation, with explicit geometric and spatial-model departures from the published reference.',page:'Second_Version.pdf#page=35'},
    injector:{kicker:'D / CONTROL STUDY · REPORT B',title:'Test an intervention against two loads.',question:'Does secondary injection redistribute the plume favourably when pressure and shear are evaluated together?',rows:[['Construction','MSL-derived primary nozzle; four injectors represented by one injector in a 90° sector; h/d = 10.'],['Model','3D compressible RANS, k–ω SST; off-case 7/9/11 mm sensitivity; 9 mm carried into off, perpendicular and 5° canted cases.'],['Inspect','Streamsurfaces, Mach sections, pressure footprints and radial pressure/shear profiles for the same three configurations.']],conclusion:'Perpendicular injection reduces the prominent pressure peak but raises peak shear. Canting gives a more favourable pair of visible load peaks; the centre pressure and injection cost remain separate questions.',page:'Second_Version.pdf#page=41'}
  };
  function mark(selector,key,value){document.querySelectorAll(selector).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[key]===value)));}
  function drawRoute(){
    const r=routes[route];mark('[data-route]','route',route);
    $('routeKicker').textContent=r.kicker;$('routeTitle').textContent=r.title;$('routeQuestion').textContent=r.question;
    $('routeEvidence').innerHTML=conditions(r.rows);$('routeConclusion').textContent=r.conclusion;$('routeReport').href=source+r.page;
  }
  document.querySelectorAll('[data-route]').forEach(b=>b.addEventListener('click',()=>{
    route=b.dataset.route;setCase(route==='injector'?'msl':route);
    if(route==='injector'||route==='msl'){state.mesh=route==='injector'?'injector':'msl';state.meshSize=state.mesh==='injector'?9:20;$('meshStudy').value=state.mesh;renderMesh();}
    drawRoute();
  }));
  function reference(){
    const points=geometry(),throat=points.reduce((a,b)=>b[1]<a[1]?b:a),exit=points.at(-1);
    const mach=machFromArea((exit[1]/throat[1])**2,state.gamma),R=cases[state.case].gasConstant;
    return {...staticState(mach,state.gamma,R,state.totalTemperature,state.totalPressure*1e6),throat,area:Math.PI*throat[1]**2,R};
  }
  function budget(){
    const ref=reference(),pa=Number($('ambientPressure').value)||ambient[state.case],pe=ref.pressure,p0=state.totalPressure*1e6;
    const ratio=pe/pa,regime=ratio>1.05?'Underexpanded reference':ratio<.95?'Overexpanded reference':'Near pressure-matched';
    $('expansionRegime').textContent=regime;
    $('expansionReading').textContent=ratio>1.05?'The calculated exit static pressure exceeds the surroundings. The external jet must continue to adjust through expansion and compression; the nozzle-exit state alone does not describe impingement.':ratio<.95?'The surroundings exceed the calculated exit static pressure. Compression, shocks or separation can invalidate the assumed isentropic internal branch; this comparison does not solve that response.':'The calculated exit static pressure is within 5% of ambient. Pressure matching at one plane does not remove viscous effects or the later interaction with the plate.';
    const mdot=chokedMassFlow(ref.area,state.gamma,ref.R,state.totalTemperature,p0);
    $('pressureBudgetStats').innerHTML=stat('IDEAL EXIT STATIC PRESSURE',number(pe,0)+' Pa','Calculated from the selected geometry')+stat('EXIT / AMBIENT PRESSURE',number(ratio,2)+'×','pₑ / pₐ · pressure mismatch')+stat('CHAMBER / AMBIENT',number(p0/pa,0)+'×','p₀ / pₐ · nozzle pressure ratio')+stat('IDEAL CHOKED MASS FLOW',number(mdot,3)+' kg/s','Unit discharge coefficient; not CFD output');
    const values=[{label:'AMBIENT / pₐ',value:pa,colour:'#a9c2b1'},{label:'IDEAL EXIT / pₑ',value:pe,colour:'#f0c7a1'},{label:'CHAMBER / p₀',value:p0,colour:'#79bfca'}];
    const low=Math.floor(Math.log10(Math.min(...values.map(p=>p.value)))/1),high=Math.ceil(Math.log10(Math.max(...values.map(p=>p.value))));
    const x=v=>65+(Math.log10(v)-low)/(Math.max(high-low,1))*770;
    let out='';for(let power=low;power<=high;power++){out+=`<line class="depth-axis" x1="${x(10**power)}" x2="${x(10**power)}" y1="22" y2="165"/><text text-anchor="middle" x="${x(10**power)}" y="193">10<tspan baseline-shift="super" font-size="8">${power}</tspan> Pa</text>`;}
    values.forEach((p,i)=>{const y=40+i*54;out+=`<line x1="65" x2="835" y1="${y}" y2="${y}" stroke="currentColor" opacity=".15"/><circle cx="${x(p.value)}" cy="${y}" r="6" fill="${p.colour}"/><text x="${x(p.value)>650?x(p.value)-12:x(p.value)+12}" text-anchor="${x(p.value)>650?'end':'start'}" y="${y-10}">${p.label} · ${number(p.value,0)}</text>`;});
    $('pressureBudgetChart').innerHTML=out;
  }
  $('ambientPressure').addEventListener('input',()=>{const n=Number($('ambientPressure').value);if(n>=100&&n<=120000)budget();});
  $('ambientPressure').addEventListener('change',()=>{const n=Number($('ambientPressure').value);$('ambientPressure').value=Math.min(120000,Math.max(100,n||ambient[state.case]));budget();});
  $('restoreAmbient').addEventListener('click',()=>{$('ambientPressure').value=ambient[state.case];budget();});
  function shock(){
    const m=Number($('shockMach').value),s=normalShock(m,state.gamma),quantity=$('shockQuantity').value,maximum=Number($('shockMach').max);
    const axis={pressure:'STATIC PRESSURE / p₂/p₁',temperature:'STATIC TEMPERATURE / T₂/T₁',totalPressure:'TOTAL PRESSURE RETAINED / p₀₂/p₀₁'};
    $('shockMachValue').textContent=number(m,2)+' · γ = '+number(state.gamma,2);
    const values=Array.from({length:181},(_,i)=>{const x=1+i*(maximum-1)/180;return [x,normalShock(x,state.gamma)[quantity]];});
    const ymax=quantity==='totalPressure'?1:Math.ceil(values.at(-1)[1]/5)*5;
    const x=v=>65+(v-1)/(maximum-1)*790,y=v=>280-v/ymax*235;
    let out=`<text class="depth-label" x="65" y="20">${axis[quantity]}</text>`;
    for(let i=0;i<=4;i++){const v=i*ymax/4;out+=`<line class="depth-axis" x1="65" x2="855" y1="${y(v)}" y2="${y(v)}"/><text text-anchor="end" x="53" y="${y(v)+4}">${number(v,quantity==='totalPressure'?2:1)}</text>`;}
    for(let i=1;i<=maximum;i++)out+=`<text text-anchor="middle" x="${x(i)}" y="305">${i}</text>`;
    out+=`<path d="${seriesPath(values,x,y)}" stroke="#496e60" stroke-width="2.5" fill="none"/><line x1="${x(m)}" x2="${x(m)}" y1="40" y2="280" stroke="#9c583b" stroke-dasharray="4 6"/><circle cx="${x(m)}" cy="${y(s[quantity])}" r="6" fill="#9c583b"/><text text-anchor="middle" x="460" y="335">UPSTREAM MACH / M₁ · NORMAL-SHOCK MODEL</text>`;
    $('shockChart').innerHTML=out;
    $('shockValues').innerHTML=conditions([['Upstream Mach',number(m,2)],['Downstream Mach',number(s.mach,3)],['Static pressure jump',number(s.pressure,2)+'×'],['Density jump',number(s.density,2)+'×'],['Static temperature jump',number(s.temperature,2)+'×'],['Total pressure retained',number(s.totalPressure*100,2)+'%'],['Total temperature','Unchanged in this adiabatic model']]);
  }
  $('shockMach').addEventListener('input',()=>{shockFromExit=false;shock();});$('shockQuantity').addEventListener('change',shock);
  $('shockUseExit').addEventListener('click',()=>{shockFromExit=true;const exit=reference().mach;$('shockMach').max=Math.max(10,Math.ceil(exit));$('shockMach').value=exit;shock();});
  const codeSpecs={
    export:{file:'MccabeNozzle.m',tail:8,title:'Preserve the numerical contour.',step:'01 / COORDINATES → CAD',reading:'The recovered script stores the reconstructed coordinates and exports the x/y table for CAD. The original 500-point profile drives the revolved browser surface; no new solver run is needed to recover that geometry.',caution:'The published coordinate definition belongs to McCabe. Reconstruction, CAD transfer and the flow-model investigation are the project contribution.'},
    shape:{file:'Nozzle2QuarterScale.m',start:1,end:28,title:'Build the actual scripted shape.',step:'02 / DIMENSIONS → PARAMETRIC PROFILE',reading:'The code defines the throat and exit, applies quarter scale, joins a linear converging section to a parabolic divergence, and exports a geometrical construction. The browser follows these equations, using fewer points for rendering.',caution:'This script is not a Method of Characteristics solve. Its scripted 375 mm quarter-scale length differs from the report dimension table; the two are not silently merged.'},
    root:{file:'Nozzle2QuarterScale.m',start:44,end:65,title:'Solve a consistency reference.',step:'03 / AREA RATIO → MACH ROOT',reading:'Circular throat and exit areas define the expansion ratio. The script uses fzero on the supersonic area–Mach relation. The browser uses bounded bisection for the same ideal-gas relation and connects Mach to static pressure, temperature and velocity.',caution:'The source labels a pressure derived from the exit Mach as “inlet static”. Here it is identified by its actual calculation: an exit-based ideal static pressure. This is not a CFD solution.'}
  };
  let codeSelection=0;
  async function showCode(key){
    const ticket=++codeSelection,c=codeSpecs[key];mark('[data-code]','code',key);
    $('codeFile').textContent=c.file;$('codeDownload').href=source+c.file;$('codeStep').textContent=c.step;$('codeTitle').textContent=c.title;$('codeReading').textContent=c.reading;$('codeCaution').textContent=c.caution;
    $('codeFollow').onclick=()=>setCase(key==='export'?'mccabe':'mdtn');
    $('originalCode').textContent='Loading original source…';
    try{const response=await fetch(source+c.file);if(!response.ok)throw new Error('Source unavailable');const lines=(await response.text()).split(/\r?\n/);if(ticket!==codeSelection)return;
      const start=c.tail?Math.max(0,lines.length-c.tail):c.start-1,end=c.end||lines.length;
      $('originalCode').innerHTML=lines.slice(start,end).map((line,i)=>`<span class="source-line"><b>${i+start+1}</b><span class="${line.trim().startsWith('%')?'comment':''}">${escape(line)}</span></span>`).join('');
    }catch{if(ticket===codeSelection)$('originalCode').textContent='The excerpt could not load. Open the full original source using the link above.';}
  }
  document.querySelectorAll('[data-code]').forEach(b=>b.addEventListener('click',()=>showCode(b.dataset.code)));
  const meshRegions={
    msl:[
      {id:'volume',label:'Volume zones A–D',percent:[60,30,15,2],text:'Nested local refinements follow the plume and impingement region, while the outer domain remains coarser. Targets are applied as percentages of the base size.',note:'Target sizes describe controls, not a measured cell-size distribution. The exact region extents remain those in the original mesh figures.',page:39},
      {id:'plate',label:'Impingement plate',percent:[50],layers:16,thickness:40,text:'The plate treatment resolves near-wall gradients associated with the radially propagating flow. Pressure and wall shear respond to different aspects of this region.',boundary:'No-slip · adiabatic · impermeable',note:'No friction velocity or wall-y+ distribution is exported; layer count alone does not establish wall resolution.',page:38},
      {id:'primary',label:'Primary nozzle interior',percent:[5],minimum:1,layers:7,thickness:10,text:'Fine surface targets and prism layers are applied inside the nozzle, where acceleration and wall boundary layers set the emerging profile.',boundary:'No-slip wall; inlet uses total pressure and temperature',note:'Surface minimum is a control limit, not proof that every cell attains that size.',page:38},
      {id:'external',label:'Nozzle exterior / far field',percent:[10,700],minimum:5,layers:7,thickness:10,text:'The external nozzle receives local wall treatment; free-stream faces are much coarser to avoid spending the same resolution throughout the whole domain.',boundary:'Free stream: 690 Pa · 290 K',note:'Prism values refer to the nozzle exterior. Prism layers are disabled at the free-stream faces.',page:38}
    ],
    injector:[
      {id:'volume',label:'Volume zones A–E',percent:[10,35,70,10,40],text:'Zones A–C grade resolution through the main domain. Zones D/E are concentric cylindrical refinements along the injector axis, extending from its exit towards the primary axis.',note:'These are reported volume-control targets. The chart is a size comparison, not a rendered native mesh.',page:45},
      {id:'plate',label:'Impingement plate',percent:[90],layers:7,stretch:1.5,thickness:33.33,text:'The 3D plate has an advancing-layer treatment. The geometric stretching calculation below makes the specified total stack thickness concrete.',boundary:'No-slip · adiabatic · impermeable',note:'The calculated first layer assumes exactly the prescribed geometric stack. Native mesher clipping and wall-y+ are not verified.',page:45},
      {id:'primary',label:'Primary nozzle interior',percent:[7.5],minimum:1.25,layers:5,thickness:15,text:'The primary nozzle internal surface receives finer local targets than the domain base. Its inlet separately uses a 2.5% surface target and 1.25% minimum.',boundary:'Primary inlet: N₂ · 300 K · 1.675 MPa table value',note:'The source also states 1.765 MPa in prose. The saved case setting must resolve that discrepancy.',page:45},
      {id:'injector',label:'Injector inlet / interior',percent:[1,7.5],minimum:.25,layers:3,stretch:2,thickness:10,text:'The injector is small relative to the domain: its inlet target is 1% of base and the internal target is 7.5%. The injector-axis refinements carry resolution into the jet–jet interaction.',boundary:'Off: inlet is a wall. On: stagnation inlet.',note:'Shown prism calculation is for the interior (10% total thickness). The inlet uses 7% thickness and a 0.5% surface minimum; interior minimum is 0.25%.',page:45}
    ]
  };
  function mesh(){
    const list=meshRegions[state.mesh];if(!list.some(r=>r.id===region))region='plate';const r=list.find(r=>r.id===region),base=state.meshSize;
    $('meshRegionChoices').innerHTML=list.map(r=>`<button type="button" data-region="${r.id}" aria-pressed="${region===r.id}">${escape(r.label)}</button>`).join('');
    $('meshRegionChoices').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{region=b.dataset.region;mesh();}));
    const rows=list.flatMap(r=>r.percent.map((percent,i)=>({r,percent,label:r.id==='volume'?'Zone '+String.fromCharCode(65+i):r.id==='injector'?['Injector inlet','Injector interior'][i]:r.id==='external'?['Nozzle exterior','Free-stream face'][i]:r.label})));
    const left=245,right=770,lo=Math.log10(.02),hi=Math.log10(250),x=v=>left+(Math.log10(v)-lo)/(hi-lo)*(right-left);
    let out=`<text class="depth-label" x="${left}" y="22">LOCAL TARGET SIZE / mm · LOGARITHMIC AXIS</text>`;
    for(const value of [.02,.1,1,10,100])out+=`<line class="depth-axis" x1="${x(value)}" x2="${x(value)}" y1="40" y2="350"/><text text-anchor="middle" x="${x(value)}" y="380">${value}</text>`;
    rows.forEach((entry,i)=>{const y=62+i*(270/Math.max(rows.length-1,1)),mm=base*entry.percent/100,selected=entry.r.id===region;
      out+=`<g class="target-row" role="button" tabindex="0" data-target="${entry.r.id}" aria-label="${escape(entry.label)}, ${number(mm,3)} millimetres"><rect x="0" y="${y-15}" width="850" height="30" fill="${selected?'#c2cebb':'transparent'}"/><text x="0" y="${y+4}">${escape(entry.label)}</text><line x1="${left}" x2="${x(mm)}" y1="${y}" y2="${y}" stroke="#496e60" stroke-width="${selected?3:1}"/><circle cx="${x(mm)}" cy="${y}" r="${selected?5:3}" fill="#9c583b"/><text x="${x(mm)+11}" y="${y+4}">${number(mm,3)} / ${entry.percent}%</text></g>`;
    });
    $('meshTargetChart').innerHTML=out;
    $('meshTargetChart').querySelectorAll('[data-target]').forEach(b=>{const select=()=>{region=b.dataset.target;mesh();};b.addEventListener('click',select);b.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();select();}});});
    $('meshTargetCaption').textContent=`${state.mesh==='msl'?'Axisymmetric MSL-derived':'3D injector-off'} study · displayed base ${base} mm. Change the base size below to recalculate every target; archived comparison fields retain their own selected base.`;
    $('meshRegionKicker').textContent=`${state.mesh==='msl'?'2D AXISYMMETRIC':'3D QUARTER-DOMAIN'} / ${base} mm BASE`;
    $('meshRegionTitle').textContent=r.label;$('meshRegionReading').textContent=r.text;
    const values=[['Surface / volume targets',r.percent.map(v=>`${v}% → ${number(base*v/100,3)} mm`).join(' · ')]];
    if(r.minimum)values.push(['Minimum surface size',number(base*r.minimum/100,4)+' mm']);
    if(r.layers){values.push(['Prism layers',r.layers],['Total prism thickness',number(base*r.thickness/100,3)+' mm']);if(r.stretch)values.push(['Layer stretching',r.stretch+'×'],['Ideal first layer',number(firstLayerHeight(base*r.thickness/100,r.layers,r.stretch),4)+' mm']);}
    if(r.boundary)values.push(['Boundary / reference',r.boundary]);
    $('meshRegionValues').innerHTML=conditions(values);$('meshRegionNote').textContent=r.note;$('meshRegionSource').href=source+'Second_Version.pdf#page='+r.page;
  }
  const peaks=Object.fromEntries(keys.map(key=>[key,Object.fromEntries(['pressure','shear'].map(m=>[m,visiblePeak(data.injectors[key][m])]))]));
  const change=(key,m)=>(peaks[key][m][1]/peaks.off[m][1]-1)*100;
  const signed=(v,d=1)=>(v>0?'+':'')+number(v,d);
  function tradeoff(){
    const x=v=>85+(v-.75)/.4*640,y=v=>310-(v-.75)/.4*260;
    let out=`<rect class="target-region" x="${x(.75)}" y="${y(1)}" width="${x(1)-x(.75)}" height="${y(.75)-y(1)}"/><text class="depth-label" x="85" y="20">SHEAR PEAK / OFF SHEAR PEAK</text>`;
    for(const v of [.8,.9,1,1.1])out+=`<line class="depth-axis" x1="${x(v)}" x2="${x(v)}" y1="50" y2="310"/><line class="depth-axis" x1="85" x2="725" y1="${y(v)}" y2="${y(v)}"/><text text-anchor="middle" x="${x(v)}" y="337">${number(v,1)}</text><text text-anchor="end" x="70" y="${y(v)+4}">${number(v,1)}</text>`;
    out+=`<line x1="${x(1)}" x2="${x(1)}" y1="50" y2="310" stroke="currentColor" opacity=".5" stroke-dasharray="4 5"/><line x1="85" x2="725" y1="${y(1)}" y2="${y(1)}" stroke="currentColor" opacity=".5" stroke-dasharray="4 5"/><text class="depth-label" x="110" y="290">LOWER VISIBLE PEAKS IN BOTH</text><text text-anchor="middle" x="410" y="377">PRESSURE PEAK / OFF PRESSURE PEAK</text>`;
    keys.forEach(key=>{const px=x(peaks[key].pressure[1]/peaks.off.pressure[1]),py=y(peaks[key].shear[1]/peaks.off.shear[1]);out+=`<g role="button" tabindex="0" data-peak-case="${key}" aria-label="Select ${names[key]}"><circle cx="${px}" cy="${py}" r="${key===state.injector?10:7}" fill="${colours[key]}" stroke="${key===state.injector?'#fff':'none'}" stroke-width="1.5"/><text class="marker-label" x="${px+17}" y="${py+4}">${escape(names[key])}</text></g>`;});
    $('tradeoffChart').innerHTML=out;
    $('tradeoffChart').querySelectorAll('[data-peak-case]').forEach(b=>{const select=()=>setInjector(b.dataset.peakCase);b.addEventListener('click',select);b.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();select();}});});
    $('tradeoffTitle').textContent=names[state.injector];
    $('tradeoffReading').textContent={off:'The reference point is exactly one on both axes. Its prominent pressure and shear maxima occur away from the centre, so the axis alone would miss the main loading.',normal:'The visible pressure maximum is slightly lower, while the shear maximum is higher. The intervention changes the load distribution and does not improve both peak objectives.',canted:'Both visible radial-cut maxima are below the off case. This supports a favourable comparative trend in these figures, while the axis pressure and the injection resource cost need separate assessment.'}[state.injector];
    $('tradeoffValues').innerHTML=conditions([['Pressure peak change',signed(change(state.injector,'pressure'))+'% vs off'],['Shear peak change',signed(change(state.injector,'shear'))+'% vs off'],['Evidence','Approximate digitised line-cut maxima']]);
    $('peakComparison').innerHTML=keys.map(key=>`<tr class="${key===state.injector?'is-selected':''}"><td><button type="button" data-table-case="${key}" aria-pressed="${key===state.injector}">${escape(names[key])}</button></td>${['pressure','shear'].map(m=>`<td>≈ ${number(peaks[key][m][1],0)}</td><td>≈ ${number(peaks[key][m][0],3)}</td><td>${signed(change(key,m))}%</td>`).join('')}</tr>`).join('');
    $('peakComparison').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>setInjector(b.dataset.tableCase)));
  }
  function loadChart(metric){
    const delta=mode==='difference',w=650,h=370,left=65,right=628,top=42,bottom=310;
    const series=Object.fromEntries(keys.map(k=>[k,delta?differenceSeries(data.injectors[k][metric],data.injectors.off[metric]):data.injectors[k][metric]]));
    const nonnull=Object.values(series).flat().filter(p=>p[1]!==null).map(p=>Math.abs(p[1]));
    const cap=delta?Math.ceil(Math.max(...nonnull)/(metric==='pressure'?500:10))*(metric==='pressure'?500:10):(metric==='pressure'?10000:250);
    const low=delta?-cap:0,high=cap,x=v=>left+v/.35*(right-left),y=v=>bottom-(v-low)/(high-low)*(bottom-top);
    let out=`<text class="svg-label" x="65" y="20">${delta?'CHANGE VS OFF / Δ':'SURFACE '}${metric==='pressure'?'PRESSURE / Pa':'SHEAR / Pa'}</text>`;
    for(let i=0;i<=4;i++){const v=low+(high-low)*i/4;out+=`<line class="grid" x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}"/><text text-anchor="end" x="54" y="${y(v)+4}">${number(v,0)}</text>`;}
    for(let i=0;i<=7;i++)out+=`<text text-anchor="middle" x="${x(i*.05)}" y="335">${number(i*.05,2)}</text>`;
    if(delta)out+=`<line x1="${left}" x2="${right}" y1="${y(0)}" y2="${y(0)}" stroke="#dce6d5" opacity=".7"/>`;
    for(const key of keys.filter(k=>k!==state.injector).concat(state.injector))out+=`<path d="${seriesPath(series[key],x,y)}" fill="none" stroke="${colours[key]}" stroke-width="${key===state.injector?3:1.4}" opacity="${key===state.injector?1:.5}"/>`;
    out+=`<line x1="${x(state.radius)}" x2="${x(state.radius)}" y1="${top}" y2="${bottom}" stroke="#ead4b7" stroke-dasharray="4 5"/><text class="svg-label" text-anchor="middle" x="350" y="365">RADIUS FROM PLUME AXIS / m</text>`;
    const sample=nearestVisible(series[state.injector],state.radius);if(sample)out+=`<circle cx="${x(sample[0])}" cy="${y(sample[1])}" r="5" fill="${colours[state.injector]}"/>`;
    $(metric+'Chart').innerHTML=out;
  }
  function loads(){
    $('radiusValue').textContent=number(state.radius,3)+' m';mark('[data-load-mode]','loadMode',mode);
    for(const metric of ['pressure','shear'])loadChart(metric);
    const p=nearestVisible(data.injectors[state.injector].pressure,state.radius),s=nearestVisible(data.injectors[state.injector].shear,state.radius);
    $('loadReadouts').innerHTML=stat('PRESSURE NEAR THE PROBE',p?'≈ '+number(p[1],0)+' Pa':'Curve obscured',p?'Source sample at '+number(p[0],4)+' m':'No nearby visible source pixels')+stat('SHEAR NEAR THE PROBE',s?'≈ '+number(s[1],0)+' Pa':'Curve obscured',s?'Source sample at '+number(s[0],4)+' m':'No nearby visible source pixels')+stat('VISIBLE PRESSURE PEAK','≈ '+number(peaks[state.injector].pressure[1],0)+' Pa','Approximate radial-cut maximum')+stat('VISIBLE SHEAR PEAK','≈ '+number(peaks[state.injector].shear[1],0)+' Pa','Approximate radial-cut maximum');
    $('probeComparison').innerHTML=keys.map(key=>`<tr class="${key===state.injector?'is-selected':''}"><td><button type="button" data-probe-case="${key}">${escape(names[key])}</button></td>${['pressure','shear'].map(m=>{const sample=nearestVisible(data.injectors[key][m],state.radius);return `<td>${sample?'≈ '+number(sample[1],0):'Obscured'}</td><td>${sample?number(sample[0],4):'—'}</td>`;}).join('')}</tr>`).join('');
    $('probeComparison').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>setInjector(b.dataset.probeCase)));
    $('probeReading').textContent=state.radius<.015?'Near the axis, both active-injection pressure traces are above the off trace. A favourable off-axis peak does not imply reduced loading at the centre.':state.radius>.16?'In the outer sampled region, inspect secondary features and the decay of the wall-loading profile. Source overlap can hide parts of a curve; blank values are not zero.':'This cut crosses the prominent off-axis loading region. Compare peak position, magnitude and local changes separately; pressure and shear maxima do not have to share a radius.';
    $('loadModeReading').textContent=mode==='absolute'?'Absolute source-trace values. The probe table compares all configurations in original units.':'Change from off at matching visible source coordinates: negative means a lower value, positive a higher value. Hidden parts of either trace remain gaps. The probe table below retains absolute values.';
    tradeoff();
  }
  document.querySelectorAll('[data-load-mode]').forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.loadMode;loads();}));
  $('exportLoadData').addEventListener('click',()=>{
    let csv='configuration,quantity,radius_m,approx_value_Pa,evidence\r\n';
    for(const key of keys)for(const metric of ['pressure','shear'])for(const [r,v]of data.injectors[key][metric])csv+=`${key},${metric},${r},${v===null?'':v},digitised_report_curve_not_raw_CFD\r\n`;
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='hypersonic-approximate-digitised-load-curves.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  function geometryChanged(){
    if(previousCase!==state.case){$('ambientPressure').value=ambient[state.case];previousCase=state.case;if(!(route==='injector'&&state.case==='msl'))route=state.case;drawRoute();}
    budget();if(shockFromExit){const exit=reference().mach;$('shockMach').max=Math.max(10,Math.ceil(exit));$('shockMach').value=exit;}shock();
  }
  geometryChanged();mesh();loads();showCode('export');
  return {geometryChanged,mesh,loads};
}
