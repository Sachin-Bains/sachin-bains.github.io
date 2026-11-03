'use strict';
// V3: relational system, graph traversal, coordinated exploration and synthetic experimental instruments.
// MSc evidence is bounded to inspected source and stored experiments; other records remain provisional.
const projects = [
  {id:'turbulence', title:'Learning turbulent flow', shorthand:'TURBULENCE / ML SURROGATE', area:'machine', meta:'MSc RESEARCH / ML / UNCERTAINTY', tags:['fluid','numerical','uncertainty','data'], summary:'Original MSc research into physics-gated turbulent-flow models: six model families, wall-resolved evaluation, predictive uncertainty and reproducible experimental evidence.', details:'The flagship monograph connects the full dissertation to a source-linked implementation architecture, six-family model comparison and original plates, formal wall-band methodology, primary learning curves and a linked 3D/2D diagnostic workbench from original ensemble arrays. It separates source-checked experiments, thesis-reported results and the proposed evaluation protocol.', evidence:'The full Overleaf manuscript, public repository lineage, primary split indices, complete baseline/dropout learning histories and saved ensemble arrays have been reviewed. Displayed smoke metrics were recomputed. Additional manuscript calibration and physics-gate results are labelled as reported; cross-Reynolds completion remains unestablished.'},
  {id:'hypersonic', title:'Hypersonic jet impingement', shorthand:'COMPRESSIBLE FLOW / CFD', area:'flow', meta:'BEng RESEARCH / CFD / PLANETARY LANDING', tags:['fluid','numerical','systems'], summary:'Nozzle reconstruction, compressible CFD and fluidic injection for planetary landing. Explore the original geometry, saved velocity profiles and the pressure–shear trade-off.', details:'A separate research monograph connects McCabe geometry, the hot Martian descent nozzle and MSL-derived injector studies. Native instruments include rotatable geometry, ideal-flow calculations, original CSV velocity probes, reported mesh comparisons and coordinated off/perpendicular/canted field and loading views.', evidence:'Both complete reports and the supporting archive have been reviewed. Original CSVs drive geometry and velocity exhibits; surface-load curves are labelled approximate figure digitisation. Reported results, analytical references and outstanding native-case checks remain distinct.'},
  {id:'matching', title:'Limit order matching engine', shorthand:'C++20 / EXCHANGE SYSTEMS', area:'markets', meta:'C++20 / ALGORITHMS / MARKET MICROSTRUCTURE', tags:['algorithms','systems','optimisation'], summary:'A C++20 exchange-style matching engine exploring order handling, market mechanics and implementation correctness.', details:'A deterministic C++20 core compiled to WebAssembly: limit orders, price–time priority, partial fills, cancellation, bounded intrusive storage and sequence-numbered events. The laboratory connects the actual book, queues and recycled slots to each command.', evidence:'October 2026 reconstruction. Native/reference tests, 50,000 generated commands, allocation instrumentation, native/WebAssembly replay parity, source download and local benchmark distributions. Historical source and historical performance are not claimed.'},
  {id:'market', title:'Market-making research', shorthand:'EXECUTION / RISK MODELS', area:'markets', meta:'PYTHON / QUANTITATIVE FINANCE', tags:['uncertainty','optimisation','data','algorithms'], summary:'Computational research into crypto market making, exploring execution, simulated strategy behaviour and risk under changing market conditions.', details:'Hypotheses, data source and assumptions, quote-setting logic, inventory exposure, transaction costs, evaluation approach, sensitivity and limitations.', evidence:'Python notebooks and scripts, data provenance, source market data where permitted, experiment summaries, validated metrics and risk analyses.'},
  {id:'uav', title:'Aircraft systems & design', shorthand:'UAV / SAFETY / ENGINEERING', area:'flow', meta:'AEROSPACE / MULTIDISCIPLINARY DESIGN', tags:['systems','numerical','optimisation'], summary:'Aircraft and fixed-wing UAV engineering work across technical requirements, multidisciplinary constraints, system integration and safety.', details:'Individual studies may be separated into UAV safety, aircraft performance, propulsion and hydrogen-electric design after the original reports and group contributions are reviewed.', evidence:'Design reports, requirements, calculations, trade-off studies, CAD/drawings and accurate personal contribution records.'},
  {id:'software', title:'Applied computational systems', shorthand:'SOFTWARE / PRODUCT ENGINEERING', area:'machine', meta:'SOFTWARE / SYSTEM DESIGN / IMPLEMENTATION', tags:['systems','data','algorithms'], summary:'A developing selection of implemented computational and software systems, curated for architectural quality and demonstrable engineering.', details:'Architecture, decisions, code quality, tests, actual user-visible behaviour and deployment evidence. Proposals and works in progress must never be presented as delivered.', evidence:'Verifiable repositories, test cases, demos, screenshots, deployment records and attribution of work.'}
];
const domains={
  all:{name:'ALL SYSTEMS',code:'S / ALL DISCIPLINES',number:'00',accent:'#9cbaaa',aside:'Nothing exists in isolation.',body:'Systems are connected by the tools used to understand them: modelling, numerical methods, implementation and verification.',words:['models','decisions','verification']},
  flow:{name:'FLUID & FLIGHT',code:'F / PHYSICAL SYSTEMS',number:'01',accent:'#97b9ba',aside:'Make the invisible legible.',body:'Compressible flow, physical constraints and numerical modelling turn complex dynamics into something we can interrogate.',words:['flow physics','CFD','systems']},
  machine:{name:'MACHINE INTELLIGENCE',code:'M / LEARNED MODELS',number:'02',accent:'#b7c29e',aside:'A prediction is a claim.',body:'Learning a physical system demands more than an accurate estimate: assumptions, calibration and credible validation matter.',words:['ML surrogates','uncertainty','data']},
  markets:{name:'QUANTITATIVE SYSTEMS',code:'Q / COMPUTATIONAL MARKETS',number:'03',accent:'#ceb796',aside:'Precision under uncertainty.',body:'Data structures, market mechanics, simulated decisions and risk management are all systems questions.',words:['C++','microstructure','optimisation']}
};
const concepts=[
  {id:'fluid',name:'FLOW PHYSICS',short:'PHYSICS',x:18,y:28,desc:'The physical behaviour of fluids, from compressible high-speed flow to turbulent dynamics.'},
  {id:'numerical',name:'NUMERICAL METHODS',short:'NUMERICAL',x:49,y:20,desc:'Numerical approximation, simulation and computational solution strategies for problems without closed-form answers.'},
  {id:'uncertainty',name:'UNCERTAINTY',short:'UNCERTAINTY',x:79,y:30,desc:'What a model does not know, how confidence is assessed, and the limits of a prediction or decision.'},
  {id:'systems',name:'SYSTEMS DESIGN',short:'SYSTEMS',x:25,y:52,desc:'Requirements, architecture, interface boundaries and correctness across interacting components.'},
  {id:'algorithms',name:'ALGORITHMS',short:'ALGORITHMS',x:74,y:57,desc:'Precisely specified computational procedures, execution behaviour and design choices.'},
  {id:'optimisation',name:'OPTIMISATION',short:'OPTIMISATION',x:30,y:79,desc:'Trade-offs under constraints, from aircraft configurations to strategy design.'},
  {id:'data',name:'DATA PIPELINES',short:'DATA',x:75,y:81,desc:'Preparing, validating and interpreting the information that drives computational experiments.'}
];
const conceptEdges=[['fluid','numerical'],['fluid','uncertainty'],['numerical','uncertainty'],['numerical','systems'],['numerical','optimisation'],['uncertainty','data'],['uncertainty','optimisation'],['systems','algorithms'],['systems','optimisation'],['algorithms','optimisation'],['algorithms','data']];
const state={domain:'all',concept:null,focused:null,hoverConcept:null,hoverProject:null,atlasView:'methods',trace:null,calibration:90,orderSide:'buy',frame:0,mouse:{x:0,y:0},motion:!matchMedia('(prefers-reduced-motion: reduce)').matches};
const el=id=>document.getElementById(id);
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function selectedProjects(){return projects.filter(p=>(state.domain==='all'||p.area===state.domain)&&(!state.concept||p.tags.includes(state.concept))&&(!state.trace||state.trace.path.includes('P:'+p.id)))}
function setDomain(id){if(!domains[id])return;state.domain=id;state.concept=null;state.trace=null;state.focused=null;state.hoverConcept=null;state.hoverProject=null;sync()}
function setConcept(id){if(id!==null&&!concepts.some(c=>c.id===id))return;state.domain='all';state.trace=null;state.atlasView='methods';state.concept=state.concept===id?null:id;state.focused=null;state.hoverConcept=null;state.hoverProject=null;sync()}
function getAttention(){const p=projects.find(p=>p.id===(state.hoverProject||state.focused));return p?p.tags:(state.hoverConcept||state.concept)?[(state.hoverConcept||state.concept)]:state.trace?state.trace.path.filter(x=>x.startsWith('C:')).map(x=>x.slice(2)):[]}
function sync(){const mode=domains[state.domain];document.documentElement.style.setProperty('--tone',mode.accent);
  document.querySelectorAll('.field-choice').forEach(b=>{const on=b.dataset.domain===state.domain;b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on))});
  const lens=concepts.find(c=>c.id===state.concept);el('visualIndex').textContent=state.trace?'∞':lens?'L'+String(concepts.indexOf(lens)+1):mode.number;el('visualName').textContent=state.trace?'CONNECTED':lens?lens.short:mode.name;el('machineMode').textContent=state.trace?'TRACE / TWO STUDIES / SHARED IDEAS':lens?'L / '+lens.name+' / CROSS-DOMAIN':mode.code;el('asideCode').textContent=mode.number+' / 03';
  renderProjects();drawAtlas();renderInspector();renderContext();drawField();
  document.querySelectorAll('.atlas-mode').forEach(b=>{const active=b.dataset.view===state.atlasView;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active))});
  el('atlasCount').textContent=state.atlasView==='methods'?'/ 07 CONCEPTS':'/ 06 PROJECTS';
}
function renderProjects(){const visible=selectedProjects();el('selectionLabel').textContent=state.trace?'TRACED RELATIONSHIP / ASSOCIATED STUDIES':state.concept?`CONNECTED METHOD / ${concepts.find(c=>c.id===state.concept).name}`:`${domains[state.domain].name} / SELECTED RECORDS`;
  el('entryCount').textContent=String(visible.length).padStart(2,'0')+' PROJECTS';
  if(!visible.length){el('projectIndex').innerHTML='<p class="empty-projects">No entries match this selection. Clear the concept or change discipline.</p>';return}
  el('projectIndex').innerHTML=visible.map((p,i)=>`<button type="button" class="project-row ${state.focused===p.id?'is-target':''}" data-project="${p.id}"><span class="project-no">${String(i+1).padStart(2,'0')}</span><span><span class="project-title">${safe(p.title)}</span><span class="project-tag">${safe(p.meta)}</span><span class="project-relations">${p.tags.slice(0,3).map(t=>`<span>${safe(concepts.find(c=>c.id===t).short)}</span>`).join('')}</span></span><span class="project-arrow">↗</span></button>`).join('');
  el('projectIndex').querySelectorAll('.project-row').forEach(button=>{button.addEventListener('mouseenter',()=>focusProject(button.dataset.project));button.addEventListener('mouseleave',()=>focusProject(null));button.addEventListener('focus',()=>focusProject(button.dataset.project));button.addEventListener('blur',()=>focusProject(null));button.addEventListener('click',()=>openDossier(button.dataset.project))});
}
function focusProject(id){state.focused=id;el('projectIndex').querySelectorAll('.project-row').forEach(b=>{b.classList.toggle('is-target',b.dataset.project===id);b.classList.toggle('is-dim',Boolean(id)&&b.dataset.project!==id)});drawAtlas();renderContext();drawField()}
function renderContext(){const active=projects.find(p=>p.id===(state.hoverProject||state.focused)),concept=concepts.find(c=>c.id===(state.hoverConcept||state.concept)),d=domains[state.domain];
  el('contextEyebrow').textContent=active?'PROJECT IN FOCUS':concept?'CONNECTION IN FOCUS':state.trace?'RELATIONSHIP TRACED':'A COMMON METHODOLOGY';
  el('contextTitle').textContent=active?active.title:concept?concept.name.toLowerCase()+'.':state.trace?'A route through the archive.':d.aside;
  el('contextText').textContent=active?active.summary:concept?concept.desc:state.trace?'A conceptual pathway between two studies is now highlighted in the atlas.':d.body;
  const tags=active?active.tags:concept?[concept.id]:d.words;
  el('contextTags').innerHTML=tags.map(t=>{const c=concepts.find(c=>c.id===t);return c?`<button type="button" data-concept="${c.id}" title="Explore connected projects">${safe(c.short)} ↗</button>`:`<span>${safe(t)}</span>`}).join('');
  el('contextTags').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{setConcept(b.dataset.concept);el('connections').scrollIntoView({behavior:state.motion?'smooth':'instant',block:'start'})}));
  const points=[[205,40],[85,104],[336,104],[112,239],[307,232],[205,152]];
  const highlighted=getAttention();let lines='';
  for(const [a,b] of [[0,5],[1,5],[2,5],[3,5],[4,5],[0,2],[1,3],[2,4],[3,4]]){
    const opacity=highlighted.length?.54:.27;
    lines+=`<path d="M${points[a].join(',').replace(',',' ')} Q 205 146 ${points[b].join(' ')}" fill="none" stroke="${d.accent}" opacity="${opacity}" stroke-width="1.0"/>`;
  }
  const dots=points.map(([x,y],i)=>`<g><circle cx="${x}" cy="${y}" r="${i===5?8:4.7}" fill="${d.accent}" opacity="${i===5?1:.6}"/><circle cx="${x}" cy="${y}" r="${i===5?25:13}" fill="none" stroke="${d.accent}" opacity=".25" stroke-width=".8"/></g>`).join('');
  const labels=['METHOD','MODELLING','UNCERTAINTY','DESIGN','ALGORITHMS','VERIFY'];
  const text=points.map(([x,y],i)=>`<text x="${x}" y="${y+(i===0?30:i===3||i===4?-20:27)}" text-anchor="middle" fill="#a5b7a8" opacity=".83" font-size="9" font-family="monospace">${labels[i]}</text>`).join('');
  el('contextSvg').innerHTML=`<ellipse cx="207" cy="145" rx="145" ry="104" fill="none" stroke="#54675a" stroke-width=".7"/><ellipse cx="207" cy="145" rx="97" ry="139" fill="none" stroke="#46594e" stroke-width=".7" transform="rotate(30 207 145)"/>${lines}${dots}${text}`;
}
const projectPositions={turbulence:{x:21,y:23},hypersonic:{x:68,y:20},matching:{x:79,y:54},market:{x:64,y:82},uav:{x:20,y:79},software:{x:43,y:52}};
const projectShort={turbulence:'TURBULENCE / ML',hypersonic:'HYPERSONIC CFD',matching:'MATCHING ENGINE',market:'MARKET MAKING',uav:'AIRCRAFT SYSTEMS',software:'COMPUTATIONAL SYSTEMS'};
function getTraceNodes(){return new Set(state.trace?state.trace.path:[])}
function setAtlasHover(type,id){state.hoverConcept=type==='methods'?id:null;state.hoverProject=type==='projects'?id:null;renderInspector();renderContext();drawField()}
function clearExploration(){state.concept=null;state.trace=null;state.focused=null;state.hoverProject=null;state.hoverConcept=null;state.domain='all';state.atlasView='methods';el('pathResult').textContent='SELECT TWO PROJECTS TO REVEAL THE UNDERLYING RELATIONSHIP.';sync()}
function drawAtlas(){
  const mode=state.atlasView,trace=getTraceNodes(),attention=getAttention(),method=state.hoverConcept||state.concept,focused=state.hoverProject||state.focused;
  const highlighted=new Set(attention);
  if(method)conceptEdges.filter(e=>e.includes(method)).forEach(e=>e.forEach(c=>highlighted.add(c)));
  const muted=Boolean(method||focused||state.trace),map=new Map(concepts.map(c=>[c.id,c]));
  let lines='',nodes='';
  if(mode==='methods'){
    lines=conceptEdges.map(([a,b])=>{const A=map.get(a),B=map.get(b),pathHit=state.trace&&state.trace.path.some((n,i)=>n==='C:'+a&&state.trace.path[i+1]==='C:'+b||n==='C:'+b&&state.trace.path[i+1]==='C:'+a),hi=(method&&(a===method||b===method))||(!method&&(highlighted.has(a)&&highlighted.has(b)));return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" class="atlas-edge ${pathHit?'on-path':hi?'is-highlighted':''}" opacity="${pathHit?1:muted&&!hi?.12:hi?.74:.37}" vector-effect="non-scaling-stroke"/>`}).join('');
    nodes=concepts.map((c,i)=>{const active=method===c.id,linked=highlighted.has(c.id)||trace.has('C:'+c.id);return `<button type="button" data-concept="${c.id}" class="atlas-node ${active?'is-active':''} ${linked?'is-linked':''} ${muted&&!linked?'is-muted':''} ${trace.has('C:'+c.id)?'is-on-path':''}" aria-pressed="${state.concept===c.id}" style="left:${c.x}%;top:${c.y}%"><i aria-hidden="true"></i><span>${String(i+1).padStart(2,'0')} / ${safe(c.name)}</span></button>`}).join('');
    if(state.trace){const first=state.trace.path[1],last=state.trace.path[state.trace.path.length-2],a=first?.startsWith('C:')?map.get(first.slice(2)):null,b=last?.startsWith('C:')?map.get(last.slice(2)):null;const start={x:9,y:64},finish={x:91,y:71};
      if(a)lines+=`<path class="atlas-edge on-path" d="M ${start.x} ${start.y} L ${a.x} ${a.y}" vector-effect="non-scaling-stroke"/>`;
      if(b)lines+=`<path class="atlas-edge on-path" d="M ${b.x} ${b.y} L ${finish.x} ${finish.y}" vector-effect="non-scaling-stroke"/>`;
      nodes+=`<div class="atlas-endpoint" style="left:${start.x}%;top:${start.y}%"><small>START / 01</small>${safe(projectShort[state.trace.from])}</div><div class="atlas-endpoint" style="left:${finish.x}%;top:${finish.y}%"><small>END / 02</small>${safe(projectShort[state.trace.to])}</div>`;
    }
    el('atlasCaption').textContent=state.trace?'SHORTEST CURATED CONCEPTUAL ROUTE / SELECT A NODE': 'METHODOLOGICAL RELATIONSHIPS / CURATED';
  }else{
    const seen=new Set();lines=projects.flatMap((p,i)=>projects.slice(i+1).map(q=>{const overlap=p.tags.filter(tag=>q.tags.includes(tag));if(!overlap.length)return '';seen.add(p.id);seen.add(q.id);const A=projectPositions[p.id],B=projectPositions[q.id],hi=focused&&(p.id===focused||q.id===focused);return `<line class="atlas-edge ${hi?'is-highlighted':''}" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" opacity="${focused&&!hi?.08:hi?.9:.21+.07*overlap.length}" vector-effect="non-scaling-stroke"/>`})).join('');
    nodes=projects.map((p,i)=>{const pt=projectPositions[p.id],active=focused===p.id,related=focused?projects.find(q=>q.id===focused)?.tags.some(t=>p.tags.includes(t)):true;return `<button class="atlas-node atlas-project-node ${active?'is-active':''} ${active||related?'is-linked':'is-muted'}" style="left:${pt.x}%;top:${pt.y}%" data-atlas-project="${p.id}" aria-label="Inspect ${safe(p.title)}"><i></i><span>${String(i+1).padStart(2,'0')} / ${safe(projectShort[p.id])}</span></button>`}).join('');
    el('atlasCaption').textContent='PROJECT RELATIONSHIPS / LINKED BY SHARED METHODS';
  }
  el('atlasLinks').innerHTML=lines;el('atlasNodes').innerHTML=nodes;
  el('atlasNodes').querySelectorAll('button[data-concept]').forEach(b=>{b.addEventListener('mouseenter',()=>setAtlasHover('methods',b.dataset.concept));b.addEventListener('mouseleave',()=>setAtlasHover('methods',null));b.addEventListener('focus',()=>setAtlasHover('methods',b.dataset.concept));b.addEventListener('blur',()=>setAtlasHover('methods',null));b.addEventListener('click',()=>setConcept(b.dataset.concept))});
  el('atlasNodes').querySelectorAll('button[data-atlas-project]').forEach(b=>{b.addEventListener('mouseenter',()=>setAtlasHover('projects',b.dataset.atlasProject));b.addEventListener('mouseleave',()=>setAtlasHover('projects',null));b.addEventListener('focus',()=>setAtlasHover('projects',b.dataset.atlasProject));b.addEventListener('blur',()=>setAtlasHover('projects',null));b.addEventListener('click',()=>openDossier(b.dataset.atlasProject))});
  el('atlasStatus').textContent=state.trace?'ROUTE RESOLVED / EXPLORE CONCEPTS OR ASSOCIATED PROJECTS':mode==='projects'?'HOVER A STUDY TO ILLUMINATE SHARED METHODS':method?'EXPLORING / '+map.get(method).name:'SELECT A CONCEPT TO INVESTIGATE ITS RELATIONSHIPS';
}
function renderInspector(){
  const id=state.hoverConcept||state.concept,concept=concepts.find(c=>c.id===id),proj=projects.find(p=>p.id===(state.hoverProject||(state.atlasView==='projects'?state.focused:null)));let relevant=[];
  if(state.trace&&!concept&&!proj&&state.atlasView==='methods'){
    el('inspectorNumber').textContent='∞';el('inspectorTitle').textContent='a chain of ideas.';
    el('inspectorDescription').textContent=`${projects.find(p=>p.id===state.trace.from).title} → ${projects.find(p=>p.id===state.trace.to).title}. The highlighted route uses curated conceptual links, not a direct technical dependency.`;
    relevant=projects.filter(p=>state.trace.path.includes('P:'+p.id));
  }else if(proj){
    el('inspectorNumber').textContent=String(projects.indexOf(proj)+1).padStart(2,'0');el('inspectorTitle').textContent=proj.title.toLowerCase()+'.';el('inspectorDescription').textContent=proj.summary;
    relevant=projects.filter(p=>p.id!==proj.id&&p.tags.some(t=>proj.tags.includes(t))).sort((a,b)=>b.tags.filter(t=>proj.tags.includes(t)).length-a.tags.filter(t=>proj.tags.includes(t)).length).slice(0,4);
  }else{
    el('inspectorNumber').textContent=concept?String(concepts.indexOf(concept)+1).padStart(2,'0'):'—';
    el('inspectorTitle').textContent=concept?concept.name.toLowerCase()+'.':state.atlasView==='projects'?'Select a study.':'Select a connection.';
    el('inspectorDescription').textContent=concept?concept.desc:state.atlasView==='projects'?'Move between studies to see how common methods connect otherwise different projects.':'Follow a methodological connection and see the work it touches, including projects across different disciplines.';
    relevant=concept?projects.filter(p=>p.tags.includes(concept.id)):[];
  }
  el('inspectorProjects').innerHTML=relevant.length?relevant.map(p=>`<button type="button" data-dossier="${p.id}">${safe(p.title)} <span>↗</span></button>`).join(''):'<span class="muted-detail">Choose a node to investigate.</span>';
  el('inspectorProjects').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>openDossier(b.dataset.dossier)));
  el('viewRelated').disabled=!(concept||proj||state.trace);
  const caption=el('viewRelated');caption.firstChild.textContent=proj?'VIEW CONNECTED WORK ':state.trace?'VIEW TRACED WORK ':'VIEW RELATED WORK ';
}
function openDossier(id){const p=projects.find(p=>p.id===id);if(!p)return;state.focused=id;el('dossierRecord').textContent='DOSSIER / '+String(projects.indexOf(p)+1).padStart(3,'0');el('dossierLabel').textContent=p.meta;el('dossierTitle').textContent=p.title;el('dossierSummary').textContent=p.summary;el('dossierDetails').textContent=p.details;el('dossierEvidence').textContent=p.evidence;
  const research=p.id==='turbulence',matching=p.id==='matching',hypersonic=p.id==='hypersonic',implemented=research||matching||hypersonic;
  const dividers=el('dossier').querySelectorAll('.dossier-section-divider');
  dividers[0].lastElementChild.textContent=implemented?'SOURCE REVIEWED / BOUNDED EVIDENCE':'PROVISIONAL RECORD';
  dividers[1].lastElementChild.textContent=matching?'NEW C++ IMPLEMENTATION VERIFIED':(research||hypersonic)?'ORIGINAL FILES INSPECTED':'SOURCE MATERIAL NEEDED';
  const headings=el('dossier').querySelectorAll('.dossier-main h3');
  headings[0].textContent=implemented?'The implemented investigation':'What the technical case study will investigate';
  headings[1].textContent=implemented?'Evidence and remaining limits':'What we need to substantiate';
  el('dossier').querySelector('.dossier-caveat').textContent=hypersonic?'Original coordinates and velocity profiles support native instruments. The injector pressure/shear curves are approximate digitisation; reported mitigation percentages and native-case bindings require reconciliation.':matching?'This is a new October 2026 reconstruction of the documented design. Its tests and measurements belong to the new implementation; the original 2025 source is unavailable.':research?'The full dossier separates checked saved outputs from research intent and unresolved provenance. It does not claim DNS replacement, primary-dataset performance or achieved conformal guarantees.':'This is a visual and interaction prototype. Research metrics, results, implementation details and individual contributions will only be published after verifying original files and source code.';
  let entry=el('dossierResearch');if(entry)entry.remove();
  if(implemented){entry=document.createElement('a');entry.id='dossierResearch';entry.className='research-entry';entry.href=hypersonic?'hypersonic.html':matching?'matching-engine.html':'turbulence.html';entry.textContent=hypersonic?'ENTER THE HYPERSONIC RESEARCH / GEOMETRY, FLOW & SURFACE LOADS ↗':matching?'ENTER THE C++ MATCHING ENGINE / LIVE EXECUTION & VERIFICATION ↗':'ENTER THE RESEARCH / IMPLEMENTATION, EXPERIMENTS & 3D FIELDS ↗';el('dossierSummary').after(entry)}

  el('dossierConcepts').innerHTML=p.tags.map(t=>`<button type="button" data-concept="${t}">${safe(concepts.find(c=>c.id===t).name)} ↗</button>`).join('');
  el('dossierConcepts').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{el('dossier').close();setConcept(b.dataset.concept);el('connections').scrollIntoView({behavior:state.motion?'smooth':'instant'})}));
  const related=projects.filter(q=>q.id!==p.id).map(q=>({p:q,shared:q.tags.filter(t=>p.tags.includes(t))})).filter(q=>q.shared.length).sort((a,b)=>b.shared.length-a.shared.length).slice(0,3);
  el('dossierRelated').innerHTML=related.map(({p:q,shared})=>`<button type="button" data-related="${q.id}"><span>${safe(q.title)}<small>${shared.map(t=>safe(concepts.find(c=>c.id===t).short)).join(' / ')}</small></span><span>↗</span></button>`).join('')+(p.id==='matching'?'<a href="#laboratory" id="dossierLab">OPEN ILLUSTRATIVE ORDER-BOOK LABORATORY <span>↗</span></a>':'')+(p.id==='turbulence'?'<a href="#calibration" id="dossierCalib">OPEN SYNTHETIC CALIBRATION EXHIBIT <span>↗</span></a>':'');
  el('dossierRelated').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{el('dossier').scrollTo({top:0,behavior:state.motion?'smooth':'instant'});openDossier(b.dataset.related)}));
  const labLink=el('dossierLab');if(labLink)labLink.addEventListener('click',()=>el('dossier').close());const calLink=el('dossierCalib');if(calLink)calLink.addEventListener('click',()=>el('dossier').close());
  if(!el('dossier').open)el('dossier').showModal();drawAtlas();renderContext();drawField();
}
// Procedural illustration. Geometry changes by domain; it is explicitly NOT user research data.
const canvas=el('fieldCanvas'),ctx=canvas.getContext('2d',{alpha:false});let cw=1,ch=1,observed=true;
function sizeCanvas(){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;const d=Math.min(devicePixelRatio||1,2);cw=r.width;ch=r.height;canvas.width=Math.round(cw*d);canvas.height=Math.round(ch*d);ctx.setTransform(d,0,0,d,0,0);drawField()}
function drawField(){if(!cw||!ch)return;const d=domains[state.domain],cx=cw*.51,cy=ch*.50,t=state.motion?state.frame*.008:0;
  ctx.fillStyle='#151d1a';ctx.fillRect(0,0,cw,ch);
  const glow=ctx.createRadialGradient(cx,cy,9,cx,cy,cw*.6);glow.addColorStop(0,d.accent+'28');glow.addColorStop(1,'#151d1a00');ctx.fillStyle=glow;ctx.fillRect(0,0,cw,ch);
  ctx.strokeStyle='#adbfad2e';ctx.lineWidth=.6;for(let i=1;i<=10;i++){const x=i*cw/11;ctx.beginPath();ctx.moveTo(x,40);ctx.lineTo(x,ch-40);ctx.stroke()}
  for(let i=1;i<=10;i++){const y=i*ch/11;ctx.beginPath();ctx.moveTo(25,y);ctx.lineTo(cw-25,y);ctx.stroke()}
  ctx.save();ctx.beginPath();ctx.rect(23,45,cw-46,ch-90);ctx.clip();
  const focusBoost=state.focused?1.17:1,period=t*.3,amp=(state.concept?1.3:1)*(1+(state.calibration-90)*.006);
  if(state.domain==='flow'){
    for(let row=-43;row<=43;row++){ctx.beginPath();for(let i=0;i<=110;i++){const s=i/110,x=cw*(.02+.96*s),envelope=Math.sin(Math.PI*s),deflection=Math.sin(s*6+period+row*.038)*64*envelope*focusBoost+Math.cos(s*11+row*.18)*11*envelope,y=cy+row*ch*.010+deflection+state.mouse.y*26*envelope;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)}ctx.strokeStyle=d.accent;ctx.globalAlpha=(.10+(1-Math.abs(row)/44)*.32)*amp;ctx.lineWidth=row%9===0?1.25:.55;ctx.stroke()}
  }else if(state.domain==='machine'){
    for(let ring=1;ring<=22;ring++){const rad=ring*13;ctx.beginPath();for(let i=0;i<=160;i++){const a=i/160*Math.PI*2,warp=Math.sin(a*5+ring*.27+period)*11+Math.cos(a*3+ring*.21)*8,rx=(rad+warp)*1.11,ry=(rad+warp)*.72,x=cx+Math.cos(a)*rx,y=cy+Math.sin(a)*ry;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)}ctx.closePath();ctx.globalAlpha=.08+(1-ring/23)*.26;ctx.strokeStyle=d.accent;ctx.lineWidth=.75;ctx.stroke()}
    for(let j=0;j<15;j++){const a=j*Math.PI*2/15+period*.17;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*cw*.48,cy+Math.sin(a)*ch*.41);ctx.globalAlpha=.14;ctx.stroke()}
  }else if(state.domain==='markets'){
    for(let i=0;i<49;i++){const k=i/48,level=cy+(k-.5)*ch*.9;ctx.beginPath();for(let j=0;j<=34;j++){const px=cw*(.04+j/34*.94),wave=Math.sin((j*13+i*17)*.81+Math.floor(t*.3))*12,py=level+wave*(.25+Math.cos(k*Math.PI)**2);if(j===0)ctx.moveTo(px,py);else{ctx.lineTo(px,py);if(j<34)ctx.lineTo(px+cw*.94/34,py)}}ctx.globalAlpha=.10+(1-Math.abs(k-.5)*2)*.29;ctx.strokeStyle=d.accent;ctx.lineWidth=i%8===0?1.2:.62;ctx.stroke()}
    for(let i=0;i<14;i++){const x=cw*(.08+i*.064),height=(Math.sin(i*2.13)**2)*ch*.23;ctx.fillStyle=d.accent;ctx.globalAlpha=.17;ctx.fillRect(x,cy-height,2,height*2)}
  }else{
    for(let row=-38;row<=38;row++){const k=row/39;ctx.beginPath();for(let j=0;j<=130;j++){const s=j/130,x=cw*(.035+.93*s),envelope=Math.sin(Math.PI*s),sin=Math.sin(s*10+row*.055+period)*45*envelope,coil=Math.cos(s*21+row*.24-period*.4)*18*envelope,y=cy+k*ch*.30+sin+coil+state.mouse.y*19*envelope;if(j)ctx.lineTo(x,y);else ctx.moveTo(x,y)}ctx.globalAlpha=(.07+(1-Math.abs(k))*.27)*amp;ctx.strokeStyle=d.accent;ctx.lineWidth=row%11===0?1.2:.65;ctx.stroke()}
  }
  ctx.restore();ctx.globalAlpha=1;ctx.strokeStyle=d.accent+'77';ctx.lineWidth=.75;ctx.beginPath();ctx.moveTo(cx-16,cy);ctx.lineTo(cx+16,cy);ctx.moveTo(cx,cy-16);ctx.lineTo(cx,cy+16);ctx.stroke();
  ctx.fillStyle=d.accent;for(let i=0;i<10;i++){let x=cw*(.14+i*.075),y=cy+Math.sin(i*1.31+t*.5)*ch*.16;ctx.beginPath();ctx.arc(x,y,i%3===0?2:1.1,0,Math.PI*2);ctx.fill()}
}
// Explicitly illustrative order book, with per-order FIFO at equal price.
let book=[],eventLog=[],nextId=1,nextSequence=1;
const money=n=>Number(n).toFixed(2);
function resetBook(){nextId=1;nextSequence=1;book=[];eventLog=[];
  for(const [side,price,qty] of [['buy',99.98,120],['buy',99.98,75],['buy',99.97,210],['sell',100.02,140],['sell',100.03,180],['sell',100.04,100]])book.push({id:nextId++,sequence:nextSequence++,side,price,qty});
  eventLog.push('BOOK RESET / 6 RESTING ORDERS / DEMONSTRATION VALUES');renderBook();}
