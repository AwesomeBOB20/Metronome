/* === METRONOME — centered, equal-width two-row subs; tri-state sub lights; distinct sub accents; phase-locked clocks;
       reset-to-first on stop/changes; hide subs for quarters; auto-set TS numerator (3 for x/3, else 4) === */
document.addEventListener('DOMContentLoaded', () => {
  const $ = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  const root = $('#metronome'); if (!root) return;

  if (window.__METRO_BOUND__) return;
  window.__METRO_BOUND__ = true;

  // Elements
  const playBtn = $('#metroPlay');
  const tapBtn = $('#tapTempoBtn');

  const bpmDec1Btn = $('#bpmDec1');
  const bpmDec5Btn = $('#bpmDec5');
  const bpmInc1Btn = $('#bpmInc1');
  const bpmInc5Btn = $('#bpmInc5');

  const bpmRange = $('#metroBpmRange');
  const bpmInput = $('#metroBpmInput');
  const bpmDisplay = $('#metroBpmValue');

  const tsNum = $('#metroTSNum');
  const tsDen = $('#metroTSDen');
  const subdivSel = $('#metroSubdivision');
  const soundSel = $('#metroSound');

  const tsNumTrigger = $('#tsNumTrigger');
  const tsDenTrigger = $('#tsDenTrigger');
  const subdivTrigger = $('#subdivTrigger');
  const soundTrigger = $('#soundTrigger');

  const lightsWrap = $('#metroLights');   // main lights
  const subLightsWrap = $('#subLights');  // subdivision lights container

  /* ---------------- Picker Modal ---------------- */
  const pickerRoot = $('#pickerRoot');
  const pickerTitle = $('#pickerTitle');
  const pickerClose = $('#pickerClose');
  const pickerSearch = $('#pickerSearch');
  const pickerList = $('#pickerList');
  let activeSelect = null, activeTrigger = null;

  function openPicker(trigger, selectEl, titleText){
    activeSelect = selectEl;
    activeTrigger = trigger;
    if (pickerTitle) pickerTitle.textContent = titleText || 'Select';
    if (pickerSearch) pickerSearch.value = '';
    renderPickerList('');
    if (pickerRoot) pickerRoot.hidden = false;
    document.body.classList.add('modal-open');
    pickerSearch && pickerSearch.focus({preventScroll:true});
  }
  function closePicker(){
    if (pickerRoot) pickerRoot.hidden = true;
    document.body.classList.remove('modal-open');
    activeSelect = null; activeTrigger = null;
  }
  function renderPickerList(filter){
    if (!pickerList || !activeSelect) return;
    pickerList.innerHTML = '';
    const opts = [...activeSelect.options];
    const q = (filter||'').trim().toLowerCase();
    opts.forEach((opt, idx)=>{
      const txt = opt.text || opt.value;
      if (q && !txt.toLowerCase().includes(q)) return;
      const li = document.createElement('li');
      li.className = 'picker__item' + (idx===activeSelect.selectedIndex ? ' is-active':'');
      li.textContent = txt;
      li.setAttribute('role','option');
      li.addEventListener('click', ()=>{
        activeSelect.value = opt.value || txt;
        activeSelect.dispatchEvent(new Event('change', {bubbles:true}));
        if (activeTrigger) activeTrigger.value = txt;
        closePicker();
      });
      pickerList.appendChild(li);
    });
  }
  pickerClose && pickerClose.addEventListener('click', closePicker);
  pickerSearch && pickerSearch.addEventListener('input', ()=> renderPickerList(pickerSearch.value));
  function attachPicker(trigger){
    const selectId = trigger.getAttribute('data-picker');
    const title = trigger.getAttribute('data-title') || 'Select';
    const sel = $('#'+selectId);
    if (!sel) return;
    trigger.value = sel.options[sel.selectedIndex]?.text || '';
    trigger.addEventListener('click', ()=> openPicker(trigger, sel, title));
  }
  [tsNumTrigger, tsDenTrigger, subdivTrigger, soundTrigger].forEach(el=> el && attachPicker(el));

  /* ---------------- Helpers ---------------- */
  const EPS = 1e-6;
  const clampInt = (v,min,max)=>Math.max(min,Math.min(max,(parseInt(v,10)||0)));
  const getBpm = ()=>clampInt(bpmRange.value,0,400);

  // Parse subdivision as "a/b" or "n" (treat "0" as none)
  function getSubdivParts(){
    const raw = (subdivSel?.value ?? '1/1').trim().replace(/\s+/g,'');
    if (raw.includes('/')){
      const [aStr,bStr] = raw.split('/');
      const a = Number(aStr), b = Number(bStr);
      return { a: (isFinite(a)?a:0), b: (isFinite(b)?b:1), raw };
    }
    const n = Number(raw);
    return { a: (isFinite(n)?n:1), b: 1, raw };
  }
  function getSubdivRatio(){
    const {a,b} = getSubdivParts();
    if (b <= 0) return 0;
    const r = a / b;
    return r >= 0 ? r : 0;
  }
  // Visible sub lights count = numerator "a"
  function subsLightsCount(){
    const {a} = getSubdivParts();
    return Math.max(0, Math.floor(a)); // 0 hides
  }
  function hasDenominator3(){
    const {b} = getSubdivParts();
    return b === 3;
  }
  function isQuartersSubdiv(){
    const {a,b} = getSubdivParts();
    return a === 1 && b === 1; // 1/1 (quarters)
  }

  /* ---------------- Main lights (0 none, 1 normal, 2 accent) ---------------- */
  let beatStates = [];
  function defaultBeatStates(){
    const beats = clampInt(tsNum.value,1,12);
    const arr = new Array(beats).fill(1);
    if (beats>0) arr[0]=2;
    return arr;
  }
  function renderLights(){
    lightsWrap.innerHTML = '';
    const beats = clampInt(tsNum.value,1,12);
    if (!beatStates.length || beatStates.length !== beats) beatStates = defaultBeatStates();
    for(let i=0;i<beats;i++){
      const d = document.createElement('div');
      d.className = 'metro-light';
      applyBeatClass(d, beatStates[i]);
      d.title = 'Click: Normal → Accent → None';
      d.addEventListener('click', ()=>{
        beatStates[i] = (beatStates[i] === 1) ? 2 : (beatStates[i] === 2 ? 0 : 1);
        applyBeatClass(d, beatStates[i]);
      });
      lightsWrap.appendChild(d);
    }
  }
  function applyBeatClass(el, state){
    el.classList.remove('is-accent','is-beat','is-muted','is-hit');
    if (state===2) el.classList.add('is-accent');
    else if (state===1) el.classList.add('is-beat');
    else el.classList.add('is-muted');
  }

  /* ---------------- Sub lights (0 none, 1 normal, 2 accent) ---------------- */
  let subStates = [];
  function defaultSubStates(n){ return new Array(Math.max(0, n|0)).fill(1); }

  // Create up to two centered rows that never overflow; both rows use identical cell width
  function renderSubLights(){
    if (!subLightsWrap) return;

    // Hide subs entirely for quarters (1/1)
    if (isQuartersSubdiv()){
      subLightsWrap.hidden = true;
      subLightsWrap.innerHTML = '';
      subStates = [];
      return;
    }

    const n = subsLightsCount();

    if (n <= 0){
      subLightsWrap.hidden = true;
      subLightsWrap.innerHTML = '';
      subStates = [];
      return;
    }

    subLightsWrap.hidden = false;

    // Ensure state array length
    if (!subStates.length || subStates.length !== n) subStates = defaultSubStates(n);

    // Measure container and decide single-row vs two-row
    const cw = subLightsWrap.clientWidth || subLightsWrap.getBoundingClientRect().width || 0;
    const style = getComputedStyle(subLightsWrap);
    const gap = parseFloat(style.gap || '20') || 20;
    const MIN_CELL = 28; // px

    const fitsSingleRow = (count)=> {
      if (count <= 0) return true;
      const totalGaps = gap * Math.max(0, count-1);
      const cellW = (cw - totalGaps) / count;
      return cellW >= MIN_CELL;
    };

    subLightsWrap.innerHTML = '';

    if (fitsSingleRow(n)){
      // --- Single centered row ---
      const row = document.createElement('div');
      row.className = 'sub-row';

      // per-cell px so row gets a real width we can center
      const cellPx = Math.floor((cw - gap * Math.max(0, n-1)) / n);
      row.style.gridTemplateColumns = `repeat(${n}, ${cellPx}px)`;
      row.style.width = 'max-content';
      row.style.marginInline = 'auto';

      for (let i=0;i<n;i++){
        const d = document.createElement('div');
        d.className = 'sub-light';
        applySubClass(d, subStates[i]);
        d.title = 'Click: Normal → Accent → None';
        d.addEventListener('click', ()=>{
          subStates[i] = (subStates[i] === 1) ? 2 : (subStates[i] === 2 ? 0 : 1);
          applySubClass(d, subStates[i]);
        });
        row.appendChild(d);
      }
      subLightsWrap.appendChild(row);

    } else {
      // --- Two centered rows; equal cell width on both rows; counts split as evenly as possible
      let topCount  = Math.ceil(n/2);
      let bottomCount = n - topCount;

      const maxPerRow = Math.max(1, Math.floor((cw + gap) / (MIN_CELL + gap)));
      if (topCount > maxPerRow) { topCount = maxPerRow; bottomCount = n - topCount; }
      if (bottomCount > maxPerRow){
        bottomCount = maxPerRow;
        topCount = n - bottomCount;
      }

      const maxCount = Math.max(topCount, bottomCount);
      const cellPx = Math.floor((cw - gap * Math.max(0, maxCount-1)) / maxCount);

      const rowTop = document.createElement('div');
      rowTop.className = 'sub-row';
      rowTop.style.gridTemplateColumns = `repeat(${topCount}, ${cellPx}px)`;
      rowTop.style.width = 'max-content';
      rowTop.style.marginInline = 'auto';

      const rowBottom = document.createElement('div');
      rowBottom.className = 'sub-row';
      rowBottom.style.gridTemplateColumns = `repeat(${bottomCount}, ${cellPx}px)`;
      rowBottom.style.width = 'max-content';
      rowBottom.style.marginInline = 'auto';

      for (let i=0;i<n;i++){
        const d = document.createElement('div');
        d.className = 'sub-light';
        applySubClass(d, subStates[i]);
        d.title = 'Click: Normal → Accent → None';
        d.addEventListener('click', ()=>{
          subStates[i] = (subStates[i] === 1) ? 2 : (subStates[i] === 2 ? 0 : 1);
          applySubClass(d, subStates[i]);
        });
        (i < topCount ? rowTop : rowBottom).appendChild(d);
      }

      subLightsWrap.appendChild(rowTop);
      subLightsWrap.appendChild(rowBottom);
    }
  }

  function applySubClass(el, state){
    el.classList.remove('is-on','is-accent','is-muted','is-hit');
    if (state===2) el.classList.add('is-accent');
    else if (state===1) el.classList.add('is-on');
    else el.classList.add('is-muted');
  }

  function pulseLight(beatIndex){
    const lights = $$('.metro-light', lightsWrap);
    lights.forEach((el,i)=>{
      el.classList.toggle('is-hit', i===beatIndex);
      if (i===beatIndex) setTimeout(()=>el.classList.remove('is-hit'), 60);
    });
  }
  function pulseSubLightAt(i){
    if (!subLightsWrap || subLightsWrap.hidden) return;
    const lights = $$('.sub-light', subLightsWrap);
    if (!lights.length) return;
    const n = lights.length;
    const idx = ((i % n) + n) % n;
    if (subStates[idx] !== 0){
      lights[idx].classList.add('is-hit');
      setTimeout(()=>lights[idx].classList.remove('is-hit'), 60);
    }
  }
  function clearHitClasses(){
    $$('.metro-light', lightsWrap).forEach(el=>el.classList.remove('is-hit'));
    if (subLightsWrap) $$('.sub-light', subLightsWrap).forEach(el=>el.classList.remove('is-hit'));
  }

  /* Re-render subs when the container resizes */
  if (subLightsWrap && 'ResizeObserver' in window){
    const ro = new ResizeObserver(()=> renderSubLights());
    ro.observe(subLightsWrap);
  } else {
    window.addEventListener('resize', renderSubLights);
  }

  /* ---------------- Slider fill ---------------- */
  function updateSliderFill(rangeEl){
    const min = parseFloat(rangeEl.min||'0');
    const max = parseFloat(rangeEl.max||'100');
    const val = parseFloat(rangeEl.value||'0');
    const pct = ((val-min)*100)/(max-min);
    rangeEl.style.setProperty('--bg-pos', pct+'% 100%');
    rangeEl.style.background = `linear-gradient(to right, var(--purple) 0%, var(--purple) ${pct}%, var(--gray-1) ${pct}%, var(--gray-1) 100%)`;
  }

  /* ---------------- Audio ---------------- */
  let audioCtx=null, master=null, comp=null;
  function ensureCtx(){
    if (!audioCtx){
      audioCtx = new (window.AudioContext||window.webkitAudioContext)();
      master = audioCtx.createGain();
      master.gain.value = 0.9;

      comp = audioCtx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-18, audioCtx.currentTime);
      comp.knee.setValueAtTime(20, audioCtx.currentTime);
      comp.ratio.setValueAtTime(6, audioCtx.currentTime);
      comp.attack.setValueAtTime(0.002, audioCtx.currentTime);
      comp.release.setValueAtTime(0.10, audioCtx.currentTime);
      master.connect(comp).connect(audioCtx.destination);
    }
  }

  const presets = {
    beep: {
      accent:[1760,'sine',0.020], beat:[880,'sine',0.018],
      sub:[440,'sine',0.012], subAccent:[660,'triangle',0.014]
    },
    click: {
      accent:[3000,'triangle',0.008], beat:[2500,'square',0.006],
      sub:[2000,'square',0.004], subAccent:[2200,'sawtooth',0.006]
    },
    wood: {
      accent:['wood',null,0.028], beat:['wood',null,0.022],
      sub:['wood',null,0.016], subAccent:['wood-hi',null,0.018]
    },
    clave: {
      accent:['clave',null,0.028], beat:['clave',null,0.020],
      sub:['clave',null,0.014], subAccent:['clave-soft',null,0.016]
    },
    analog: {
      accent:[1200,'sawtooth',0.020], beat:[900,'sawtooth',0.016],
      sub:[700,'sawtooth',0.012], subAccent:[1000,'square',0.014]
    },
  };
  const presetLevel = { beep:1.00, click:1.00, wood:1.00, clave:1.00, analog:1.00 };
  const kindScale = k => k==='accent'?1.0 : k==='beat'?0.8 : 0.6;

  function trigger(time, kind, gainMul=1){
    const chosen = (soundSel?.value || 'beep');
    const p = (presets[chosen] || presets.beep);
    const spec = p[kind] || (kind==='subAccent' ? p.sub : null) || p.beat;
    const [freq, shape, dur] = spec;
    if (!audioCtx || !master) return;

    const v = audioCtx.createGain();
    v.gain.setValueAtTime(gainMul * kindScale(kind === 'subAccent' ? 'sub' : kind) * (presetLevel[chosen]||1), time);
    v.connect(master);

    if (freq === 'wood' || freq === 'wood-hi'){
      const n = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
      const buffer = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i=0;i<n;i++) data[i] = (Math.random()*2-1) * Math.exp(-i/(n*0.22));
      const src = audioCtx.createBufferSource(); src.buffer = buffer;
      const bp = audioCtx.createBiquadFilter(); bp.type='bandpass';
      bp.frequency.value = (freq === 'wood-hi') ? 2200 : 1550;
      bp.Q.value = (freq === 'wood-hi') ? 4.0 : 3.2;
      src.connect(bp).connect(v);
      src.start(time);
      return;
    }
    if (freq === 'clave' || freq === 'clave-soft'){
      const o1 = audioCtx.createOscillator();
      const o2 = audioCtx.createOscillator();
      if (freq === 'clave'){
        o1.type='square';   o1.frequency.setValueAtTime(2350, time);
        o2.type='triangle'; o2.frequency.setValueAtTime(1180, time);
      } else {
        o1.type='triangle'; o1.frequency.setValueAtTime(2050, time);
        o2.type='sine';     o2.frequency.setValueAtTime(980, time);
      }
      const g  = audioCtx.createGain();
      g.gain.setValueAtTime(1.0, time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      o1.connect(g); o2.connect(g); g.connect(v);
      o1.start(time); o2.start(time);
      o1.stop(time + dur); o2.stop(time + dur);
      return;
    }

    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = shape || 'sine';
    osc.frequency.setValueAtTime(freq, time);
    env.gain.setValueAtTime(1.0, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(env).connect(v);
    osc.start(time);
    osc.stop(time + dur);
  }

  /* ---------------- Scheduler (phase + reset management) ---------------- */
  let isRunning=false;
  let currentBeatInBar=0;
  let nextBeatTime=0;
  let nextSubTime=0;
  let subIndex=0;
  let scheduleTimer=null;
  let gridT0 = 0; // phase anchor for both rows

  const lookaheadMs = 25;
  const scheduleAheadTime = 0.12;

  function secondsPerBeat(){
    const bpm = getBpm();
    const den = clampInt(tsDen.value,1,16);
    return bpm>0 ? 60.0/bpm * (4/den) : Infinity;
  }
  function nextAlignedTime(anchor, interval, now){
    if (!isFinite(interval) || interval <= 0) return Infinity;
    const k = Math.ceil((now - anchor - EPS) / interval);
    return anchor + Math.max(0, k) * interval;
  }

  function alignToGrid(resetToFirst=false){
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const spb = secondsPerBeat();
    const ratio = getSubdivRatio();
    const beatsPerBar = clampInt(tsNum.value,1,12);

    if (resetToFirst){
      gridT0 = now + 0.05;
      nextBeatTime = gridT0;
      currentBeatInBar = 0;

      if (ratio > EPS){
        nextSubTime = gridT0;
        subIndex = 0;
      } else {
        nextSubTime = Infinity;
        subIndex = 0;
      }
      clearHitClasses();
      return;
    }

    const anchor = gridT0 || (now + 0.05);
    nextBeatTime = nextAlignedTime(anchor, spb, now);
    const beatCount = Math.floor((now - anchor + EPS) / spb);
    currentBeatInBar = ((beatCount % beatsPerBar) + beatsPerBar) % beatsPerBar;

    if (ratio > EPS){
      const subInt = spb / ratio;
      nextSubTime = nextAlignedTime(anchor, subInt, now);
      const n = Math.max(1, Math.round(beatsPerBar * ratio));
      const subCount = Math.floor((now - anchor + EPS) / subInt);
      subIndex = ((subCount % n) + n) % n;
    } else {
      nextSubTime = Infinity;
      subIndex = 0;
    }
    clearHitClasses();
  }

  function schedule(){
    const spb = secondsPerBeat();
    if (!isFinite(spb)) return;

    const ratio = getSubdivRatio();
    const subEnabled = ratio > EPS;
    const subInterval = subEnabled ? (spb / ratio) : Infinity;

    const beatsPerBar = clampInt(tsNum.value,1,12);
    const horizon = audioCtx.currentTime + scheduleAheadTime;

    while (true){
      const tNext = Math.min(nextBeatTime, subEnabled ? nextSubTime : Infinity);
      if (tNext >= horizon) break;

      if (nextBeatTime <= (subEnabled ? nextSubTime : Infinity) + EPS){
        const state = beatStates[currentBeatInBar] ?? 1;
        if (state !== 0){
          trigger(nextBeatTime, state===2 ? 'accent' : 'beat');
          pulseLight(currentBeatInBar);
        }
        nextBeatTime += spb;
        currentBeatInBar = (currentBeatInBar + 1) % beatsPerBar;
        continue;
      }

      if (subEnabled){
        const nSubsInBar = Math.max(1, Math.round(beatsPerBar * ratio));
        const idxInBar = nSubsInBar ? (subIndex % nSubsInBar) : 0;

        // Map sub pulses to visible lights (count = numerator "a")
        const lights = $$('.sub-light', subLightsWrap);
        const visibleCount = lights.length || 1;
        const visIdx = (visibleCount ? (idxInBar % visibleCount) : 0);

        const s = subStates[visIdx] ?? 1; // 0,1,2
        if (s === 2){
          trigger(nextSubTime, 'subAccent');
        } else if (s === 1){
          trigger(nextSubTime, 'sub');
        }
        pulseSubLightAt(visIdx);
        nextSubTime += subInterval;
        subIndex++;
      }
    }
  }

  function start(){
    if (isRunning) return;
    ensureCtx(); audioCtx.resume && audioCtx.resume();
    if (getBpm() === 0){ return; }
    isRunning = true;
    playBtn && (playBtn.textContent = 'Stop');
    playBtn && playBtn.setAttribute('aria-pressed','true');

    alignToGrid(true); // first light on start
    if (scheduleTimer) clearInterval(scheduleTimer);
    scheduleTimer = setInterval(schedule, lookaheadMs);
  }
  function stop(){
    if (!isRunning) return;
    clearInterval(scheduleTimer); scheduleTimer=null; isRunning=false;
    playBtn && (playBtn.textContent = 'Start');
    playBtn && playBtn.setAttribute('aria-pressed','false');

    alignToGrid(true); // reset both rows to first on pause
  }

  /* ---------------- Tap tempo ---------------- */
  const TAP_RESET_MS = 1500;
  let tapTimes = [];
  function onTap(){
    const nowTs = performance.now();
    if (tapTimes.length && (nowTs - tapTimes[tapTimes.length - 1]) > TAP_RESET_MS) tapTimes = [];
    tapTimes.push(nowTs);
    if (tapTimes.length > 4) tapTimes.shift();
    if (tapTimes.length === 4){
      const [t0,t1,t2,t3] = tapTimes;
      const ivals = [t1-t0, t2-t1, t3-t2].sort((a,b)=>a-b);
      const ms = ivals[1];
      const bpm = clampInt(Math.round(60000 / ms), 0, 400);
      setBpmUI(bpm);
      if (isRunning) alignToGrid(false);
    }
  }

  /* ---------------- UI sync ---------------- */
  function setBpmUI(val){
    const v = clampInt(val,0,400);
    bpmRange && (bpmRange.value = String(v));
    bpmInput && (bpmInput.value = String(v));
    bpmDisplay && (bpmDisplay.textContent = String(v));
    bpmRange && updateSliderFill(bpmRange);
  }
  function stepBpm(delta){
    setBpmUI(getBpm() + delta);
    if (isRunning){
      if (getBpm()===0) { stop(); return; }
      alignToGrid(false);
    }
  }

  bpmDec1Btn && bpmDec1Btn.addEventListener('click', ()=>stepBpm(-1));
  bpmDec5Btn && bpmDec5Btn.addEventListener('click', ()=>stepBpm(-5));
  bpmInc1Btn && bpmInc1Btn.addEventListener('click', ()=>stepBpm(+1));
  bpmInc5Btn && bpmInc5Btn.addEventListener('click', ()=>stepBpm(+5));

  playBtn && playBtn.addEventListener('click', e=>{ e.preventDefault(); isRunning ? stop() : start(); });
  tapBtn && tapBtn.addEventListener('click', onTap);

  bpmRange && bpmRange.addEventListener('input', e=>{
    setBpmUI(e.target.value);
    if (isRunning){
      if (getBpm()===0) { stop(); return; }
      alignToGrid(false);
    }
  });
  bpmInput && bpmInput.addEventListener('input', e=>{
    setBpmUI(e.target.value||0);
    if (isRunning) alignToGrid(false);
  });

  // Auto-set TS numerator based on subdivision; re-render + reset
  function autoSetNumeratorBySubdivision(){
    const targetNum = hasDenominator3() ? '3' : '4';
    if (tsNum && tsNum.value !== targetNum){
      tsNum.value = targetNum;
      if (tsNumTrigger) tsNumTrigger.value = tsNum.options[tsNum.selectedIndex]?.text || targetNum;
    }
  }

  // Setting changes
  [tsNum, tsDen, subdivSel].forEach(el=> el && el.addEventListener('change', ()=>{
    if (el === subdivSel){
      if (subdivTrigger) subdivTrigger.value = subdivSel.options[subdivSel.selectedIndex]?.text || '';
      autoSetNumeratorBySubdivision();
    } else if (el === tsNum){
      if (tsNumTrigger) tsNumTrigger.value = tsNum.options[tsNum.selectedIndex]?.text || '';
    } else if (el === tsDen){
      if (tsDenTrigger) tsDenTrigger.value = tsDen.options[tsDen.selectedIndex]?.text || '';
    }

    beatStates = defaultBeatStates();
    renderLights();

    const n = subsLightsCount();
    subStates = n > 0 ? defaultSubStates(n) : [];
    renderSubLights();

    alignToGrid(true); // reset to first on any change
  }));

  soundSel && soundSel.addEventListener('change', ()=>{
    if (soundTrigger) soundTrigger.value = soundSel.options[soundSel.selectedIndex]?.text || '';
    alignToGrid(true); // reset to first on sound change too
  });

  // Keyboard (Space toggle; arrows adjust BPM; Shift = ±5)
  document.addEventListener('keydown', (e)=>{
    if (pickerRoot && !pickerRoot.hidden) return;
    const tag = (e.target.tagName||'').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    if (typing) return;

    if (e.code === 'Space' && !e.altKey && !e.ctrlKey && !e.metaKey){
      e.preventDefault(); e.stopPropagation();
      isRunning ? stop() : start();
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight'){
      e.preventDefault(); e.stopPropagation();
      stepBpm(e.shiftKey ? +5 : +1);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft'){
      e.preventDefault(); e.stopPropagation();
      stepBpm(e.shiftKey ? -5 : -1);
    }
  });
  bpmRange && bpmRange.addEventListener('keydown', e=>{
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight'){
      e.preventDefault(); e.stopPropagation(); stepBpm(e.shiftKey ? +5 : +1);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft'){
      e.preventDefault(); e.stopPropagation(); stepBpm(e.shiftKey ? -5 : -1);
    }
  });

  /* ---------------- Init ---------------- */
  const defaults = { bpm:120, tsNum:'4', tsDen:'4', subdiv:'1/1', sound:'beep' };
  function applyDefaultsOnLoad(){
    setBpmUI(defaults.bpm);
    if (tsNum) tsNum.value = defaults.tsNum;
    if (tsDen) tsDen.value = defaults.tsDen;
    if (subdivSel) subdivSel.value = defaults.subdiv;
    if (soundSel) soundSel.value = defaults.sound;
    if (bpmRange) updateSliderFill(bpmRange);

    beatStates = defaultBeatStates();
    renderLights();

    const n = subsLightsCount();
    subStates = n > 0 ? defaultSubStates(n) : [];
    renderSubLights();

    if (tsNumTrigger) tsNumTrigger.value = tsNum.options[tsNum.selectedIndex]?.text || '';
    if (tsDenTrigger) tsDenTrigger.value = tsDen.options[tsDen.selectedIndex]?.text || '';
    if (subdivTrigger) subdivTrigger.value = subdivSel.options[subdivSel.selectedIndex]?.text || '';
    if (soundTrigger)  soundTrigger.value  = soundSel.options[soundSel.selectedIndex]?.text || '';

    alignToGrid(true); // start state: first light ready
  }
  [bpmRange,bpmInput,tsNum,tsDen,subdivSel,soundSel].forEach(el=>{ el && el.setAttribute('autocomplete','off'); });
  window.addEventListener('pageshow', (e)=>{ if (e.persisted) applyDefaultsOnLoad(); });

  applyDefaultsOnLoad();
});
