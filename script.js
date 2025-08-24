/* === METRONOME with modal pickers & mobile transport layout === */
document.addEventListener('DOMContentLoaded', () => {
  const $ = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  const root = $('#metronome'); if (!root) return;

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

  const lightsWrap = $('#metroLights');

  /* ---------------- Picker Modal (overlay) ---------------- */
  const pickerRoot = $('#pickerRoot');
  const pickerTitle = $('#pickerTitle');
  const pickerClose = $('#pickerClose');
  const pickerSearch = $('#pickerSearch');
  const pickerList = $('#pickerList');
  let activeSelect = null, activeTrigger = null;

  function openPicker(trigger, selectEl, titleText){
    activeSelect = selectEl;
    activeTrigger = trigger;
    pickerTitle.textContent = titleText || 'Select';
    pickerSearch.value = '';
    renderPickerList('');
    pickerRoot.hidden = false;
    document.body.classList.add('modal-open');
    pickerSearch.focus({preventScroll:true});
  }

  function closePicker(){
    pickerRoot.hidden = true;
    document.body.classList.remove('modal-open');
    activeSelect = null; activeTrigger = null;
  }

  function renderPickerList(filter){
    pickerList.innerHTML = '';
    const opts = [...activeSelect.options];
    const q = filter.trim().toLowerCase();
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

  pickerClose.addEventListener('click', closePicker);
  pickerSearch.addEventListener('input', ()=> renderPickerList(pickerSearch.value));
  document.addEventListener('keydown', (e)=>{
    if (!pickerRoot.hidden && e.key === 'Escape') closePicker();
  });
  pickerRoot.addEventListener('click', (e)=>{ if (e.target === pickerRoot) closePicker(); });

  function attachPicker(trigger){
    const selectId = trigger.getAttribute('data-picker');
    const title = trigger.getAttribute('data-title') || 'Select';
    const sel = $('#'+selectId);
    if (!sel) return;
    // Set initial trigger text
    trigger.value = sel.options[sel.selectedIndex]?.text || '';
    trigger.addEventListener('click', ()=> openPicker(trigger, sel, title));
  }
  [tsNumTrigger, tsDenTrigger, subdivTrigger, soundTrigger].forEach(el=> el && attachPicker(el));

  /* ---------------- Metronome core ---------------- */
  const MUTE_SUBDIV_ON_MUTED_BEAT = true;
  const clampInt = (v,min,max)=>Math.max(min,Math.min(max,(parseInt(v,10)||0)));
  const getBpm = ()=>clampInt(bpmRange.value,0,400);
  const getSubdiv = ()=>clampInt(subdivSel.value, 1, 10);

  // Beat states per bar: 0=muted, 1=normal, 2=accent (click cycles: 1→2→0→1)
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

  // Slider purple fill
  function updateSliderFill(rangeEl){
    const min = parseFloat(rangeEl.min||'0');
    const max = parseFloat(rangeEl.max||'100');
    const val = parseFloat(rangeEl.value||'0');
    const pct = ((val-min)*100)/(max-min);
    rangeEl.style.setProperty('--bg-pos', pct+'% 100%');
    rangeEl.style.background = `linear-gradient(to right, var(--purple) 0%, var(--purple) ${pct}%, var(--gray-1) ${pct}%, var(--gray-1) 100%)`;
  }

  // Audio
  let audioCtx=null, master=null, comp=null;
  function ensureCtx(){
    if (!audioCtx){
      audioCtx = new (window.AudioContext||window.webkitAudioContext)();
      master = audioCtx.createGain();
      master.gain.value = 0.9;

      // Gentle compressor to normalize perceived loudness across timbres
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
    beep:   { accent:[1760,'sine',0.02],      beat:[880,'sine',0.018],     sub:[440,'sine',0.012] },
    click:  { accent:[3000,'triangle',0.008], beat:[2500,'square',0.006],  sub:[2000,'square',0.004] },
    wood:   { accent:['wood',null,0.028],     beat:['wood',null,0.022],    sub:['wood',null,0.016] },
    clave:  { accent:['clave',null,0.028],    beat:['clave',null,0.020],   sub:['clave',null,0.014] },
    analog: { accent:[1200,'sawtooth',0.020], beat:[900,'sawtooth',0.016], sub:[700,'sawtooth',0.012] },
  };
  const presetLevel = { beep:1.00, click:1.00, wood:1.00, clave:1.00, analog:1.00 };
  const kindScale = k => k==='accent'?1.0 : k==='beat'?0.8 : 0.6;

  function trigger(time, kind){
    const chosen = (soundSel?.value || 'beep');
    const p = (presets[chosen] || presets.beep);
    const [freq, shape, dur] = p[kind];
    if (!audioCtx || !master) return;

    const v = audioCtx.createGain();
    v.gain.setValueAtTime(kindScale(kind)*(presetLevel[chosen]||1), time);
    v.connect(master);

    if (freq === 'wood'){
      const n = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
      const buffer = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i=0;i<n;i++) data[i] = (Math.random()*2-1) * Math.exp(-i/(n*0.22));
      const src = audioCtx.createBufferSource(); src.buffer = buffer;
      const bp = audioCtx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1550; bp.Q.value=3.2;
      src.connect(bp).connect(v);
      src.start(time);
      return;
    }
    if (freq === 'clave'){
      const o1 = audioCtx.createOscillator(); o1.type='square';   o1.frequency.setValueAtTime(2350, time);
      const o2 = audioCtx.createOscillator(); o2.type='triangle'; o2.frequency.setValueAtTime(1180, time);
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

  // Scheduler
  let isRunning=false, currentBeatInBar=0, tickCount=0, nextNoteTime=0, scheduleTimer=null;
  const lookaheadMs = 25, scheduleAheadTime = 0.1;

  function secondsPerBeat(){
    const bpm = getBpm();
    const den = clampInt(tsDen.value,1,16);
    return bpm>0 ? 60.0/bpm * (4/den) : Infinity;
  }

  function pulseLight(beatIndex){
    const lights = $$('.metro-light', lightsWrap);
    lights.forEach((el,i)=>{
      el.classList.toggle('is-hit', i===beatIndex);
      if (i===beatIndex) setTimeout(()=>el.classList.remove('is-hit'), 60);
    });
  }

  function schedule(){
    const spb = secondsPerBeat();
    if (!isFinite(spb)) return;

    const ticksPerBeat = getSubdiv();
    while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime){
      const tickInBeat = tickCount % ticksPerBeat;
      const isBeatTick = (tickInBeat === 0);

      if (isBeatTick){
        const state = beatStates[currentBeatInBar] ?? 1;
        if (state !== 0){
          const kind = (state===2) ? 'accent' : 'beat';
          trigger(nextNoteTime, kind);
          pulseLight(currentBeatInBar);
        }
        nextNoteTime += spb / ticksPerBeat;
        tickCount++;
        currentBeatInBar = (currentBeatInBar + 1) % clampInt(tsNum.value,1,12);
      } else {
        const hostState = beatStates[currentBeatInBar] ?? 1;
        if (!(MUTE_SUBDIV_ON_MUTED_BEAT && hostState === 0)){
          trigger(nextNoteTime, 'sub');
        }
        nextNoteTime += spb / ticksPerBeat;
        tickCount++;
      }
    }
  }

  function start(){
    if (isRunning) return;
    ensureCtx(); audioCtx.resume && audioCtx.resume();
    if (getBpm() === 0){ return; }

    isRunning = true;
    playBtn.textContent = 'Stop';
    playBtn.setAttribute('aria-pressed','true');

    currentBeatInBar = 0; tickCount = 0; nextNoteTime = audioCtx.currentTime + 0.05;
    if (scheduleTimer) clearInterval(scheduleTimer);
    scheduleTimer = setInterval(schedule, lookaheadMs);
  }
  function stop(){
    if (!isRunning) return;
    clearInterval(scheduleTimer); scheduleTimer=null; isRunning=false;
    playBtn.textContent = 'Start';
    playBtn.setAttribute('aria-pressed','false');
  }
  function softReset(){ if (isRunning){ currentBeatInBar=0; tickCount=0; nextNoteTime=audioCtx.currentTime+0.05; } }

  // Tap Tempo — lock exactly on 4th tap (median of last 3 intervals)
  const TAP_RESET_MS = 1500;
  let tapTimes = [];
  function onTap(){
    const now = performance.now();
    if (tapTimes.length && (now - tapTimes[tapTimes.length - 1]) > TAP_RESET_MS) tapTimes = [];
    tapTimes.push(now);
    if (tapTimes.length > 4) tapTimes.shift();
    if (tapTimes.length === 4){
      const [t0,t1,t2,t3] = tapTimes;
      const ivals = [t1-t0, t2-t1, t3-t2].sort((a,b)=>a-b);
      const ms = ivals[1];
      const bpm = clampInt(Math.round(60000 / ms), 0, 400);
      setBpmUI(bpm);
      softReset();
    }
  }

  // UI sync
  function setBpmUI(val){
    const v = clampInt(val,0,400);
    bpmRange.value = String(v);
    bpmInput.value = String(v);
    bpmDisplay.textContent = String(v);
    updateSliderFill(bpmRange);
  }

  // +/- stacks around the BPM number
  function stepBpm(delta){ setBpmUI(getBpm() + delta); if (isRunning && getBpm()===0) stop(); }
  bpmDec1Btn.addEventListener('click', ()=>stepBpm(-1));
  bpmDec5Btn.addEventListener('click', ()=>stepBpm(-5));
  bpmInc1Btn.addEventListener('click', ()=>stepBpm(+1));
  bpmInc5Btn.addEventListener('click', ()=>stepBpm(+5));

  // Listeners
  playBtn.addEventListener('click', e=>{ e.preventDefault(); isRunning ? stop() : start(); });
  tapBtn.addEventListener('click', onTap);

  bpmRange.addEventListener('input', e=>{ setBpmUI(e.target.value); if (isRunning && getBpm()===0) stop(); });
  bpmInput.addEventListener('input', e=> setBpmUI(e.target.value||0));

  [tsNum, tsDen, subdivSel].forEach(el=> el.addEventListener('change', ()=>{
    // sync trigger text to selected option
    if (el === tsNum) tsNumTrigger.value = tsNum.options[tsNum.selectedIndex]?.text || '';
    if (el === tsDen) tsDenTrigger.value = tsDen.options[tsDen.selectedIndex]?.text || '';
    if (el === subdivSel) subdivTrigger.value = subdivSel.options[subdivSel.selectedIndex]?.text || '';

    beatStates = defaultBeatStates(); renderLights(); softReset();
  }));
  soundSel.addEventListener('change', ()=>{
    soundTrigger.value = soundSel.options[soundSel.selectedIndex]?.text || '';
  });

  // Spacebar toggle (ignore when typing in inputs)
  document.addEventListener('keydown', e=>{
    const tag = (e.target.tagName||'').toLowerCase();
    if (e.code === 'Space' && tag !== 'input' && tag !== 'textarea' && tag !== 'select' && !e.altKey && !e.ctrlKey && !e.metaKey){
      e.preventDefault(); isRunning ? stop() : start();
    }
  });

  // ----- Init (defaults each load)
  const defaults = { bpm:120, tsNum:'4', tsDen:'4', subdiv:'1', sound:'beep' };
  function applyDefaultsOnLoad(){
    setBpmUI(defaults.bpm);
    tsNum.value = defaults.tsNum;
    tsDen.value = defaults.tsDen;
    subdivSel.value = defaults.subdiv;
    soundSel.value = defaults.sound;
    updateSliderFill(bpmRange);
    beatStates = defaultBeatStates();
    renderLights();

    // Sync trigger texts
    tsNumTrigger.value = tsNum.options[tsNum.selectedIndex]?.text || '';
    tsDenTrigger.value = tsDen.options[tsDen.selectedIndex]?.text || '';
    subdivTrigger.value = subdivSel.options[subdivSel.selectedIndex]?.text || '';
    soundTrigger.value = soundSel.options[soundSel.selectedIndex]?.text || '';
  }
  [bpmRange,bpmInput,tsNum,tsDen,subdivSel,soundSel].forEach(el=>{ el && el.setAttribute('autocomplete','off'); });
  window.addEventListener('pageshow', (e)=>{ if (e.persisted) applyDefaultsOnLoad(); });

  applyDefaultsOnLoad();
});