function submitOrder(side,price,qty){if(!['buy','sell'].includes(side)||!Number.isFinite(price)||!Number.isSafeInteger(qty)||price<=0||qty<1||qty>100000)return false;
  const order={id:nextId++,sequence:nextSequence++,side,price:Math.round(price*100)/100,qty},startQty=qty;
  let matches=0;while(order.qty>0){const offers=book.filter(x=>x.side!==side&&x.qty>0&&(side==='buy'?x.price<=order.price:x.price>=order.price)).sort((a,b)=>side==='buy'?a.price-b.price||a.sequence-b.sequence:b.price-a.price||a.sequence-b.sequence);if(!offers.length)break;
    const resting=offers[0],fill=Math.min(order.qty,resting.qty);resting.qty-=fill;order.qty-=fill;matches++;eventLog.unshift(`TRADE ${String(matches).padStart(2,'0')} / ${fill} @ ${money(resting.price)} / INCOMING #${order.id} → RESTING #${resting.id}`);
    if(resting.qty===0)book=book.filter(x=>x!==resting);
  }
  if(order.qty>0){book.push(order);eventLog.unshift(`RESTING / #${order.id} ${side.toUpperCase()} ${order.qty} @ ${money(order.price)} / QUEUED`)}
  else if(!matches)eventLog.unshift(`ORDER #${order.id} / NO EXECUTION`);
  if(matches)eventLog.unshift(`ORDER #${order.id} / ${startQty-order.qty} MATCHED${order.qty?', '+order.qty+' QUEUED':''}`);
  eventLog=eventLog.slice(0,20);renderBook();return true;}
