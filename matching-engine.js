
const $=id=>document.getElementById(id),money=t=>t<0?'—':(t/100).toFixed(2),num=n=>Number(n).toLocaleString('en-GB');
const labels=['ACCEPT','TRADE','REST','CANCEL','REJECT'];
const scenarios={fifo:{capacity:128,steps:[['ADD',1,1,10100,50],['ADD',2,1,10100,70],['ADD',3,1,10150,100],['ADD',4,0,10100,100]],notes:['Order A enters the empty ask book at 101.00. Its acceptance sequence gives it first position.','Order B joins the same price behind A. A lower numeric ID would not buy a better position.','Order C rests at 101.50. It cannot execute against a buy whose limit is 101.00.','The incoming buy takes 50 from A, then 50 from B. B retains 20; C is untouched. Both trades execute at the resting price.']},sweep:{capacity:128,steps:[['ADD',1,0,9950,30],['ADD',2,0,10000,40],['ADD',3,0,10000,20],['ADD',4,1,9900,70]],notes:['A bid rests at 99.50.','A later bid at 100.00 receives price priority over the earlier 99.50 order.','Another bid joins the 100.00 queue behind order 2.','The sell consumes orders 2 and 3 at 100.00, then 10 from order 1 at 99.50. Better price wins before earlier arrival.']},cancel:{capacity:8,steps:[['ADD',1,1,10100,50],['ADD',2,1,10100,70],['ADD',3,1,10100,100],['CANCEL',2],['ADD',4,1,10100,10]],notes:['Order 1 becomes the head.','Order 2 joins behind it.','Order 3 follows order 2.','Cancelling the middle record links its predecessor to its successor. Orders 1 and 3 keep their priority.','The freed storage slot now holds order 4. Recycled storage does not inherit priority: order 4 joins the tail.']},capacity:{capacity:2,steps:[['ADD',1,1,10100,50],['ADD',2,1,10150,70],['ADD',3,0,10200,100],['CANCEL',1],['ADD',3,0,10200,100]],notes:['One of two slots is occupied.','The second slot is occupied.','Capacity is exhausted. The incoming crossing order is rejected before it changes any resting liquidity.','Cancellation releases one slot and allows another submission.','ID 3 can now enter. It fills 70 at 101.50 and rests its remaining 30 at 102.00.']}};
let core, state;
let ledger = [], commands = [], history = [];
let index = 0, selectedLevel = null, selectedEvent = null, inspection = null;
let manual = false;

