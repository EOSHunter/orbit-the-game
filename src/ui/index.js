// Vesper Drift — DOM UI layer (title, HUD, choice, pause, ending).
// Contract: createUI(root) -> { update, showChoice, showTitle, showEnd, warnBoundary, onPause, ... }

const FALLBACK_STAGES = [
  'Meteorite', 'Asteroid', 'Dwarf Planet', 'Rocky Planet', 'Gas Giant', 'Gas Planet',
  'Dwarf Star', 'Star', 'Giant Star', 'Supergiant Star', 'Neutron Star', 'Black Hole',
];

// Optional engine data; the UI works fine without it.
let engineStages = null;
try {
  const mod = await import('../stages.js');
  if (Array.isArray(mod.STAGES) && mod.STAGES.length) engineStages = mod.STAGES;
} catch (_) { /* standalone / demo: use fallbacks */ }

const stageName = (i) => {
  const s = engineStages && engineStages[i];
  const n = typeof s === 'string' ? s : s && (s.name || s.label || s.title);
  return n || FALLBACK_STAGES[i] || `Stage ${i + 1}`;
};
const STAGE_COUNT = Math.max(engineStages ? engineStages.length : 0, FALLBACK_STAGES.length);

// Mass bounds for progress. Prefers an explicit state.progress; else engine stage data; else a geometric guess.
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
function stageRange(i) {
  const s = engineStages && engineStages[i];
  if (s && typeof s === 'object') {
    const next = engineStages[i + 1];
    const enter = num(s.minMass ?? s.startMass ?? s.enterMass);
    const nextEnter = next && typeof next === 'object' ? num(next.minMass ?? next.startMass ?? next.enterMass) : null;
    if (enter !== null && nextEnter !== null) return [enter, nextEnter];
    const leave = num(s.threshold ?? s.massThreshold ?? s.evolveAt ?? s.nextMass ?? s.massToEvolve);
    if (leave !== null) {
      const prev = engineStages[i - 1];
      const prevLeave = prev && typeof prev === 'object'
        ? num(prev.threshold ?? prev.massThreshold ?? prev.evolveAt ?? prev.nextMass ?? prev.massToEvolve) : null;
      return [prevLeave ?? 0, leave];
    }
  }
  return [i === 0 ? 0 : 10 * Math.pow(2.2, i - 1), 10 * Math.pow(2.2, i)];
}

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function fmtMass(m) {
  if (!isFinite(m) || m < 0) m = 0;
  const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'k']];
  for (const [v, u] of units) if (m >= v) return (m / v).toFixed(m / v < 10 ? 2 : 1) + u;
  return m < 100 ? m.toFixed(1) : String(Math.round(m));
}
function fmtTime(t) {
  t = Math.max(0, Math.floor(t || 0));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

function el(tag, cls, text, attrs) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

const SVG_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>';
const SVG_WARN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3z"/><path d="M12 10v4M12 17.5v.01"/></svg>';
const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function createUI(root) {
  // Stylesheet (once per document).
  if (!document.getElementById('vd-ui-css')) {
    const link = el('link');
    link.id = 'vd-ui-css';
    link.rel = 'stylesheet';
    link.href = new URL('./ui.css', import.meta.url).href;
    document.head.appendChild(link);
  }
  if (getComputedStyle(root).position === 'static') root.style.position = 'relative';

  const ui = el('div', 'vd-ui');
  root.appendChild(ui);

  // ---------- Build DOM ----------
  const live = el('div', 'vd-sr', '', { 'aria-live': 'polite', 'aria-atomic': 'true', role: 'status' });

  // HUD
  const hud = el('div', 'vd-hud');
  const tl = el('div', 'vd-hud-tl');
  const nameEl = el('h2', 'vd-stage-name', stageName(0));
  const massRow = el('div', 'vd-mass-row');
  const massEl = el('span', 'vd-mass', '0.0');
  massRow.append(massEl, el('span', 'vd-caption', 'Mass'));
  const bar = el('div', 'vd-bar', '', { role: 'progressbar', 'aria-label': 'Progress to next stage', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' });
  const ghost = el('div', 'vd-bar-ghost');
  const fill = el('div', 'vd-bar-fill');
  bar.append(ghost, fill);
  const nextRow = el('div', 'vd-next vd-caption');
  const nextEl = el('span');
  const pctEl = el('span', '', '0%');
  nextRow.append(nextEl, pctEl);
  const ladder = el('ol', 'vd-ladder', '', { 'aria-label': 'Evolution stages' });
  const pips = [];
  for (let i = 0; i < STAGE_COUNT; i++) {
    const li = el('li', '', '', { title: stageName(i) });
    li.appendChild(el('span', 'vd-sr', stageName(i)));
    ladder.appendChild(li);
    pips.push(li);
  }
  tl.append(nameEl, massRow, bar, nextRow, ladder);

  const tr = el('div', 'vd-hud-tr');
  const timeEl = el('div', 'vd-time', '0:00');
  const timeCap = el('span', 'vd-caption', 'Run time');
  const pauseBtn = el('button', 'vd-icon-btn', '', { type: 'button', 'aria-label': 'Pause (Esc)', title: 'Pause (Esc)' });
  pauseBtn.innerHTML = SVG_PAUSE;
  tr.append(timeCap, timeEl, pauseBtn);

  const hint = el('div', 'vd-hint');
  hint.innerHTML = 'Steer with the <kbd>mouse</kbd> · absorb smaller bodies · avoid larger ones · <kbd>Esc</kbd> pauses';

  const warn = el('div', 'vd-warn', '', { role: 'alert' });
  warn.innerHTML = SVG_WARN;
  warn.append(el('span', '', 'Leaving the known sky — turn back'));

  const banner = el('div', 'vd-banner', '', { 'aria-hidden': 'true' });
  const bannerKicker = el('span', 'vd-caption vd-banner-kicker', 'Evolved');
  const bannerName = el('span', 'vd-banner-name');
  banner.append(bannerKicker, bannerName);

  hud.append(tl, tr, hint, warn, banner);

  // Overlays
  const overlay = (cls, label) => {
    const o = el('div', `vd-overlay ${cls}`, '', { role: 'dialog', 'aria-modal': 'true', 'aria-label': label });
    o.setAttribute('aria-hidden', 'true');
    o.inert = true;
    return o;
  };

  // Title
  const titleOv = overlay('vd-overlay--title', 'Vesper Drift');
  const titleStack = el('div', 'vd-stack');
  const logo = el('h1', 'vd-logo');
  logo.innerHTML = 'Vesper <span>Drift</span>';
  const startBtn = el('button', 'vd-btn vd-btn--primary', 'Begin the drift', { type: 'button' });
  titleStack.append(
    el('div', 'vd-orb', '', { 'aria-hidden': 'true' }),
    logo,
    el('p', 'vd-tagline', 'Grow from a glowing pebble into a black hole. Absorb what is smaller, avoid what is larger.'),
    startBtn,
    el('p', 'vd-fine', 'Steer with the mouse · Esc to pause'),
  );
  titleOv.appendChild(titleStack);

  // Choice
  const choiceOv = overlay('vd-overlay--dim', 'Choose your evolution');
  const choiceWrap = el('div', 'vd-choice-wrap');
  const choiceHead = el('h2', 'vd-heading vd-heading--orchid', 'Choose your evolution');
  const choiceSub = el('p', 'vd-fine', 'Pick with a click or press 1–4');
  const cards = el('ul', 'vd-cards');
  choiceWrap.append(choiceHead, cards, choiceSub);
  choiceOv.appendChild(choiceWrap);

  // Pause
  const pauseOv = overlay('vd-overlay--dim', 'Paused');
  const pauseStack = el('div', 'vd-stack');
  const resumeBtn = el('button', 'vd-btn vd-btn--primary', 'Resume', { type: 'button' });
  const pauseMenu = el('div', 'vd-menu');
  pauseMenu.appendChild(resumeBtn);
  pauseStack.append(el('h2', 'vd-heading', 'Paused'), el('p', 'vd-fine', 'The sky waits for you.'), pauseMenu);
  pauseOv.appendChild(pauseStack);

  // Ending
  const endOv = overlay('vd-overlay--dim', 'Run ended');
  const endStack = el('div', 'vd-stack');
  const endKicker = el('span', 'vd-caption', 'Ending');
  const endTitle = el('h2', 'vd-heading vd-heading--orchid');
  const endText = el('p', 'vd-ending-text');
  const stats = el('div', 'vd-stats vd-panel');
  const statEls = {};
  for (const [k, label] of [['time', 'Run time'], ['mass', 'Final mass'], ['stage', 'Reached']]) {
    const s = el('div', 'vd-stat');
    statEls[k] = el('b');
    s.append(el('span', 'vd-caption', label), statEls[k]);
    stats.appendChild(s);
  }
  const restartBtn = el('button', 'vd-btn vd-btn--primary', 'Drift again', { type: 'button' });
  endStack.append(endKicker, endTitle, endText, stats, restartBtn);
  endOv.appendChild(endStack);

  ui.append(hud, titleOv, choiceOv, pauseOv, endOv, live);

  // ---------- State ----------
  let last = null;            // last state seen
  let prevStage = null;
  let prevStatus = null;
  let shownMass = 0;
  let lastTick = performance.now();
  let textCache = {};
  let pauseCb = null;
  let paused = false;
  let activeOverlay = null;   // currently open modal overlay
  let returnFocus = null;
  let choiceHandler = null;   // { choices, onPick, done }
  let hintTimer = 0, bannerTimer = 0, barFlashTimer = 0;

  const setText = (key, node, value) => {
    if (textCache[key] !== value) { node.textContent = value; textCache[key] = value; }
  };

  // ---------- Overlay helpers ----------
  function openOverlay(o, focusEl) {
    if (activeOverlay && activeOverlay !== o) closeOverlay(activeOverlay, true);
    if (activeOverlay !== o) returnFocus = document.activeElement;
    activeOverlay = o;
    o.inert = false;
    o.removeAttribute('aria-hidden');
    o.classList.add('is-on');
    // Focus after the visibility transition kicks in.
    requestAnimationFrame(() => { (focusEl || o.querySelector(FOCUSABLE))?.focus({ preventScroll: true }); });
  }
  function closeOverlay(o, silent) {
    o.classList.remove('is-on');
    o.setAttribute('aria-hidden', 'true');
    o.inert = true;
    if (activeOverlay === o) {
      activeOverlay = null;
      if (!silent && returnFocus && document.contains(returnFocus) && typeof returnFocus.focus === 'function') returnFocus.focus({ preventScroll: true });
      if (!silent) returnFocus = null;
    }
  }

  // ---------- HUD update ----------
  function announce(msg) {
    live.textContent = '';
    // Re-set on next frame so repeated identical messages are still read.
    requestAnimationFrame(() => { live.textContent = msg; });
  }

  function showStageUp(i) {
    const name = stageName(i);
    nameEl.classList.remove('is-up'); void nameEl.offsetWidth; nameEl.classList.add('is-up');
    bannerName.textContent = name;
    banner.classList.remove('is-on'); void banner.offsetWidth; banner.classList.add('is-on');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => banner.classList.remove('is-on'), 1900);
    bar.classList.remove('is-flash'); void bar.offsetWidth; bar.classList.add('is-flash');
    clearTimeout(barFlashTimer);
    barFlashTimer = setTimeout(() => bar.classList.remove('is-flash'), 450);
    announce(`Evolved. Stage ${i + 1} of ${STAGE_COUNT}: ${name}.`);
  }

  function showHint() {
    hint.classList.add('is-on');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.remove('is-on'), 4000);
  }

  function update(state) {
    if (!state) return;
    last = state;
    const status = state.status;
    const now = performance.now();
    const dt = Math.min(0.25, (now - lastTick) / 1000);
    lastTick = now;

    const hudOn = status === 'playing' || status === 'choice';
    hud.classList.toggle('is-on', hudOn);

    if (status === 'playing' && prevStatus !== 'playing' && prevStatus !== 'choice') showHint();
    if (status === 'title' || status === 'ended') { hint.classList.remove('is-on'); }
    prevStatus = status;

    const idx = Math.max(0, Math.min(STAGE_COUNT - 1, state.stageIndex | 0));
    const name = stageName(idx);

    if (prevStage !== idx) {
      if (prevStage !== null && idx > prevStage && hudOn) showStageUp(idx);
      prevStage = idx;
      ladder.setAttribute('aria-label', `Evolution stages, currently ${name}, ${idx + 1} of ${STAGE_COUNT}`);
      for (let i = 0; i < pips.length; i++) {
        pips[i].classList.toggle('is-done', i < idx);
        pips[i].classList.toggle('is-current', i === idx);
        if (i === idx) pips[i].setAttribute('aria-current', 'step'); else pips[i].removeAttribute('aria-current');
      }
    }
    setText('name', nameEl, name);

    // Mass count-up (ease-out, ~300 ms)
    const mass = num(state.mass) ?? 0;
    if (reduceMotion() || Math.abs(mass - shownMass) < 0.05 || mass < shownMass) shownMass = mass;
    else shownMass += (mass - shownMass) * (1 - Math.exp(-dt / 0.1));
    setText('mass', massEl, fmtMass(shownMass));

    // Progress to next stage
    const finalStage = idx >= STAGE_COUNT - 1;
    let p;
    if (finalStage) p = 1;
    else if (num(state.progress) !== null) p = state.progress;
    else { const [a, b] = stageRange(idx); p = b > a ? (mass - a) / (b - a) : 0; }
    p = Math.max(0, Math.min(1, p));
    const pct = Math.floor(p * 100);
    if (textCache.p !== p) {
      textCache.p = p;
      fill.style.transform = ghost.style.transform = `scaleX(${p})`;
      bar.setAttribute('aria-valuenow', String(pct));
    }
    setText('pct', pctEl, finalStage ? 'Final form' : `${pct}%`);
    setText('next', nextEl, finalStage ? 'Nothing left to become' : `Next: ${stageName(idx + 1)}`);

    setText('time', timeEl, fmtTime(state.time));
  }

  // ---------- Screens ----------
  function showTitle(onStart) {
    paused = false;
    closeOverlay(pauseOv, true); closeOverlay(endOv, true); closeOverlay(choiceOv, true);
    hud.classList.remove('is-on');
    openOverlay(titleOv, startBtn);
    startBtn.onclick = () => {
      closeOverlay(titleOv);
      if (typeof onStart === 'function') onStart();
    };
  }

  function showEnd(ending, onRestart) {
    ending = ending || {};
    paused = false;
    closeOverlay(pauseOv, true); closeOverlay(choiceOv, true);
    endTitle.textContent = ending.title || 'The End';
    endText.textContent = ending.text || '';
    endText.hidden = !ending.text;
    statEls.time.textContent = fmtTime(last && last.time);
    statEls.mass.textContent = fmtMass(last ? last.mass : 0);
    statEls.stage.textContent = stageName(last ? Math.max(0, last.stageIndex | 0) : 0);
    announce(`${endTitle.textContent}. ${ending.text || ''}`);
    openOverlay(endOv, restartBtn);
    restartBtn.onclick = () => {
      closeOverlay(endOv);
      prevStage = null; shownMass = 0; textCache = {};
      if (typeof onRestart === 'function') onRestart();
    };
  }

  function showChoice(choices, onPick) {
    choices = (choices || []).slice(0, 4);
    if (!choices.length) return;
    cards.textContent = '';
    const done = { v: false };
    const buttons = choices.map((c, i) => {
      const li = el('li');
      const b = el('button', 'vd-card', '', { type: 'button', 'data-id': c.id });
      b.style.setProperty('--i', i);
      const key = el('span', 'vd-card-key', String(i + 1), { 'aria-hidden': 'true' });
      const lab = el('span', 'vd-card-label', c.label || c.id);
      const desc = el('span', 'vd-card-desc', c.description || '');
      b.append(key, lab, desc);
      b.setAttribute('aria-keyshortcuts', String(i + 1));
      b.onclick = () => pick(i);
      li.style.display = 'contents';
      li.appendChild(b);
      cards.appendChild(li);
      return b;
    });
    function pick(i) {
      if (done.v) return;
      done.v = true;
      choiceHandler = null;
      buttons.forEach((b, j) => b.classList.add(j === i ? 'is-picked' : 'is-dim'));
      const c = choices[i];
      announce(`Chose ${c.label || c.id}.`);
      setTimeout(() => {
        closeOverlay(choiceOv);
        if (typeof onPick === 'function') onPick(c.id, c);
      }, reduceMotion() ? 0 : 380);
    }
    choiceHandler = { pick, count: choices.length, done };
    openOverlay(choiceOv, buttons[0]);
    announce(`Evolution choice: ${choices.map((c, i) => `${i + 1}, ${c.label || c.id}`).join('; ')}.`);
  }

  function warnBoundary(on) {
    on = !!on;
    if (textCache.warn === on) return;
    textCache.warn = on;
    warn.classList.toggle('is-on', on);
  }

  // ---------- Pause ----------
  function setPaused(v, silent) {
    v = !!v;
    if (v === paused) return;
    if (v && !(last && last.status === 'playing') && !silent) return;
    paused = v;
    if (v) openOverlay(pauseOv, resumeBtn); else closeOverlay(pauseOv);
    announce(v ? 'Paused.' : 'Resumed.');
    if (!silent && pauseCb) pauseCb(paused);
  }
  pauseBtn.onclick = () => setPaused(true);
  resumeBtn.onclick = () => setPaused(false);

  // ---------- Keyboard ----------
  function onKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') {
      if (paused) { e.preventDefault(); setPaused(false); }
      else if (last && last.status === 'playing' && !activeOverlay) { e.preventDefault(); setPaused(true); }
      return;
    }
    if (choiceHandler && /^[1-4]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      if (i < choiceHandler.count) { e.preventDefault(); choiceHandler.pick(i); }
      return;
    }
    if (e.key === 'Tab' && activeOverlay) {
      const f = [...activeOverlay.querySelectorAll(FOCUSABLE)];
      if (!f.length) return;
      const first = f[0], lastEl = f[f.length - 1];
      if (!activeOverlay.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    }
  }
  document.addEventListener('keydown', onKey);

  // ---------- Responsive scale: min(w/1280, h/720) ----------
  function rescale() {
    const w = root.clientWidth || window.innerWidth, h = root.clientHeight || window.innerHeight;
    const s = Math.max(0.7, Math.min(1.5, Math.min(w / 1280, h / 720)));
    ui.style.setProperty('--s', s.toFixed(3));
  }
  rescale();
  let ro = null;
  if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(rescale); ro.observe(root); }
  else window.addEventListener('resize', rescale);

  function destroy() {
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', rescale);
    if (ro) ro.disconnect();
    clearTimeout(hintTimer); clearTimeout(bannerTimer); clearTimeout(barFlashTimer);
    ui.remove();
  }

  return {
    update,
    showChoice,
    showTitle,
    showEnd,
    warnBoundary,
    onPause(cb) { pauseCb = typeof cb === 'function' ? cb : null; },
    setPaused: (v) => setPaused(v, true), // programmatic; does not fire the onPause callback
    showHint,
    destroy,
  };
}