function renderBook(){const bySide=side=>{const map=new Map();book.filter(o=>o.side===side).forEach(o=>{const key=money(o.price);const v=map.get(key)||{price:o.price,qty:0,count:0,orders:[]};v.qty+=o.qty;v.count++;v.orders.push(o.id);map.set(key,v)});return [...map.values()].sort((a,b)=>side==='buy'?b.price-a.price:a.price-b.price)};
  for(const side of ['buy','sell']){const levels=bySide(side),container=el(side==='buy'?'bids':'asks');container.innerHTML=levels.length?levels.map(x=>`<div class="book-row ${side}" style="--bar:${Math.min(100,x.qty/330*100)}%"><span>${money(x.price)} <small>×${x.count}</small></span><span>${x.qty}</span></div>`).join(''):'<p class="book-empty">NO RESTING LIQUIDITY</p>'}
  el('eventCount').textContent=String(eventLog.length).padStart(3,'0')+' EVENTS';el('labState').textContent=eventLog[0]?.startsWith('TRADE')||eventLog[0]?.includes('MATCHED')?'ORDER EXECUTED':'ENGINE READY';
  el('orderLog').innerHTML=eventLog.slice(0,6).map((line,i)=>`<p><span>${String(i+1).padStart(2,'0')}</span>${safe(line)}</p>`).join('');}
