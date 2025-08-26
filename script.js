/* === METRONOME — iOS-first fixes: one-tap start, pre-rendered clicks for crisp sound,
       smooth main-light transitions, thumb-only slider; main lights wrap to 2 rows;
       quarter-note subs silent; numerator auto-set: denom=3→3, denom=2→4, else unchanged.
       + Beat/Sub volume sliders wired
       + Picker: click-outside-to-close, Esc to close, hide list on no matches
       + iOS first-tap audio unlock on Start
       + Default Beat volume = 100% === */
document.addEventListener('DOMContentLoaded', () => {
  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  const root = $('#metronome'); if (!root) return;

  if (window.__METRO_BOUND__) return;
  window.__METRO_BOUND__ = true;

  /* ---------------- Elements ---------------- */
  const playBtn = $('#metroPlay');
  const tapBtn  = $('#tapTempoBtn');

  const bpmDec1Btn = $('#bpmDec1');
  const bpmDec5Btn = $('#bpmDec5');
  const bpmInc1Btn = $('#bpmInc1');
  const bpmInc5Btn = $('#bpmInc5');

  const bpmRange   = $('#metroBpmRange');
  const bpmInput   = $('#metroBpmInput');
  const bpmDisplay = $('#metroBpmValue');

  const tsNum     = $('#metroTSNum');
  const tsDen     = $('#metroTSDen');
  const subdivSel = $('#metroSubdivision');
  const soundSel  = $('#metroSound');

  const tsNumTrigger  = $('#tsNumTrigger');
  const tsDenTrigger  = $('#tsDenTrigger');
  const subdivTrigger = $('#subdivTrigger');
  const soundTrigger  = $('#soundTrigger');

  const lightsWrap    = $('#metroLights'); // main lights
  const subLightsWrap = $('#subLights');   // subdivision lights

  // Volume card elements (Beat/Sub)
  const mainVolRange = $('#mainVolRange');
  const mainVolValue = $('#mainVolValue');
  const subVolRange  = $('#subVolRange');
  const subVolValue  = $('#subVolValue');

  try { if (playBtn) playBtn.type = 'button'; } catch {}
  [playBtn, tapBtn, bpmDec1Btn, bpmDec5Btn, bpmInc1Btn, bpmInc5Btn].forEach(el=>{
    if (!el) return;
    try { el.style.touchAction = 'manipulation'; } catch {}
  });

  /* ---------------- Pressed visuals + smoother transitions ---------------- */
  const uiStyle = document.createElement('style');
  uiStyle.textContent = `
    .btn.is-pressing { filter: brightness(.92); transform: translateY(1px); }
    .btn--orange.is-pressing{ background: var(--orange-d); }
    .btn--purple.is-pressing{ background: var(--purple-d); }
    .selector.is-pressing, .picker__close.is-pressing { filter: brightness(.94); }
    /* Smoother color transitions for main metro lights on iOS */
    .metro-light{
      will-change: background-color, border-color, box-shadow, transform;
      transition: background-color 120ms linear, border-color 120ms linear, box-shadow 120ms linear;
      backface-visibility: hidden;
      transform: translateZ(0);
      -webkit-tap-highlight-color: transparent;
    }
    .metro-light.is-hit { transition: none; }
    .main-row, .sub-row { display: grid; gap: var(--light-gap, 10px); }
  `;
  document.head.appendChild(uiStyle);

  function wirePressedVisual(el){
    if (!el) return;
    const add = ()=> el.classList.add('is-pressing');
    const rm  = ()=> el.classList.remove('is-pressing');
    el.addEventListener('pointerdown', add, { passive:true });
    el.addEventListener('pointerup',   rm,  { passive:true });
    el.addEventListener('pointercancel', rm, { passive:true });
    el.addEventListener('pointerleave', rm, { passive:true });
    el.addEventListener('touchstart',  add, { passive:true });
    el.addEventListener('touchend',    rm,  { passive:true });
    el.addEventListener('touchcancel', rm,  { passive:true });
    el.addEventListener('click',       rm);
  }
  [playBtn, tapBtn, bpmDec1Btn, bpmDec5Btn, bpmInc1Btn, bpmInc5Btn,
   tsNumTrigger, tsDenTrigger, subdivTrigger, soundTrigger].forEach(wirePressedVisual);

  // Enable :active-like behavior on iOS
  document.addEventListener('touchstart', function(){}, { passive:true });

  /* ================= iOS slider fix (thumb-only) ================= */
  const IS_IOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
  if (IS_IOS) document.documentElement.classList.add('is-ios');

  function installThumbOnlySlider(rangeEl){
    if (!rangeEl) return;
    const wrap = document.createElement('div');
    wrap.className = 'slider-wrap';
    wrap.style.position = 'relative';
    wrap.style.display  = 'block';
    wrap.style.width    = '100%';
    rangeEl.parentNode.insertBefore(wrap, rangeEl);
    wrap.appendChild(rangeEl);

    const shield = document.createElement('div');
    Object.assign(shield.style, {
      position: 'absolute', inset: '0',
      background: 'transparent', zIndex: '5', touchAction: 'none'
    });
    wrap.appendChild(shield);

    const THUMB_RADIUS = 24;

    function thumbCenterX() {
      const rect = rangeEl.getBoundingClientRect();
      const min  = Number(rangeEl.min) || 0;
      const max  = Number(rangeEl.max) || 100;
      const v    = Number(rangeEl.value) || 0;
      const pct  = (v - min) / (max - min || 1);
      return rect.left + pct * rect.width;
    }
    function setFromClientX(clientX) {
      const rect = rangeEl.getBoundingClientRect();
      const x    = Math.min(Math.max(clientX - rect.left, 0), rect.width || 1);
      const min  = Number(rangeEl.min) || 0;
      const max  = Number(rangeEl.max) || 100;
      const val  = Math.round(min + (x / (rect.width || 1)) * (max - min));
      rangeEl.value = String(val);
      rangeEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function defocusSlider() {
      if (document.activeElement === rangeEl) rangeEl.blur();
    }

    document.addEventListener(
      'pointerdown',
      (e) => { if (e.target !== rangeEl) defocusSlider(); },
      { capture: true, passive: true }
    );

    let dragging = false;
    function start(e) {
      const t = e.touches ? e.touches[0] : e;
      const onThumb = Math.abs(t.clientX - thumbCenterX()) <= THUMB_RADIUS;

      if (!onThumb) {
        e.preventDefault();
        e.stopPropagation();
        defocusSlider();
        return;
      }

      dragging = true;
      e.preventDefault();
      e.stopPropagation();
      try { rangeEl.focus({ preventScroll:true }); } catch {}

      move(e);

      window.addEventListener('pointermove', move, { passive:false });
      window.addEventListener('pointerup',   end,  { passive:true, once:true });
      window.addEventListener('pointercancel', end,{ passive:true, once:true });
      window.addEventListener('touchmove',   move, { passive:false });
      window.addEventListener('touchend',    end,  { passive:true, once:true });
      window.addEventListener('touchcancel', end,  { passive:true, once:true });
    }
    function move(e) {
      if (!dragging) return;
      const t = e.touches ? e.touches[0] : e;
      setFromClientX(t.clientX);
      e.preventDefault();
    }
    function end() {
      if (!dragging) return;
      dragging = false;
      defocusSlider();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('touchmove',   move);
    }

    shield.addEventListener('pointerdown', start, { passive:false });
    shield.addEventListener('touchstart',  start, { passive:false });

    // Block native jump-to-click if pointer hits the input itself
    rangeEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, { passive:false });
  }
  if (IS_IOS) installThumbOnlySlider(bpmRange); // keep BPM fix scoped to BPM slider

  /* ---------------- Picker Modal ---------------- */
  const pickerRoot  = $('#pickerRoot');
  const pickerTitle = $('#pickerTitle');
  const pickerClose = $('#pickerClose');
  const pickerSearch= $('#pickerSearch');
  const pickerList  = $('#pickerList');
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

    let added = 0;
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
      added++;
    });

    // Hide list entirely if no matches
    if (added === 0){
      pickerList.hidden = true;
      pickerList.style.display = 'none';
    } else {
      pickerList.hidden = false;
      pickerList.style.display = '';
    }
  }
  pickerClose && pickerClose.addEventListener('click', closePicker);
  pickerSearch && pickerSearch.addEventListener('input', ()=> renderPickerList(pickerSearch.value));
  function attachPicker(trigger){
    const selectId = trigger.getAttribute('data-picker');
    const title    = trigger.getAttribute('data-title') || 'Select';
    const sel      = $('#'+selectId);
    if (!sel) return;
    trigger.value = sel.options[sel.selectedIndex]?.text || '';
    trigger.addEventListener('click', ()=>{
      if (pickerRoot && !pickerRoot.hidden && activeTrigger === trigger){
        closePicker(); // toggle close if already open for this trigger
      } else {
        openPicker(trigger, sel, title);
      }
    });
  }
  [tsNumTrigger, tsDenTrigger, subdivTrigger, soundTrigger].forEach(el=> el && attachPicker(el));
  // Click-outside-to-close (robust) + Esc
  const PANEL_SELECTOR = '.picker__panel, .picker-panel, .picker, [role="dialog"], [data-panel], [data-modal-panel]';
  function getPickerPanel(){
    return pickerRoot ? pickerRoot.querySelector(PANEL_SELECTOR) : null;
  }
  // Close when clicking ANYWHERE not inside the panel
  document.addEventListener('pointerdown', (e)=>{
    if (!pickerRoot || pickerRoot.hidden) return;
    const panel = getPickerPanel();
    if (panel && panel.contains(e.target)) return; // inside -> ignore
    closePicker(); // outside -> close
  }, { capture:true });
  // Esc to close
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && pickerRoot && !pickerRoot.hidden) closePicker();
  });

  /* ---------------- Helpers ---------------- */

  const EPS = 1e-6;
  const clampInt = (v,min,max)=>Math.max(min,Math.min(max,(parseInt(v,10)||0)));
  const getBpm = ()=>clampInt(bpmRange.value,0,400);

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
  function subsLightsCount(){
    const {a} = getSubdivParts();
    return Math.max(0, Math.floor(a));
  }
  function hasDenominator3(){
    const {b} = getSubdivParts();
    return b === 3;
  }
  function isQuartersSubdiv(){
    const {a,b} = getSubdivParts();
    return a === 1 && b === 1; // 1/1
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
    if (!lightsWrap) return;

    lightsWrap.innerHTML = '';
    const beats = clampInt(tsNum.value,1,12);
    if (!beatStates.length || beatStates.length !== beats) beatStates = defaultBeatStates();

    // Measure container and decide single-row vs two-row
    const cw = lightsWrap.clientWidth || lightsWrap.getBoundingClientRect().width || 0;
    const style = getComputedStyle(lightsWrap);
    const gap = parseFloat(style.gap || '20') || 20;
    const MIN_CELL = 28; // px

    const fitsSingleRow = (count)=> {
      if (count <= 0) return true;
      const totalGaps = gap * Math.max(0, count-1);
      const cellW = (cw - totalGaps) / count;
      return cellW >= MIN_CELL;
    };

    const n = beats;

    if (fitsSingleRow(n)){
      const row = document.createElement('div');
      row.className = 'main-row';
      const cellPx = Math.floor((cw - gap * Math.max(0, n-1)) / n);
      row.style.gridTemplateColumns = `repeat(${n}, ${cellPx}px)`;
      row.style.width = 'max-content';
      row.style.marginInline = 'auto';

      for (let i=0;i<n;i++){
        const d = document.createElement('div');
        d.className = 'metro-light';
        applyBeatClass(d, beatStates[i]);
        d.title = 'Click: Normal → Accent → None';
        d.addEventListener('click', ()=>{
          beatStates[i] = (beatStates[i] === 1) ? 2 : (beatStates[i] === 2 ? 0 : 1);
          applyBeatClass(d, beatStates[i]);
        });
        row.appendChild(d);
      }
      lightsWrap.appendChild(row);
    } else {
      let topCount    = Math.ceil(n/2);
      let bottomCount = n - topCount;

      const maxPerRow = Math.max(1, Math.floor((cw + gap) / (MIN_CELL + gap)));
      if (topCount > maxPerRow)    { topCount = maxPerRow; bottomCount = n - topCount; }
      if (bottomCount > maxPerRow) { bottomCount = maxPerRow; topCount   = n - bottomCount; }

      const maxCount = Math.max(topCount, bottomCount);
      const cellPx = Math.floor((cw - gap * Math.max(0, maxCount-1)) / maxCount);

      const rowTop = document.createElement('div');
      rowTop.className = 'main-row';
      rowTop.style.gridTemplateColumns = `repeat(${topCount}, ${cellPx}px)`;
      rowTop.style.width = 'max-content';
      rowTop.style.marginInline = 'auto';

      const rowBottom = document.createElement('div');
      rowBottom.className = 'main-row';
      rowBottom.style.gridTemplateColumns = `repeat(${bottomCount}, ${cellPx}px)`;
      rowBottom.style.width = 'max-content';
      rowBottom.style.marginInline = 'auto';

      for (let i=0;i<n;i++){
        const d = document.createElement('div');
        d.className = 'metro-light';
        applyBeatClass(d, beatStates[i]);
        d.title = 'Click: Normal → Accent → None';
        d.addEventListener('click', ()=>{
          beatStates[i] = (beatStates[i] === 1) ? 2 : (beatStates[i] === 2 ? 0 : 1);
          applyBeatClass(d, beatStates[i]);
        });
        (i < topCount ? rowTop : rowBottom).appendChild(d);
      }

      lightsWrap.appendChild(rowTop);
      lightsWrap.appendChild(rowBottom);
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

  function renderSubLights(){
    if (!subLightsWrap) return;

    // Quarters: hide lights (audio is also disabled in scheduler)
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

    if (!subStates.length || subStates.length !== n) subStates = defaultSubStates(n);

    const cw = subLightsWrap.clientWidth || subLightsWrap.getBoundingClientRect().width || 0;
    const style = getComputedStyle(subLightsWrap);
    const gap = parseFloat(style.gap || '20') || 20;
    const MIN_CELL = 28;

    const fitsSingleRow = (count)=> {
      if (count <= 0) return true;
      const totalGaps = gap * Math.max(0, count-1);
      const cellW = (cw - totalGaps) / count;
      return cellW >= MIN_CELL;
    };

    subLightsWrap.innerHTML = '';

    if (fitsSingleRow(n)){
      const row = document.createElement('div');
      row.className = 'sub-row';
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
      let topCount    = Math.ceil(n/2);
      let bottomCount = n - topCount;

      const maxPerRow = Math.max(1, Math.floor((cw + gap) / (MIN_CELL + gap)));
      if (topCount > maxPerRow)    { topCount = maxPerRow; bottomCount = n - topCount; }
      if (bottomCount > maxPerRow) { bottomCount = maxPerRow; topCount   = n - bottomCount; }

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

  // Resize re-render
  if ('ResizeObserver' in window){
    if (lightsWrap){
      const ro1 = new ResizeObserver(()=> renderLights());
      ro1.observe(lightsWrap);
    }
    if (subLightsWrap){
      const ro2 = new ResizeObserver(()=> renderSubLights());
      ro2.observe(subLightsWrap);
    }
  } else {
    window.addEventListener('resize', ()=>{ renderLights(); renderSubLights(); });
  }

  /* ---------------- Slider fill ---------------- */
  function updateSliderFill(rangeEl){
    if (!rangeEl) return;
    const min = parseFloat(rangeEl.min||'0');
    const max = parseFloat(rangeEl.max||'100');
    const val = parseFloat(rangeEl.value||'0');
    const pct = ((val-min)*100)/(max-min || 1);
    rangeEl.style.setProperty('--bg-pos', pct+'% 100%');
    // Use color by class; default purple, orange for .slider--orange
    const color = rangeEl.classList.contains('slider--orange') ? 'var(--orange)' : 'var(--purple)';
    rangeEl.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, var(--gray-1) ${pct}%, var(--gray-1) 100%)`;
  }

  /* ---------------- Audio ---------------- */
  let audioCtx=null, master=null, __audioUnlocked=false;

  function ensureCtx(){
    if (!audioCtx){
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new Ctx({ latencyHint: 'interactive' });
      } catch (_) { return; }

      master = audioCtx.createGain();
      master.gain.setValueAtTime(0.9, audioCtx.currentTime);
      master.connect(audioCtx.destination);
    }
  }

  // Pre-rendered click sample cache for oscillator presets (for crisp/identical hits)
  let sampleCache = {}; // { presetName: { sr, accent:AudioBuffer, beat:..., sub:..., subAccent:... } }

  function renderWaveSample(freq, shape, dur, sr){
    const len = Math.max(1, Math.floor(dur * sr));
    const data = new Float32Array(len);
    const twoPI = Math.PI * 2;
    const attack = Math.max(1, Math.floor(0.0008 * sr)); // ~0.8ms
    const tConst = dur * 0.22; // decay constant
    for (let i=0;i<len;i++){
      const t = i / sr;
      const phase = twoPI * freq * t;
      let x;
      switch (shape) {
        case 'square':   x = Math.sign(Math.sin(phase)) || 1; break;
        case 'triangle': x = 2/Math.PI * Math.asin(Math.sin(phase)); break;
        case 'sawtooth': {
          const frac = (freq * t) % 1;
          x = 2 * frac - 1;
          break;
        }
        default:         x = Math.sin(phase);
      }
      // simple fast-attack exponential decay envelope
      const env = i < attack ? (i/attack) : Math.exp(-t / tConst);
      data[i] = x * env;
    }
    const buf = (audioCtx ? audioCtx : { createBuffer:()=>null }).createBuffer?.(1, len, sr);
    if (buf) buf.copyToChannel(data, 0);
    return buf;
  }

  function ensurePresetSamples(){
    if (!audioCtx) return;
    const chosen = (soundSel?.value || 'beep');
    if (!/^(beep|click|analog)$/.test(chosen)) return; // others use procedural (wood/clave)
    const sr = audioCtx.sampleRate || 48000;
    const cached = sampleCache[chosen];
    if (cached && cached.sr === sr) return;

    const p = presets[chosen] || presets.beep;
    const out = { sr };
    ['accent','beat','sub','subAccent'].forEach(k=>{
      const spec = p[k] || p.beat;
      const [freq, shape, dur] = spec;
      out[k] = renderWaveSample(freq, shape || 'sine', dur, sr);
    });
    sampleCache[chosen] = out;
  }

  // One-time unlock on first gesture (global)
  function setupAudioUnlock(){
  if (__audioUnlocked) return;
  // Pointer-only to avoid iOS double-fire; keydown helps desktop
  const events = ['pointerdown','keydown'];
  const unlockOnce = () => {
    gestureUnlock();
    events.forEach(ev => document.removeEventListener(ev, unlockOnce, true));
  };
  events.forEach(ev => document.addEventListener(ev, unlockOnce, { capture:true, passive:true }));
}

function gestureUnlock(){
  if (__audioUnlocked) return;
  ensureCtx();
  if (!audioCtx) return;

  try { audioCtx.resume && audioCtx.resume(); } catch {}

  try {
    // iOS: 1-sample silent buffer opens the route
    const b = audioCtx.createBuffer(1, 1, 22050);
    const s = audioCtx.createBufferSource(); s.buffer = b; s.connect(master); s.start(0);

    // Android: prime with a zero-gain ConstantSource (some WebViews need this)
    if (audioCtx.createConstantSource){
      const cs = audioCtx.createConstantSource();
      const g  = audioCtx.createGain(); g.gain.value = 0.0;
      cs.connect(g).connect(master); cs.start();
      setTimeout(()=>{ try{ cs.stop(); }catch{} }, 30);
    }
  } catch {}

  ensurePresetSamples();
  __audioUnlocked = true;
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
  const kindScale   = k => k==='accent'?1.0 : k==='beat'?0.8 : 0.6;

  // === Volume state (Beat/Sub) ===
  let mainVol = 1.00; // 0.0–1.5 after mapping; affects 'accent' & 'beat'
  let subVol  = 0.80; // affects 'sub' & 'subAccent'

  function sliderToLinear(v){
    const t = Math.max(0, Math.min(100, Number(v)||0)) / 100;
    // gentle loudness curve (more resolution at lower values)
    return 1.5 * Math.pow(t, 0.7);
  }
  function updateMainVolFromUI(){
    if (!mainVolRange) return;
    mainVol = sliderToLinear(mainVolRange.value);
    if (mainVolValue) mainVolValue.textContent = `${Math.round(Number(mainVolRange.value)||0)}%`;
    updateSliderFill(mainVolRange);
  }
  function updateSubVolFromUI(){
    if (!subVolRange) return;
    subVol = sliderToLinear(subVolRange.value);
    if (subVolValue) subVolValue.textContent = `${Math.round(Number(subVolRange.value)||0)}%`;
    updateSliderFill(subVolRange);
  }
  if (mainVolRange) mainVolRange.addEventListener('input', updateMainVolFromUI);
  if (subVolRange)  subVolRange.addEventListener('input',  updateSubVolFromUI);

  function trigger(time, kind, gainMul=1){
    const chosen = (soundSel?.value || 'beep');
    const p = (presets[chosen] || presets.beep);
    const spec = p[kind] || (kind==='subAccent' ? p.sub : null) || p.beat;
    const [freq, shape, dur] = spec;
    if (!audioCtx || !master) return;

    const v = audioCtx.createGain();
    v.gain.cancelScheduledValues(time);

    // Apply group volume: mainVol for accent/beat, subVol for sub/subAccent
    const groupVol = (kind==='accent' || kind==='beat') ? mainVol : subVol;
    const base = gainMul * groupVol * kindScale(kind === 'subAccent' ? 'sub' : kind) * (presetLevel[chosen]||1);
    v.gain.setValueAtTime(base, time);
    v.connect(master);

    // Use pre-rendered buffers for oscillator presets
    const bank = sampleCache[chosen];
    if (bank && bank[kind] instanceof AudioBuffer){
      const src = audioCtx.createBufferSource();
      src.buffer = bank[kind];
      src.connect(v);
      src.start(time);
      return;
    }

    // Procedural for wood/clave (kept as-is)
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

    // Fallback oscillator path (if no buffer yet)
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

  /* ---------------- Scheduler (phase + reset) ---------------- */
  let isRunning=false;
  let currentBeatInBar=0;

  let beatCounter=0;
  let subCounter=0;

  let nextBeatTime=0;
  let nextSubTime=0;
  let scheduleTimer=null;
  let gridT0 = 0;

  const lookaheadMs = 25;
  const scheduleAheadTime = 0.12;

  function secondsPerBeat(){
    const bpm = getBpm();
    const den = clampInt(tsDen.value,1,16);
    return bpm>0 ? 60.0/bpm * (4/den) : Infinity;
  }

  function alignToGrid(resetToFirst=false){
    if (!audioCtx) return;

    const now   = audioCtx.currentTime;
    const spb   = secondsPerBeat();
    const ratio = getSubdivRatio();
    const beatsPerBar = clampInt(tsNum.value,1,12);

    if (resetToFirst){
      gridT0 = now + 0.05;
      beatCounter = 0;
      subCounter  = 0;
      currentBeatInBar = 0;

      nextBeatTime = gridT0;
      // Disable independent sub scheduling for quarters
      if (ratio > EPS && !isQuartersSubdiv()){
        nextSubTime = gridT0;
      } else {
        nextSubTime = Infinity;
      }

      clearHitClasses();
      return;
    }

    const anchor = gridT0 || (now + 0.05);

    beatCounter = Math.ceil((now - anchor - EPS) / spb);
    if (beatCounter < 0) beatCounter = 0;
    nextBeatTime = anchor + beatCounter * spb;
    currentBeatInBar = ((beatCounter % beatsPerBar) + beatsPerBar) % beatsPerBar;

    if (ratio > EPS){
      const subInterval = spb / ratio;
      subCounter = Math.ceil((now - anchor - EPS) / subInterval);
      if (subCounter < 0) subCounter = 0;
      nextSubTime = anchor + subCounter * subInterval;
    } else {
      nextSubTime = Infinity;
      subCounter  = 0;
    }
    clearHitClasses();
  }

  function schedule(){
    const spb   = secondsPerBeat();
    if (!isFinite(spb)) return;

    const ratio     = getSubdivRatio();
    const isQuarter = isQuartersSubdiv();

    const subEnabled   = (ratio > EPS) && !isQuarter;
    const subInterval  = subEnabled ? (spb / ratio) : Infinity;

    const beatsPerBar  = clampInt(tsNum.value,1,12);
    const anchor       = gridT0;
    const horizon      = audioCtx.currentTime + scheduleAheadTime;

    while (true){
      nextBeatTime = anchor + beatCounter * spb;
      if (nextBeatTime < audioCtx.currentTime - EPS){
        beatCounter = Math.ceil((audioCtx.currentTime - anchor - EPS) / spb);
        nextBeatTime = anchor + beatCounter * spb;
      }

      nextSubTime = subEnabled ? (anchor + subCounter * subInterval) : Infinity;
      if (subEnabled && nextSubTime < audioCtx.currentTime - EPS){
        subCounter = Math.ceil((audioCtx.currentTime - anchor - EPS) / subInterval);
        nextSubTime = anchor + subCounter * subInterval;
      }

      const tNext = Math.min(nextBeatTime, nextSubTime);
      if (tNext >= horizon) break;

      if (nextBeatTime <= nextSubTime + EPS){
        const state = beatStates[currentBeatInBar] ?? 1;
        if (state !== 0){
          trigger(nextBeatTime, state===2 ? 'accent' : 'beat');
          pulseLight(currentBeatInBar);
        }
        beatCounter++;
        currentBeatInBar = (currentBeatInBar + 1) % beatsPerBar;
        continue;
      }

      if (subEnabled){
        const lights = $$('.sub-light', subLightsWrap);
        const visibleCount = lights.length || 1;
        const visIdx = ((subCounter % visibleCount) + visibleCount) % visibleCount;

        const s = subStates[visIdx] ?? 1; // 0 none, 1 normal, 2 accent
        if (s === 2) trigger(nextSubTime, 'subAccent');
        else if (s === 1) trigger(nextSubTime, 'sub');
        pulseSubLightAt(visIdx);

        subCounter++;
      }
    }
  }

  async function robustResume(){
    ensureCtx();
    if (!audioCtx) return false;
    ensurePresetSamples(); // build samples for current preset
    try { await audioCtx.resume(); } catch {}
    if (audioCtx.state !== 'running'){
      try {
        const b = audioCtx.createBuffer(1, 1, 22050);
        const s = audioCtx.createBufferSource();
        s.buffer = b; s.connect(master); s.start(0);
      } catch {}
      try { await audioCtx.resume(); } catch {}
    }
    return audioCtx.state === 'running';
  }

  /* ---------- Fast-press helper; also performs synchronous unlock ---------- */
  function addFastPress(el, handler){
    if (!el) return;
    let suppressClickUntil = 0;
    el.addEventListener('pointerdown', (e) => {
      if (e.button != null && e.button !== 0) return;
      gestureUnlock(); // ensure unlocked before toggle on iOS
      suppressClickUntil = performance.now() + 350;
      handler(e);
    }, { passive:true });
    el.addEventListener('click', (e) => {
      if (performance.now() < suppressClickUntil) {
        e.preventDefault(); e.stopPropagation(); return;
      }
      gestureUnlock(); // safety net
      handler(e);
    });
  }

  async function start(){
    if (isRunning) return;
    const ok = await robustResume();
    if (!ok) return;
    if (getBpm() === 0){ return; }
    isRunning = true;
    if (playBtn) { playBtn.textContent = 'Stop'; playBtn.setAttribute('aria-pressed','true'); }

    alignToGrid(true);
    schedule(); // schedule immediately
    if (scheduleTimer) clearInterval(scheduleTimer);
    scheduleTimer = setInterval(schedule, lookaheadMs);
  }
  function stop(){
    if (!isRunning) return;
    clearInterval(scheduleTimer); scheduleTimer=null; isRunning=false;
    if (playBtn) { playBtn.textContent = 'Start'; playBtn.setAttribute('aria-pressed','false'); }
    alignToGrid(true);
  }

  // Mobile first-tap start: unlock on pointerdown, toggle on pointerup (prevents 2-tap)
  // ONE-HANDLER mobile-safe toggle (pointer-only to avoid iOS double fire)
if (playBtn){
  let lastToggleTs = 0;
  const tooSoon = () => (performance.now() - lastToggleTs) < 260;

  const toggle = async (e) => {
    if (tooSoon()) { e.preventDefault(); e.stopPropagation(); return; }
    lastToggleTs = performance.now();
    e.preventDefault(); e.stopPropagation();

    // Make sure audio is unlocked and running inside the same gesture
    gestureUnlock();
    await robustResume();

    if (getBpm() === 0) return;
    isRunning ? stop() : start();
  };

  if (window.PointerEvent){
    // Use pointer events ONLY (don’t also bind touchend on iOS)
    playBtn.addEventListener('pointerdown', () => { gestureUnlock(); ensurePresetSamples(); }, { passive:true });
    playBtn.addEventListener('pointerup',   toggle, { passive:false });

    // Eat the follow-up synthetic click so it can’t double-toggle
    playBtn.addEventListener('click', (e)=>{
      if (tooSoon()) { e.preventDefault(); e.stopPropagation(); }
    }, { capture:true });
  } else {
    // Fallback for very old Android WebViews
    playBtn.addEventListener('touchstart', ()=>{ gestureUnlock(); ensurePresetSamples(); }, { passive:true });
    playBtn.addEventListener('touchend',   toggle, { passive:false });
    playBtn.addEventListener('click',      toggle, { passive:false });
  }
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
  tapBtn && tapBtn.addEventListener('click', onTap);

  /* ---------------- UI sync ---------------- */
  function setBpmUI(val){
    const v = clampInt(val,0,400);
    if (bpmRange)   bpmRange.value   = String(v);
    if (bpmInput)   bpmInput.value   = String(v);
    if (bpmDisplay) bpmDisplay.textContent = String(v);
    if (bpmRange)   updateSliderFill(bpmRange);
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

  /* ---------------- Numerator auto-set rule ----------------
     If subdivision's denominator == 3 → numerator = '3'
     Else if denominator == 2 → numerator = '4'
     Else → leave numerator unchanged
  ---------------------------------------------------------- */
  function autoSetNumeratorBySubdivision(){
    const { b } = getSubdivParts();
    let targetNum = null;
    if (b === 3) targetNum = '3';
    else if (b === 2) targetNum = '4';
    if (targetNum && tsNum && tsNum.value !== targetNum){
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

    alignToGrid(true);
  }));

  soundSel && soundSel.addEventListener('change', ()=>{
    if (soundTrigger) soundTrigger.value = soundSel.options[soundSel.selectedIndex]?.text || '';
    ensurePresetSamples(); // update buffers for new preset
    alignToGrid(true);
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
  const defaults = {
    bpm:120, tsNum:'4', tsDen:'4', subdiv:'1/1', sound:'beep',
    mainVol: 100, // Beat volume default now 100%
    subVol : 70
  };

  function applyDefaultsOnLoad(){
    setBpmUI(defaults.bpm);
    if (tsNum)     tsNum.value     = defaults.tsNum;
    if (tsDen)     tsDen.value     = defaults.tsDen;
    if (subdivSel) subdivSel.value = defaults.subdiv;   // quarters
    if (soundSel)  soundSel.value  = defaults.sound;
    if (bpmRange)  updateSliderFill(bpmRange);

    // Volume sliders
    if (mainVolRange){ mainVolRange.value = String(defaults.mainVol); updateMainVolFromUI(); }
    if (subVolRange){  subVolRange.value  = String(defaults.subVol);  updateSubVolFromUI();  }

    beatStates = defaultBeatStates();
    renderLights();

    const n = subsLightsCount();
    subStates = n > 0 ? defaultSubStates(n) : [];
    renderSubLights();

    if (tsNumTrigger)  tsNumTrigger.value  = tsNum.options[tsNum.selectedIndex]?.text || '';
    if (tsDenTrigger)  tsDenTrigger.value  = tsDen.options[tsDen.selectedIndex]?.text || '';
    if (subdivTrigger) subdivTrigger.value = subdivSel.options[subdivSel.selectedIndex]?.text || '';
    if (soundTrigger)  soundTrigger.value  = soundSel.options[soundSel.selectedIndex]?.text || '';

    // Prebuild samples; if AudioContext not ready yet, they'll build on first Start.
    ensureCtx(); if (audioCtx) ensurePresetSamples();

    alignToGrid(true); // start at first; quarters have no sub audio
  }

  [bpmRange,bpmInput,tsNum,tsDen,subdivSel,soundSel].forEach(el=>{ el && el.setAttribute('autocomplete','off'); });
  window.addEventListener('pageshow', (e)=>{ if (e.persisted) applyDefaultsOnLoad(); });

  setupAudioUnlock(); // global unlock
  document.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'visible' && audioCtx && audioCtx.state !== 'running'){
      try { audioCtx.resume(); } catch {}
    }
  });

  applyDefaultsOnLoad();
});