function snapshot() {
    return JSON.parse(core.UTF8ToString(core._book_snapshot()));
}
function recordFor(command) {
    return history.find(record => record.state.command === command);
}
function currentView() {
    if (!inspection) {
        return { ...state, restingOrders: state.orders, sequenceLimit: Infinity,
            pending: null, historical: false, record: history.at(-1) };
    }
    const { frame, record, position, total } = inspection;
    const resting = frame.orders.filter(order => order.slot !== frame.incoming && order.qty > 0);
    const bids = resting.filter(order => order.side === 0).map(order => order.price);
    const asks = resting.filter(order => order.side === 1).map(order => order.price);
    return { ...frame, command: record.state.command, restingOrders: resting,
        bestBid: bids.length ? Math.max(...bids) : -1,
        bestAsk: asks.length ? Math.min(...asks) : -1,
        pending: frame.orders.find(order => order.slot === frame.incoming),
        sequenceLimit: frame.sequence, historical: record.state.command !== state.command || position < total - 1,
        record, position, total };
}
function eventText(event) {
    if (event.kind === 1) return `#${event.taker} takes ${event.qty} from #${event.maker} @ ${money(event.price)}`;
    if (event.kind === 3) return `#${event.maker} cancels ${event.qty} @ ${money(event.price)}`;
    if (event.kind === 4) return `#${event.taker} rejected / ${['', 'invalid fields', 'duplicate active ID', 'pool exhausted', 'unknown active ID'][event.reason]}`;
    return `#${event.taker} ${event.kind === 0 ? 'accepted' : 'rests'} ${event.qty} @ ${money(event.price)}`;
}
function refreshLocks() {
    const historical = currentView().historical;
    for (const id of ['submitOrder', 'cancelOrder', 'clearBook']) $(id).disabled = historical;
    const ended = index >= scenarios[$('scenario').value].steps.length;
    $('stepScenario').disabled = $('finishScenario').disabled = historical || manual || ended;
    if ($('returnLatest')) $('returnLatest').disabled = !historical;
    if ($('inspectionMode')) $('inspectionMode').textContent = historical
        ? 'RECORDED STAGE / ORDER ENTRY PAUSED — RETURN TO LATEST TO SUBMIT'
        : 'LATEST COMPLETED STATE / ORDER ENTRY AVAILABLE';
}
function selectFrame(record, position) {
    window.dispatchEvent(new CustomEvent('matching-select-frame', { detail: {
        state: record.state, trace: record.trace, position
    } }));
}
function explain(event) {
    const record = event && recordFor(event.command);
    if (record) {
        let position = record.trace.frames.findIndex(frame => frame.sequence === event.sequence &&
            (event.kind === 1 ? frame.phase === 2 : event.kind === 0 ? frame.phase === 0 : frame.phase >= 3));
        if (position < 0) position = record.trace.frames.length - 1;
        selectFrame(record, position);
        return;
    }
    selectedEvent = event;
    if (!event) {
        $('ruleTitle').textContent = 'The contract comes first.';
        $('ruleText').textContent = 'A limit order trades only at eligible prices. At the best price, resting orders execute in acceptance order.';
        $('ruleFacts').textContent = 'INTEGER TICKS · SINGLE WRITER · DETERMINISTIC EVENTS';
    }
}
window.matchingInspect = (frame, position, total, command) => {
    const record = recordFor(command);
    inspection = frame && record ? { frame, record, position, total } : null;
    if (inspection) {
        selectedEvent = record.state.events.filter(event => event.sequence <= frame.sequence).at(-1) || null;
        const previous = record.trace.frames[Math.max(0, position - 1)];
        const maker = frame.orders.find(order => order.slot === frame.maker) ||
            previous?.orders.find(order => order.slot === frame.maker);
        if (maker) selectedLevel = { side: maker.side, price: maker.price };
        const pending = frame.orders.find(order => order.slot === frame.incoming);
        const titles = ['Reserve the incoming record.', 'Choose the best eligible FIFO head.',
            'Apply the fill. Repair ownership.', 'Complete the command.', 'Cancel and recycle.', 'Reject without changing liquidity.'];
        const texts = [
            `The incoming order has passed validation and reserved slot ${frame.incoming}. It is in flight, so it is counted in pool occupancy but excluded from resting depth and FIFO queues.`,
            maker ? `The selected resting order #${maker.id} is at ${money(maker.price)}. Price eligibility is checked first; its queue-head position supplies time priority. No fill has occurred at this stage.` : 'The engine checks price eligibility and the head of the selected resting queue.',
            selectedEvent?.kind === 1 ? `Incoming order #${selectedEvent.taker} has taken ${selectedEvent.qty} from resting order #${selectedEvent.maker} at ${money(selectedEvent.price)}. ${pending ? `The incoming quantity is now ${pending.qty}. ` : ''}${frame.orders.some(order => order.slot === frame.maker) ? 'The partially filled maker keeps its FIFO position.' : 'The completed maker has been unlinked and its slot recycled.'}` : 'The fill has updated quantities and removed any completed maker.',
            'The incoming record is now resting with its residual quantity, or has been recycled after a complete fill. All panels show this same completed state.',
            'The remaining quantity has been removed, adjacent links repaired and the order slot recycled. Uncancelled records retain their queue position.',
            'The engine rejected the command before mutating resting liquidity. The event ledger and book show the state at that rejection.'
        ];
        $('ruleTitle').textContent = titles[frame.phase];
        $('ruleText').textContent = texts[frame.phase];
        $('ruleFacts').textContent = `COMMAND ${command} / STAGE ${position + 1} OF ${total} / ${frame.phase < 3 ? 'IN FLIGHT' : 'COMPLETED'}`;
    }
    renderBook(); renderStructures(); renderLedger(); refreshLocks();
};
window.matchingReturnLatest = () => {
    const record = history.at(-1);
    if (record) selectFrame(record, record.trace.frames.length - 1);
    else { inspection = null; explain(null); renderBook(); renderStructures(); renderLedger(); refreshLocks(); }
};
function levelTotals(orders, side) {
    const levels = new Map();
    for (const order of orders.filter(order => order.side === side)) {
        const level = levels.get(order.price) || { qty: 0, count: 0 };
        level.qty += order.qty; level.count++; levels.set(order.price, level);
    }
    return levels;
}
function renderBook() {
    const view = currentView();
    for (let side = 0; side < 2; side++) {
        const levels = levelTotals(view.restingOrders, side);
        const before = levelTotals(view.record?.before?.orders || [], side);
        const maximum = Math.max(1, ...[...levels.values(), ...before.values()].map(level => level.qty));
        const box = $(side ? 'asks' : 'bids'); box.replaceChildren();
        const ordered = [...levels].sort((a, b) => side ? a[0] - b[0] : b[0] - a[0]);
        if (!ordered.length) {
            const empty = document.createElement('p'); empty.className = 'empty';
            empty.textContent = 'NO RESTING ' + (side ? 'ASKS' : 'BIDS'); box.append(empty);
        }
        for (const [price, level] of ordered) {
            const delta = level.qty - (before.get(price)?.qty || 0);
            const button = document.createElement('button'); button.type = 'button';
            button.className = (side ? 'ask' : 'bid') + (delta < 0 ? ' liquidity-consumed' : '');
            button.dataset.price = price; button.dataset.volume = level.qty;
            button.style.setProperty('--depth', level.qty / maximum * 100 + '%');
            button.setAttribute('aria-pressed', selectedLevel?.side === side && selectedLevel?.price === price);
            button.setAttribute('aria-label', `${side ? 'Ask' : 'Bid'} ${money(price)}, ${level.qty} units in ${level.count} orders`);
            button.innerHTML = `<span>${money(price)}</span><span>${num(level.qty)} <small>/${level.count}</small>${delta ? `<small class="level-delta">${delta > 0 ? '+' : '−'}${Math.abs(delta)} vs before command</small>` : ''}</span>`;
            button.onclick = () => { selectedLevel = { side, price }; renderBook(); renderStructures(); };
            box.append(button);
        }
        for (const [price, level] of before) if (!levels.has(price)) {
            const removed = document.createElement('p'); removed.className = 'removed-level';
            removed.textContent = `${money(price)} / ${level.qty} units removed`; box.append(removed);
        }
    }
    $('bestBid').textContent = money(view.bestBid); $('bestAsk').textContent = money(view.bestAsk);
    $('spread').textContent = view.bestBid < 0 || view.bestAsk < 0 ? '—' : money(view.bestAsk - view.bestBid);
    $('bookSequence').textContent = `COMMAND ${view.command}${inspection ? ` / STAGE ${view.position + 1} OF ${view.total}` : ''}`;
    if ($('inFlightOrder')) $('inFlightOrder').textContent = view.pending
        ? `IN FLIGHT: #${view.pending.id} / ${view.pending.qty} REMAINING / SLOT ${view.pending.slot} / NOT RESTING`
        : 'NO IN-FLIGHT ORDER';
}
function renderStructures() {
    const view = currentView(), resting = view.restingOrders;
    let queue = selectedLevel ? resting.filter(order => order.side === selectedLevel.side && order.price === selectedLevel.price) : [];
    if (!queue.length && resting.length) {
        const order = resting.toSorted((a, b) => a.sequence - b.sequence)[0];
        selectedLevel = { side: order.side, price: order.price };
        queue = resting.filter(record => record.side === order.side && record.price === order.price);
    }
    queue.sort((a, b) => a.sequence - b.sequence);
    $('queueLabel').textContent = queue.length ? `${selectedLevel.side ? 'ASK' : 'BID'} ${money(selectedLevel.price)} / ${queue.length} ORDERS` : 'EMPTY BOOK';
    $('fifoQueue').replaceChildren();
    for (const [i, order] of queue.entries()) {
        const card = document.createElement('div');
        card.className = 'fifo-order' + (inspection?.frame.maker === order.slot ? ' selected-maker' : '');
        card.dataset.order = order.id; card.dataset.quantity = order.qty;
        const alias = view.record?.scenario === 'fifo' && order.id <= 3 ? `${'ABC'[order.id - 1]} · ` : '';
        card.innerHTML = `<span class="mono">${i === 0 ? 'HEAD' : i === queue.length - 1 ? 'TAIL' : 'POSITION ' + (i + 1)}</span><p><strong>${alias}#${order.id} · ${order.qty}</strong><br>SLOT ${order.slot} / SEQ ${order.sequence}<br>PREV ${order.prev < 0 ? '∅' : order.prev} / NEXT ${order.next < 0 ? '∅' : order.next}</p>`;
        const cancel = document.createElement('button'); cancel.type = 'button';
        cancel.textContent = 'CANCEL #' + order.id; cancel.disabled = view.historical;
        cancel.onclick = () => execute(['CANCEL', order.id], true); card.append(cancel); $('fifoQueue').append(card);
    }
    $('queueReading').textContent = queue.length ? `Head #${queue[0].id} executes first at this price. These are the actual links and quantities at the shared inspection position.` : 'There is no resting queue at this position.';
    $('poolReadout').textContent = `${view.active} / ${view.capacity} ACTIVE · ${view.free} FREE`;
    $('poolSlots').replaceChildren();
    const focus = inspection?.frame.maker >= 0 ? inspection.frame.maker : view.pending?.slot ?? selectedEvent?.slot;
    for (let i = 0; i < view.capacity; i++) {
        const order = view.orders.find(order => order.slot === i), slot = document.createElement('span');
        slot.dataset.slot = i;
        slot.className = (order ? 'occupied ' : '') + (focus === i ? 'selected ' : '') + (view.pending?.slot === i ? 'pending' : '');
        slot.title = `Slot ${i}: ${order ? 'order #' + order.id + (view.pending?.slot === i ? ' / in flight' : ' / resting') : 'free'}`;
        slot.setAttribute('aria-label', slot.title); $('poolSlots').append(slot);
    }
    $('poolReading').textContent = `${view.pending ? 'The amber slot is reserved by the incoming order and is not part of resting depth. ' : ''}Pool, FIFO, depth and ledger all refer to command ${view.command}${inspection ? ', stage ' + (view.position + 1) : ''}.`;
    $('invariantState').textContent = view.valid === null ? 'IN FLIGHT / FINAL-BOOK INVARIANT DEFERRED' : view.valid ? 'INVARIANTS / PASS AT THIS POSITION' : 'INVARIANTS / FAILURE';
}
function renderLedger() {
    const view = currentView(), box = $('eventLedger'); box.replaceChildren();
    const visible = ledger.filter(event => event.sequence <= view.sequenceLimit);
    if (!visible.length) {
        const empty = document.createElement('p'); empty.className = 'microcopy';
        empty.textContent = 'No events have occurred at this inspection position.'; box.append(empty);
    }
    for (const event of visible.toReversed()) {
        const button = document.createElement('button'); button.type = 'button';
        button.className = event.kind === 1 ? 'trade-event' : '';
        button.setAttribute('aria-pressed', selectedEvent?.sequence === event.sequence);
        button.dataset.sequence = event.sequence; button.dataset.command = event.command;
        button.disabled = !recordFor(event.command);
        if (button.disabled) button.title = 'The bounded inspection history no longer retains this command. The command export remains complete.';
        const sequence = document.createElement('span'), description = document.createElement('span');
        sequence.textContent = String(event.sequence).padStart(3, '0'); description.textContent = eventText(event);
        button.append(sequence, description); button.onclick = () => explain(event); box.append(button);
    }
}
function remember(record) {
    history.push(record);
    const size = () => history.reduce((sum, item) => sum + item.trace.frames.reduce((count, frame) => count + frame.orders.length, 0), 0);
    while (history.length > 1 && (history.length > 32 || size() > 16384)) history.shift();
}
function execute(command, custom = false) {
    inspection = null;
    if (custom) {
        manual = true; $('scenarioProgress').textContent = 'CUSTOM SESSION';
        $('commandLabel').textContent = 'CUSTOM COMMAND';
        $('commandExplanation').textContent = 'Your instruction executes through the same C++ core. Inspect its stages or return to the latest state to submit another.';
    }
    const before = state; commands.push(command);
    if (command[0] === 'ADD') core._book_submit(...command.slice(1)); else core._book_cancel(command[1]);
    state = snapshot();
    const trace = window.matchingTraceSnapshot();
    const record = { state, trace, before, scenario: manual ? 'custom' : $('scenario').value };
    remember(record);
    ledger.push(...state.events.map(event => ({ ...event, command: state.command }))); ledger = ledger.slice(-200);
    $('formStatus').textContent = state.events.map(eventText).join(' · ');
    window.dispatchEvent(new CustomEvent('matching-updated', { detail: { state, trace } }));
    if (!trace.frames.length) { renderBook(); renderStructures(); renderLedger(); refreshLocks(); }
}
function reset(empty = false) {
    const scenario = scenarios[$('scenario').value]; core._book_reset(empty ? 128 : scenario.capacity);
    state = snapshot(); commands = [['RESET', state.capacity]]; ledger = []; history = []; inspection = null;
    index = 0; selectedLevel = selectedEvent = null; manual = empty;
    $('scenarioProgress').textContent = empty ? 'CUSTOM SESSION' : `0 / ${scenario.steps.length}`;
    $('commandLabel').textContent = 'READY / ' + (empty ? 'EMPTY BOOK' : $('scenario').selectedOptions[0].textContent);
    $('commandExplanation').textContent = empty ? 'Submit your own orders to the empty 128-slot book.' : 'Each command is captured by the C++ core. All panels follow the same selected stage.';
    $('formStatus').textContent = 'Integer ticks, active-ID uniqueness and explicit capacity are checked by the engine.';
    explain(null); renderBook(); renderStructures(); renderLedger(); refreshLocks();
    window.dispatchEvent(new CustomEvent('matching-updated', { detail: { state, trace: window.matchingTraceSnapshot() } }));
}
function step() {
    const scenario = scenarios[$('scenario').value];
    if (index >= scenario.steps.length || manual) return;
    $('commandLabel').textContent = `GUIDED COMMAND ${index + 1} / ${scenario.steps.length}`;
    $('commandExplanation').textContent = scenario.notes[index];
    execute(scenario.steps[index]); index++; refreshLocks();
    $('scenarioProgress').textContent = `${index} / ${scenario.steps.length}`;
}
$('orderForm').onsubmit = event => {
    event.preventDefault(); if (currentView().historical) return;
    const raw = $('orderPrice').value.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) { $('formStatus').textContent = 'Use a price with at most two decimal places.'; return; }
    const ticks = Math.round(Number(raw) * 100);
    if (!Number.isSafeInteger(ticks) || ticks < 1 || ticks > 20000) { $('formStatus').textContent = 'Supported limit prices are 0.01–200.00.'; return; }
    execute(['ADD', +$('orderId').value, +$('orderSide').value, ticks, +$('orderQty').value], true);
};
$('cancelOrder').onclick = () => {
    if (currentView().historical) return;
    const id = +$('cancelId').value;
    if (Number.isInteger(id) && id > 0 && id <= 2147483647) execute(['CANCEL', id], true);
    else $('formStatus').textContent = 'Enter an integer active order ID.';
};
$('resetScenario').onclick = () => reset(); $('clearBook').onclick = () => reset(true);
$('scenario').onchange = () => { if (core) reset(); };
$('stepScenario').onclick = step;
$('finishScenario').onclick = () => { while (index < scenarios[$('scenario').value].steps.length && !manual) step(); };
$('downloadReplay').onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 1, engine: 'C++20 reconstruction / October 2026',
        commands, events: ledger, eventsTruncatedToLatest: 200, finalState: state }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'matching-replay.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