// The relationship tracer builds a small, explicit bipartite graph of projects and
// methods, plus carefully curated method-to-method conceptual links. It does not
// imply the real research proves any cross-project technical dependency.
function tracePath(from,to){
  const adjacency=new Map();const link=(a,b)=>{if(!adjacency.has(a))adjacency.set(a,new Set());if(!adjacency.has(b))adjacency.set(b,new Set());adjacency.get(a).add(b);adjacency.get(b).add(a)};
  concepts.forEach(c=>adjacency.set('C:'+c.id,new Set()));
  projects.forEach(p=>p.tags.forEach(t=>link('P:'+p.id,'C:'+t)));
  conceptEdges.forEach(([a,b])=>link('C:'+a,'C:'+b));
  const source='P:'+from,target='P:'+to,queue=[source],parent=new Map([[source,null]]);
  for(let i=0;i<queue.length;i++){
    const node=queue[i];if(node===target)break;
    for(const next of (adjacency.get(node)||[]))if(!parent.has(next)){parent.set(next,node);queue.push(next)}
  }
  if(!parent.has(target))return null;
  const path=[];for(let n=target;n!==null;n=parent.get(n))path.unshift(n);
  return path;
}
function traceRelationship(){
  const from=el('pathFrom').value,to=el('pathTo').value;
  if(from===to){el('pathResult').textContent='CHOOSE TWO DIFFERENT STUDIES TO TRACE A RELATIONSHIP.';return}
  const path=tracePath(from,to);
  if(!path){el('pathResult').textContent='NO CONCEPTUAL PATH FOUND FOR THESE STUDIES.';return}
  state.trace={from,to,path};state.domain='all';state.concept=null;state.focused=null;state.hoverConcept=null;state.hoverProject=null;state.atlasView='methods';sync();
  const label=key=>key.startsWith('P:')?projectShort[key.slice(2)]:concepts.find(c=>c.id===key.slice(2)).name;
  el('pathResult').innerHTML='<span class="mono path-result-head">RELATIONSHIP TRACE / '+String(path.length-1).padStart(2,'0')+' LINKS</span><div class="trace-steps">'+path.map((node,i)=>`<span class="trace-step ${node.startsWith('P:')?'is-study':''}">${safe(label(node))}</span>${i===path.length-1?'':'<span class="trace-arrow" aria-hidden="true">↗</span>'}`).join('')+'</div>';
  el('atlas').scrollIntoView({behavior:state.motion?'smooth':'instant',block:'center'});
}
for(const id of ['pathFrom','pathTo'])el(id).innerHTML=projects.map(p=>`<option value="${p.id}">${safe(p.title)}</option>`).join('');
el('pathFrom').value='turbulence';el('pathTo').value='matching';
el('traceBtn').addEventListener('click',traceRelationship);
for(const button of document.querySelectorAll('.atlas-mode'))button.addEventListener('click',()=>{state.atlasView=button.dataset.view;state.hoverConcept=null;state.hoverProject=null;sync()});
// A single reset action clears all of the connected exploration state.
el('clearConcept').replaceWith(el('clearConcept').cloneNode(true));el('clearConcept').addEventListener('click',clearExploration);

// An honest split-conformal teaching illustration: deterministic synthetic data,
// finite-sample quantile rank k=ceil((n+1)*(1-alpha)), disjoint calibration/holdout.
const trueSignal=x=>.83*Math.sin(2*Math.PI*x*.98)+.32*Math.cos(4*Math.PI*x+.22);
const modelSignal=x=>.73*Math.sin(2*Math.PI*x*.98)+.21*Math.cos(4*Math.PI*x+.22)+.09;
const perturb=(i,m)=>.22*Math.sin((i+1)*11.331+m*.71)+.15*Math.cos((i+1)*7.17+m*.37);
const cal=Array.from({length:80},(_,i)=>({x:(i+.43)/80,obs:trueSignal((i+.43)/80)+perturb(i,1)}));
const hold=Array.from({length:31},(_,i)=>({x:(i+.32)/31,obs:trueSignal((i+.32)/31)+perturb(i,5)}));
const sortedResiduals=cal.map(p=>Math.abs(p.obs-modelSignal(p.x))).sort((a,b)=>a-b);
function conformalQuantile(coverage){const k=Math.ceil((sortedResiduals.length+1)*coverage/100);return sortedResiduals[Math.min(k-1,sortedResiduals.length-1)]}
function renderCalibration(){
  const coverage=state.calibration,threshold=conformalQuantile(coverage),hits=hold.filter(p=>Math.abs(p.obs-modelSignal(p.x))<=threshold).length,rate=Math.round(hits/hold.length*100);
  el('confidenceValue').innerHTML=coverage+'<span>%</span>';
  el('coverageLegend').textContent='TARGET '+coverage+'% / SYNTHETIC DEMO';
  el('quantileValue').textContent='±'+threshold.toFixed(3);
  el('observedCoverage').textContent=rate+'%';el('insideCount').textContent=hits+' / '+hold.length;
  el('confidenceSlider').value=coverage;el('confidenceSlider').style.setProperty('--progress',((coverage-80)/18*100).toFixed(2)+'%');
  document.querySelectorAll('[data-confidence]').forEach(b=>{b.classList.toggle('is-active',Number(b.dataset.confidence)===coverage);b.setAttribute('aria-pressed',String(Number(b.dataset.confidence)===coverage))});
  el('calibrationInterpretation').textContent=`The ${(coverage/100).toFixed(2)} target selects the ${Math.ceil((sortedResiduals.length+1)*coverage/100)}th ordered calibration residual out of ${sortedResiduals.length}. On this separate synthetic holdout, ${hits} of ${hold.length} observations lie inside the interval (${rate}%).`;
  const X=x=>45+x*808,Y=y=>183-y*90;
  let grid='';for(let i=0;i<=6;i++){const y=58+i*45;grid+=`<line x1="45" y1="${y}" x2="853" y2="${y}" stroke="#55645d" stroke-width=".7" opacity=".38"/>`}
  for(let i=0;i<=10;i++){const x=45+i*80.8;grid+=`<line x1="${x}" y1="58" x2="${x}" y2="328" stroke="#55645d" stroke-width=".7" opacity=".25"/>`}
  const points=Array.from({length:140},(_,i)=>i/139),line=points.map((x,i)=>(i?'L':'M')+X(x).toFixed(1)+' '+Y(modelSignal(x)).toFixed(1)).join(' '),upper=points.map(x=>X(x).toFixed(1)+','+Y(modelSignal(x)+threshold).toFixed(1)),lower=points.map(x=>X(x).toFixed(1)+','+Y(modelSignal(x)-threshold).toFixed(1)).reverse(),band=upper.concat(lower).join(' ');
  const dots=hold.map((p,i)=>{const inside=Math.abs(p.obs-modelSignal(p.x))<=threshold;return `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.obs).toFixed(1)}" r="${inside?4.1:5.2}" fill="${inside?'#e1e9df':'#e6a783'}" stroke="${inside?'#769c8f':'#4e3530'}" stroke-width="1" opacity=".94"><title>Holdout observation ${i+1} / ${inside?'inside':'outside'} interval</title></circle>`}).join('');
  el('calibrationSvg').innerHTML=`<defs><linearGradient id="calband" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8cfb6" stop-opacity=".45"/><stop offset="1" stop-color="#a2baa4" stop-opacity=".10"/></linearGradient></defs>${grid}<polygon points="${band}" fill="url(#calband)" stroke="#94b29d" stroke-width=".8" opacity=".8"/><path d="${line}" fill="none" stroke="#edf2e9" stroke-width="2.4"/>${dots}<text x="45" y="350" font-family="monospace" font-size="10" fill="#93a69b">X / NORMALISED POSITION</text><text x="853" y="350" font-family="monospace" font-size="10" fill="#93a69b" text-anchor="end">N = 31 HELD OUT</text>`;
  // Signal the shared visual on the homepage, while never altering the user's active navigation selection.
  state.calibration=coverage;drawField();
}
el('confidenceSlider').addEventListener('input',e=>{state.calibration=Number(e.target.value);renderCalibration()});
document.querySelectorAll('[data-confidence]').forEach(b=>b.addEventListener('click',()=>{state.calibration=Number(b.dataset.confidence);renderCalibration()}));
renderCalibration();