try {
    const { default: createEngine } = await import('./matching/engine.js'); core = await createEngine();
    core._book_trace_enable(1);
    window.matchingTraceSnapshot = () => JSON.parse(core.UTF8ToString(core._book_trace()));
    window.matchingSnapshot = () => JSON.parse(JSON.stringify(state));
    window.matchingDisplaySnapshot = () => JSON.parse(JSON.stringify(currentView()));
    for (const id of ['resetScenario', 'downloadReplay']) $(id).disabled = false;
    reset(); $('runtimeState').textContent = 'C++20 CORE / WEBASSEMBLY READY';
} catch (error) {
    $('runtimeState').textContent = 'CORE COULD NOT LOAD';
    $('commandExplanation').textContent = 'The compiled module could not load. Reload the hosted site or download the source and run the native replay runner.';
    console.error(error);
}

try{const verification=await fetch('matching/verification.json').then(r=>r.json());$('verificationFacts').innerHTML=`<div><strong>${num(verification.randomCommands)}</strong><span>GENERATED COMMANDS / ${verification.seeds} FIXED SEEDS</span></div><div><strong>${num(verification.allocationWorkloadCommands)}</strong><span>COMMANDS IN ALLOCATION CHECK</span></div><div><strong>${verification.observedAllocations}</strong><span>OBSERVED COMMAND-PATH ALLOCATIONS</span></div>`;$('sanitizerNote').textContent=verification.sanitizerNote;}catch{$('verificationFacts').textContent='Verification record unavailable. Download the source to reproduce the checks.'}
try{const b=await fetch('matching/benchmark.json').then(r=>r.json());b.workloads.forEach((w,i)=>{const o=document.createElement('option');o.value=i;o.textContent=w.name;$('benchmarkWorkload').append(o)});function plot(){const w=b.workloads[+$('benchmarkWorkload').value],tail=$('benchmarkView').value==='tail',start=tail?0.9:0,points=w.samples.map((v,i)=>[i/(w.samples.length-1),v]).filter((p,i)=>p[0]>=start&&(i%20===0||i===w.samples.length-1)),hi=Math.max(1,...points.map(p=>p[1]));let s='';for(let i=0;i<=4;i++){const y=275-i*55;s+=`<path d="M80 ${y} H950" stroke="#b4c1a9"/><text x="65" y="${y+4}" text-anchor="end">${Math.round(hi*i/4)}</text><text x="${80+i/4*870}" y="302" text-anchor="middle">${((start+(1-start)*i/4)*100).toFixed(1)}%</text>`}s+=`<polyline points="${points.map(([q,v])=>`${80+(q-start)/(1-start)*870},${275-v/hi*220}`).join(' ')}" fill="none" stroke="#3e6548" stroke-width="2.5"/><text x="80" y="25">ELAPSED ns / SINGLE COMMAND</text><text x="520" y="335" text-anchor="middle">SORTED SAMPLE RANK</text>`;$('benchmarkChart').innerHTML=s;$('benchmarkChart').querySelectorAll('text').forEach(t=>{t.setAttribute('font-family','monospace');t.setAttribute('font-size','12');t.setAttribute('fill','#36523e')});$('benchmarkStats').innerHTML=['p50','p95','p99'].map(q=>`<div><strong>${w[q]===0?"Not resolved":w[q]+" ns"}</strong><span>${q.toUpperCase()} / ${num(b.samplesPerWorkload)} TIMINGS</span></div>`).join('');$('benchmarkReading').textContent=w.name==='sweep-eight-levels'?'Each measured incoming buy consumes eight resting orders at eight different price levels. Fixture setup is outside the timing window. Compare its distribution with a one-maker match; this workload intentionally does more matching work.':w.name==='cancel-known-order'?'Known-ID cancellation includes index lookup, queue unlinking, aggregate updates and recycling. Zero-valued timings are clock quantisation, not zero-cost operations.':'A bounded synthetic workload isolates this command shape. This local distribution does not establish production latency under network load, contention or a different book shape.';}$('benchmarkWorkload').onchange=$('benchmarkView').onchange=plot;plot();$('benchmarkEnvironment').textContent=`${b.environment.cpu} / ${b.environment.os} / ${b.environment.compiler} / ${b.environment.flags}. Capacity 2,048; price range 1–20,000 ticks. Recorded ${b.environment.date}. Sorted plot sampling preserves the original native timing values.`;}catch{$('benchmarkReading').textContent='Measurement data unavailable. Source and benchmark harness remain downloadable.'}




try{const snippets=await fetch('matching/code-excerpts.json').then(r=>r.json());function showCode(){const d=snippets[document.getElementById('sourceMethod').value];document.getElementById('sourceCode').textContent=d.code;document.getElementById('sourceLocation').textContent='src/engine.cpp / LINE '+d.line;}document.getElementById('sourceMethod').onchange=showCode;showCode()}catch{document.getElementById('sourceCode').textContent='Use the complete source download to inspect the implementation.'}