// Wire controls and interactions.
document.querySelectorAll('.field-choice').forEach(b=>b.addEventListener('click',()=>setDomain(b.dataset.domain)));
// Atlas reset control is wired above.
el('viewRelated').addEventListener('click',()=>el('index').scrollIntoView({behavior:state.motion?'smooth':'instant'}));
el('dossierClose').addEventListener('click',()=>{el('dossier').close();focusProject(null)});
el('dossier').addEventListener('click',e=>{if(e.target===el('dossier')){el('dossier').close();focusProject(null)}});
el('dossier').addEventListener('close',()=>focusProject(null));
el('orderForm').addEventListener('submit',e=>{e.preventDefault();const price=Number(el('orderPrice').value),qty=Number(el('orderQuantity').value);if(!submitOrder(state.orderSide,price,qty)){el('labState').textContent='CHECK INPUT'}});
document.querySelectorAll('.side-button').forEach(b=>b.addEventListener('click',()=>{state.orderSide=b.dataset.side;document.querySelectorAll('.side-button').forEach(x=>{x.classList.toggle('is-active',x===b);x.setAttribute('aria-pressed',String(x===b))})}));
function preset(side,price,qty){const b=document.querySelector(`.side-button[data-side="${side}"]`);b.click();el('orderPrice').value=money(price);el('orderQuantity').value=qty;el('orderPrice').focus()}
el('presetCross').addEventListener('click',()=>preset('buy',100.02,50));el('presetRest').addEventListener('click',()=>preset('buy',99.98,75));el('resetBook').addEventListener('click',resetBook);
el('mobileMenu').addEventListener('click',()=>{const open=el('siteNav').classList.toggle('is-open');el('mobileMenu').setAttribute('aria-expanded',String(open))});
document.querySelectorAll('.nav a').forEach(a=>a.addEventListener('click',()=>{el('siteNav').classList.remove('is-open');el('mobileMenu').setAttribute('aria-expanded','false')}));
el('year').textContent=new Date().getFullYear();
canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();state.mouse={x:(e.clientX-r.left)/r.width-.5,y:(e.clientY-r.top)/r.height-.5};if(!state.motion)drawField()});
canvas.addEventListener('pointerleave',()=>{state.mouse={x:0,y:0};if(!state.motion)drawField()});
window.addEventListener('resize',sizeCanvas,{passive:true});
if('IntersectionObserver' in window){new IntersectionObserver(entries=>{observed=entries[0].isIntersecting},{threshold:0}).observe(canvas)}
let previousPaint=0;function animate(now){if(state.motion&&observed&&!document.hidden&&now-previousPaint>32){state.frame++;drawField();previousPaint=now}requestAnimationFrame(animate)}
// Keep atlas connectors in the same coordinate system as node percentage positions.
const incomingConcept=new URLSearchParams(location.search).get('concept');
if(concepts.some(c=>c.id===incomingConcept))state.concept=incomingConcept;
sync();resetBook();sizeCanvas();if(state.motion)requestAnimationFrame(animate);
