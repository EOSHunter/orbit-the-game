// Vesper Drift — DOM UI layer (title, HUD, choice, systems/pause, ending). Contract: docs/interfaces.md §6.
//
// Two ways in, same implementation:
//   • 3D build (contract): init(opts) then module functions showTitle/showChoice/showEnd/update/attach/...
//   • 2D build (legacy):   createUI(root) -> { update, showChoice, showTitle, showEnd, warnBoundary, onPause, ... }
// Imports nothing but stages.js / looks.js (both optional, read-only).

import { el, num, clamp, fmtMass, fmtTime, fmtDist, fmtBearing, clsName, icon, stageGlyph } from './util.js';
import { createHud } from './hud.js';

const FALLBACK_STAGES = [
  'Meteorite', 'Asteroid', 'Dwarf Planet', 'Rocky Planet', 'Gas Giant', 'Gas Planet',
  'Dwarf Star', 'Star', 'Giant Star', 'Supergiant Star', 'Neutron Star', 'Black Hole',
];
const FALLBACK_RELATION = { prey: '#5FF0C0', neutral: '#7FD6FF', threat: '#FF5E73' };
const SETTINGS_KEY = 'vd.settings';
const QUALITIES = ['low', 'med', 'high', 'auto'];
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

// Optional data modules; the UI works without either.
let engineStages = null, abandonId = 'abandon_evolution', relation = FALLBACK_RELATION;
try {
  const mod = await import('../stages.js');
  if (Array.isArray(mod.STAGES) && mod.STAGES.length) engineStages = mod.STAGES;
  if (mod.ABANDON_ID) abandonId = mod.ABANDON_ID;
} catch (_) { /* standalone demo */ }
try {
  const looks = await import('../data/looks.js');
  const r = looks.PRESETS && looks.PRESETS.relation;
  if (r && r.prey && r.neutral && r.threat) relation = r;
} catch (_) { /* looks.js not shipped yet: local fallback */ }

const stageName = (i) => {
  const s = engineStages && engineStages[i];
  const n = typeof s === 'string' ? s : s && (s.name || s.label || s.title);
  return n || FALLBACK_STAGES[i] || `Stage ${i + 1}`;
};
const STAGE_COUNT = Math.max(engineStages ? engineStages.length : 0, FALLBACK_STAGES.length);
function stageRange(i) {
  const s = engineStages && engineStages[i], n = engineStages && engineStages[i + 1];
  const a = s && num(s.minMass), b = n && num(n.minMass);
  if (a !== null && a !== undefined && b !== null && b !== undefined) return [a, b];
  return [i === 0 ? 0 : 10 * Math.pow(2.2, i - 1), 10 * Math.pow(2.2, i)];
}

const mqReduce = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

function defaultSettings() {
  return { master: 0.8, music: 0.7, sfx: 0.8, quality: 'auto', reducedMotion: !!(mqReduce && mqReduce.matches), readability: false, topDown: false, trajectory: false };
}
function loadSettings() {
  const d = defaultSettings();
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      for (const k of ['master', 'music', 'sfx']) if (num(raw[k]) !== null) d[k] = clamp(raw[k], 0, 1);
      if (QUALITIES.includes(raw.quality)) d.quality = raw.quality;
      for (const k of ['reducedMotion', 'readability', 'topDown', 'trajectory']) if (typeof raw[k] === 'boolean') d[k] = raw[k];
    }
  } catch (_) { /* private mode / bad JSON: defaults */ }
  return d;
}

// ---------------------------------------------------------------------------------------------
export function createUI(root, opts = {}) {
  root = root || document.getElementById('ui') || document.body;
  if (!document.getElementById('vd-ui-css')) {
    const link = el('link');
    link.id = 'vd-ui-css';
    link.rel = 'stylesheet';
    link.href = new URL('./ui.css', import.meta.url).href;
    document.head.appendChild(link);
  }
  if (root !== document.body && getComputedStyle(root).position === 'static') root.style.position = 'relative';
  // The mount point covers the canvas; only interactive children take the pointer.
  root.style.pointerEvents = 'none';

  const sound = (name) => { try { if (typeof opts.onUiSound === 'function') opts.onUiSound(name); } catch (_) { /* never break UI */ } };
  let settings = loadSettings();
  const emitSettings = () => { try { if (typeof opts.onSettings === 'function') opts.onSettings({ ...settings }); } catch (_) { /* ignore */ } };
  const reduced = () => settings.reducedMotion || !!(mqReduce && mqReduce.matches);

  const ui = el('div', 'vd-ui');
  ui.style.setProperty('--prey', relation.prey);
  ui.style.setProperty('--neutral', relation.neutral);
  ui.style.setProperty('--threat', relation.threat);
  const grain = el('div', 'vd-grain', null, { 'aria-hidden': 'true' });
  const live = el('div', 'vd-sr', '', { 'aria-live': 'polite', 'aria-atomic': 'true', role: 'status' });
  const liveAlert = el('div', 'vd-sr', '', { 'aria-live': 'assertive', 'aria-atomic': 'true', role: 'alert' });
  function announce(msg, assertive) {
    const node = assertive ? liveAlert : live;
    node.textContent = '';
    requestAnimationFrame(() => { node.textContent = msg; });
  }

  // ---------- State ----------
  let last = null;
  let prevStatus = null;
  let lastTick = performance.now();
  let pauseCb = typeof opts.onPause === 'function' ? opts.onPause : null;
  let paused = false;          // UI-side pause (systems panel opened in play)
  let activeOverlay = null;
  let returnFocus = null;
  let choiceHandler = null;
  let menuFromTitle = false;
  let bus = null, offs = [];
  let uiScale = 1;

  const hud = createHud({
    stageName, stageCount: STAGE_COUNT, stageRange, announce, sound, reduced, scale: () => uiScale,
    getSettings: () => settings,
    openMenu: () => openMenu(),
    capture: () => doCapture(),
    canCapture: (s) => typeof opts.onAction === 'function' && !(s && s.flags && s.flags.captureLocked),
    toggleSetting: (k) => { setSetting(k, !settings[k]); sound('ui.click'); },
  });

  // ---------- Overlay helpers ----------
  const overlay = (cls, label) => {
    const o = el('div', `vd-overlay ${cls}`, '', { role: 'dialog', 'aria-modal': 'true', 'aria-label': label, 'aria-hidden': 'true' });
    o.inert = true;
    return o;
  };
  function openOverlay(o, focusEl) {
    if (activeOverlay && activeOverlay !== o) closeOverlay(activeOverlay, true);
    if (activeOverlay !== o) returnFocus = document.activeElement;
    activeOverlay = o;
    o.inert = false;
    o.removeAttribute('aria-hidden');
    o.classList.add('is-on');
    requestAnimationFrame(() => { (focusEl || o.querySelector(FOCUSABLE))?.focus({ preventScroll: true }); });
  }
  function closeOverlay(o, silent) {
    if (!o.classList.contains('is-on') && o.inert) return;
    o.classList.remove('is-on');
    o.setAttribute('aria-hidden', 'true');
    o.inert = true;
    if (activeOverlay === o) {
      activeOverlay = null;
      if (!silent && returnFocus && document.contains(returnFocus) && typeof returnFocus.focus === 'function') returnFocus.focus({ preventScroll: true });
      returnFocus = null;
    }
  }
  const btn = (cls, label, attrs) => {
    const b = el('button', `vd-btn vd-frame vd-interactive ${cls || ''}`, null, { type: 'button', ...attrs });
    b.append(el('span', 'vd-btn-label', label));
    return b;
  };

  // ---------- Title ----------
  const titleOv = overlay('vd-overlay--title', 'Vesper Drift');
  const titleStack = el('div', 'vd-title');
  const emblem = el('div', 'vd-emblem', null, { 'aria-hidden': 'true' });
  emblem.innerHTML =
    '<svg viewBox="-60 -60 120 120"><circle r="56" class="e-ring e-dash"/><circle r="44" class="e-ring"/>' +
    '<ellipse rx="54" ry="14" class="e-orbit e-o1"/><ellipse rx="54" ry="14" class="e-orbit e-o2"/>' +
    '<circle r="9" class="e-core"/><circle r="2.6" cx="54" class="e-moon"/></svg>';
  const logo = el('h1', 'vd-logo');
  logo.innerHTML = '<span class="vd-logo-a">Vesper</span><span class="vd-logo-b">Drift</span>';
  const titleSub = el('p', 'vd-title-sub vd-mono', 'ACCRETION SURVEY // CLASS-0 BODY // NAV LINK ESTABLISHED');
  const titleTag = el('p', 'vd-tagline', 'Grow from a drifting pebble into a black hole. Absorb what is smaller; avoid what is larger.');
  const startBtn = btn('vd-btn--primary', 'Initiate drift', { 'aria-keyshortcuts': 'Enter' });
  const titleSettingsBtn = btn('vd-btn--ghost', 'Settings');
  const titleMenu = el('div', 'vd-menu');
  const devBtn = btn('vd-btn--dev', 'Dev start', { 'aria-keyshortcuts': 'Backquote', title: 'Developer start (backtick)' });
  devBtn.hidden = true;   // shown only when the host registers a dev menu (setDevMenu)
  titleMenu.append(startBtn, titleSettingsBtn, devBtn);
  const titleSeed = el('p', 'vd-title-seed vd-mono');
  const titleKeys = el('p', 'vd-fine vd-mono');
  titleKeys.innerHTML = '<kbd>MOUSE</kbd>/<kbd>WASD</kbd> STEER · <kbd>SPACE</kbd> STABILISE · <kbd>Q</kbd> CAPTURE · <kbd>ESC</kbd> MENU';
  titleStack.append(emblem, titleSub, logo, titleTag, titleMenu, titleSeed, titleKeys);
  titleOv.appendChild(titleStack);
  titleSettingsBtn.addEventListener('click', () => { sound('ui.open'); openMenu(true); });

  // ---------- Choice ----------
  const choiceOv = overlay('vd-overlay--dim', 'Choose your evolution');
  const choiceWrap = el('div', 'vd-choice');
  const choiceKicker = el('span', 'vd-kicker vd-mono');
  const choiceHead = el('h2', 'vd-heading', 'Evolution branch detected');
  const cards = el('ul', 'vd-cards');
  const choiceSub = el('p', 'vd-fine vd-mono');
  choiceSub.innerHTML = 'SELECT <kbd>1</kbd>–<kbd>4</kbd> · <kbd>←</kbd><kbd>→</kbd> MOVE · <kbd>ENTER</kbd> CONFIRM';
  choiceWrap.append(choiceKicker, choiceHead, cards, choiceSub);
  choiceOv.appendChild(choiceWrap);

  // ---------- Systems (pause + settings) ----------
  const menuOv = overlay('vd-overlay--dim', 'Systems');
  const menuPanel = el('div', 'vd-panel vd-frame vd-systems');
  const menuKicker = el('span', 'vd-kicker vd-mono', 'SYSTEMS');
  const menuHead = el('h2', 'vd-heading', 'Paused');
  const menuClose = el('button', 'vd-iconbtn vd-interactive', null, { type: 'button', 'aria-label': 'Close (Esc)' });
  menuClose.innerHTML = icon('close');
  const menuTop = el('div', 'vd-systems-top');
  const menuTitles = el('div');
  menuTitles.append(menuKicker, menuHead);
  menuTop.append(menuTitles, menuClose);
  const resumeBtn = btn('vd-btn--primary', 'Resume');
  const form = el('div', 'vd-settings');
  const ctrls = {};
  const group = (title) => { const g = el('fieldset', 'vd-set-group'); g.appendChild(el('legend', 'vd-label', title)); form.appendChild(g); return g; };
  const gAudio = group('Audio');
  for (const [k, label] of [['master', 'Master'], ['music', 'Music'], ['sfx', 'Effects']]) {
    const id = `vd-set-${k}-${Math.random().toString(36).slice(2, 7)}`;
    const row = el('div', 'vd-set-row');
    const lab = el('label', null, label, { for: id });
    const input = el('input', 'vd-range vd-interactive', null, { type: 'range', id, min: '0', max: '100', step: '5' });
    const out = el('output', 'vd-mono', null, { for: id });
    input.addEventListener('input', () => setSetting(k, Number(input.value) / 100));
    input.addEventListener('change', () => sound('ui.click'));
    row.append(lab, input, out);
    gAudio.appendChild(row);
    ctrls[k] = { input, out };
  }
  const gDisp = group('Display');
  const qRow = el('div', 'vd-set-row');
  const qLab = el('span', 'vd-set-name', 'Quality');
  const qSeg = el('div', 'vd-seg', null, { role: 'radiogroup', 'aria-label': 'Quality' });
  ctrls.quality = QUALITIES.map((q) => {
    const b = el('button', 'vd-seg-btn vd-interactive', q.toUpperCase(), { type: 'button', role: 'radio', 'aria-checked': 'false', 'data-q': q });
    b.addEventListener('click', () => { setSetting('quality', q); sound('ui.click'); });
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const i = (QUALITIES.indexOf(settings.quality) + (e.key === 'ArrowRight' ? 1 : QUALITIES.length - 1)) % QUALITIES.length;
      setSetting('quality', QUALITIES[i]);
      ctrls.quality[i].focus();
      sound('ui.click');
    });
    qSeg.appendChild(b);
    return b;
  });
  qRow.append(qLab, qSeg);
  gDisp.appendChild(qRow);
  for (const [k, label, hint] of [
    ['reducedMotion', 'Reduced motion', 'No sweeps, shakes or flashes'],
    ['readability', 'High readability', 'Larger text, solid panels, stronger outlines'],
    ['topDown', 'Top-down camera', 'Shortcut T'],
    ['trajectory', 'Trajectory preview', 'Shortcut V'],
  ]) {
    const b = el('button', 'vd-switch vd-interactive', null, { type: 'button', role: 'switch', 'aria-checked': 'false' });
    b.append(el('span', 'vd-switch-track'), el('span', 'vd-switch-text', label), el('span', 'vd-switch-hint', hint));
    b.addEventListener('click', () => { setSetting(k, !settings[k]); sound('ui.click'); });
    gDisp.appendChild(b);
    ctrls[k] = b;
  }
  const menuBtns = el('div', 'vd-menu');
  menuBtns.append(resumeBtn);
  menuPanel.append(menuTop, menuBtns, form);
  menuOv.appendChild(menuPanel);
  resumeBtn.addEventListener('click', () => closeMenu());
  menuClose.addEventListener('click', () => closeMenu());

  // ---------- Ending ----------
  const endOv = overlay('vd-overlay--dim vd-overlay--end', 'Run ended');
  const endStack = el('div', 'vd-ending');
  const endKicker = el('span', 'vd-kicker vd-mono');
  const endTitle = el('h2', 'vd-heading vd-heading--xl');
  const endText = el('p', 'vd-ending-text');
  const stats = el('dl', 'vd-panel vd-frame vd-stats');
  const statEls = {};
  for (const [k, label] of [['time', 'Run time'], ['mass', 'Final mass'], ['maxMass', 'Peak mass'], ['stage', 'Reached'],
    ['absorbed', 'Absorbed'], ['hits', 'Hits taken'], ['nearMisses', 'Near misses'], ['disruptions', 'Disruptions']]) {
    const s = el('div', 'vd-stat');
    statEls[k] = { s, v: el('dd', 'vd-mono') };
    s.append(el('dt', 'vd-label', label), statEls[k].v);
    stats.appendChild(s);
  }
  const restartBtn = btn('vd-btn--primary', 'Drift again');
  endStack.append(endKicker, endTitle, endText, stats, restartBtn);
  endOv.appendChild(endStack);

  // ---------- Developer start (debug only; the host opts in with setDevMenu) ----------
  // Pick a stage and the forms for each milestone menu up to it; the host starts the run there. Not part of normal play.
  const devOv = overlay('vd-overlay--dim', 'Developer start');
  const devPanel = el('div', 'vd-panel vd-frame vd-systems vd-dev');
  const devTop = el('div', 'vd-systems-top');
  const devTitles = el('div');
  devTitles.append(el('span', 'vd-kicker vd-kicker--dev vd-mono', 'DEVELOPER // NOT THE NORMAL RUN'), el('h2', 'vd-heading', 'Dev start'));
  const devClose = el('button', 'vd-iconbtn vd-interactive', null, { type: 'button', 'aria-label': 'Close (Esc)' });
  devClose.innerHTML = icon('close');
  devTop.append(devTitles, devClose);
  const devStageList = el('div', 'vd-dev-stages', null, { role: 'radiogroup', 'aria-label': 'Start stage' });
  const devFormsBox = el('div', 'vd-settings');
  const devLink = el('p', 'vd-fine vd-mono vd-dev-link');
  const devGo = btn('vd-btn--primary', 'Start here');
  const devBack = btn('vd-btn--ghost', 'Back');
  const devMenuRow = el('div', 'vd-menu vd-dev-actions');
  devMenuRow.append(devGo, devBack);
  devPanel.append(devTop, devStageList, devFormsBox, devLink, devMenuRow);
  devOv.appendChild(devPanel);
  let devCfg = null, devReturn = 'title', devStageIdx = 0, devForms = {};

  function devSpec() {
    const st = devCfg.stages[devStageIdx];
    const forms = devCfg.stages.filter((x) => x.index <= st.index && devForms[x.index]).map((x) => devForms[x.index]);
    return { stage: st.id, forms };
  }
  function renderDev() {
    const cur = devCfg.stages[devStageIdx];
    devStageList.textContent = '';
    for (const st of devCfg.stages) {
      const b = el('button', 'vd-seg-btn vd-dev-stage vd-interactive', null, { type: 'button', role: 'radio', 'aria-checked': String(st.index === devStageIdx), tabindex: st.index === devStageIdx ? '0' : '-1' });
      b.append(el('span', 'vd-dev-stage-n', String(st.index).padStart(2, '0')), el('span', null, st.name));
      if (st.forms.length) b.append(el('span', 'vd-dev-stage-f', `${st.forms.length} forms`));
      b.addEventListener('click', () => { devStageIdx = st.index; sound('ui.click'); renderDev(); devStageList.children[devStageIdx].focus(); });
      b.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault(); e.stopPropagation();
        devStageIdx = (devStageIdx + d + devCfg.stages.length) % devCfg.stages.length; sound('ui.click'); renderDev();
        devStageList.children[devStageIdx].focus();
      });
      devStageList.appendChild(b);
    }
    devFormsBox.textContent = '';
    const menus = devCfg.stages.filter((x) => x.index <= cur.index && x.forms.length);
    for (const st of menus) {
      const g = el('div', 'vd-set-row');
      g.appendChild(el('span', 'vd-set-name', st.name));
      const seg = el('div', 'vd-seg', null, { role: 'radiogroup', 'aria-label': `${st.name} form` });
      for (const f of [{ id: null, label: 'None' }, ...st.forms]) {
        const on = (devForms[st.index] || null) === f.id;
        const b = el('button', 'vd-seg-btn vd-interactive', f.label, { type: 'button', role: 'radio', 'aria-checked': String(on), title: f.description || 'Abandon evolution: no form' });
        b.addEventListener('click', () => { devForms[st.index] = f.id; sound('ui.click'); renderDev(); });
        seg.appendChild(b);
      }
      g.appendChild(seg);
      devFormsBox.appendChild(g);
    }
    devFormsBox.appendChild(el('p', 'vd-fine vd-mono', menus.length ? 'NONE = ABANDON EVOLUTION AT THAT MILESTONE' : 'NO FORM CHOICES AT OR BEFORE THIS STAGE'));
    devLink.textContent = `?${devCfg.query(devSpec())}`;
  }
  function openDev() {
    if (!devCfg || devOv.classList.contains('is-on') || menuOv.classList.contains('is-on')) return;
    if (choiceHandler && !choiceHandler.done.v) return;
    const st = last && last.status;
    devReturn = titleOv.dataset.open === '1' ? 'title' : endOv.classList.contains('is-on') ? 'end' : st === 'playing' ? 'play' : null;
    if (!devReturn) return;
    if (devReturn === 'play' && !paused) { paused = true; if (pauseCb) pauseCb(true); }
    sound('ui.open');
    renderDev();
    openOverlay(devOv, devStageList.children[devStageIdx]);
  }
  function closeDev(silentSound) {
    if (!devOv.classList.contains('is-on')) return;
    if (!silentSound) sound('ui.close');
    closeOverlay(devOv, true);
    if (devReturn === 'title') openOverlay(titleOv, devBtn);
    else if (devReturn === 'end') openOverlay(endOv, restartBtn);
    else if (paused) { paused = false; if (pauseCb) pauseCb(false); }
  }
  function startDev() {
    sound('ui.confirm');
    const spec = devSpec();
    closeOverlay(devOv, true); closeOverlay(titleOv, true); closeOverlay(endOv, true);
    titleOv.dataset.open = '0';
    paused = false;
    if (devCfg.onStart) devCfg.onStart(spec);
  }
  devBtn.addEventListener('click', () => openDev());
  devClose.addEventListener('click', () => closeDev());
  devBack.addEventListener('click', () => closeDev());
  devGo.addEventListener('click', startDev);

  /** Register the developer start menu. cfg: { stages (src/devstart.js devStages), query(spec) -> string, onStart(spec), initial?: spec }. */
  function setDevMenu(cfg) {
    devCfg = cfg && cfg.stages && cfg.stages.length ? cfg : null;
    devBtn.hidden = !devCfg;
    if (!devCfg) return;
    const init = cfg.initial;
    const si = init ? devCfg.stages.findIndex((x) => x.id === init.stage) : -1;
    devStageIdx = si >= 0 ? si : 0;
    devForms = {};
    for (const id of (init && init.forms) || []) { const st = devCfg.stages.find((x) => x.forms.some((f) => f.id === id)); if (st) devForms[st.index] = id; }
  }

  ui.append(hud.el, titleOv, choiceOv, menuOv, devOv, endOv, grain, live, liveAlert);
  root.appendChild(ui);

  // Keep UI clicks from also steering the ship (2D input listens on window).
  // Only in-flight HUD controls are swallowed; title/menu clicks still reach the host's first-gesture audio unlock.
  ui.addEventListener('pointerdown', (e) => {
    if (last && last.status === 'playing' && e.target.closest && e.target.closest('.vd-hud .vd-interactive')) e.stopPropagation();
  });
  // Hover/ focus sounds (throttled).
  let hoverT = 0;
  ui.addEventListener('pointerover', (e) => {
    const b = e.target.closest && e.target.closest('button.vd-interactive');
    if (!b || b.contains(e.relatedTarget)) return;
    const now = performance.now();
    if (now - hoverT > 70) { hoverT = now; sound(b.classList.contains('vd-card') ? 'ui.choice.select' : 'ui.hover'); }
  });

  // ---------- Settings ----------
  function applySettings() {
    for (const k of ['master', 'music', 'sfx']) {
      const v = Math.round(settings[k] * 100);
      ctrls[k].input.value = String(v);
      ctrls[k].out.textContent = `${String(v).padStart(3, ' ')}%`;
    }
    for (const b of ctrls.quality) b.setAttribute('aria-checked', String(b.dataset.q === settings.quality));
    for (const b of ctrls.quality) b.tabIndex = b.dataset.q === settings.quality ? 0 : -1;
    for (const k of ['reducedMotion', 'readability', 'topDown', 'trajectory']) ctrls[k].setAttribute('aria-checked', String(!!settings[k]));
    ui.classList.toggle('vd-rm', reduced());
    ui.classList.toggle('vd-readable', !!settings.readability);
  }
  function setSetting(k, v) {
    if (settings[k] === v) return;
    settings = { ...settings, [k]: v };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) { /* ignore */ }
    applySettings();
    emitSettings();
  }
  applySettings();
  emitSettings();
  const onMq = () => applySettings();
  if (mqReduce && mqReduce.addEventListener) mqReduce.addEventListener('change', onMq);

  // ---------- Pause / systems ----------
  function openMenu(fromTitle) {
    const playing = last && (last.status === 'playing' || last.status === 'paused');
    menuFromTitle = !!fromTitle || !playing;
    menuHead.textContent = menuFromTitle ? 'Settings' : 'Paused';
    menuKicker.textContent = menuFromTitle ? 'SYSTEMS // CONFIG' : 'SYSTEMS // DRIFT SUSPENDED';
    resumeBtn.querySelector('.vd-btn-label').textContent = menuFromTitle ? 'Back' : 'Resume';
    if (!menuFromTitle && !paused) {
      paused = true;
      if (pauseCb) pauseCb(true);
      announce('Paused.');
    }
    sound('ui.open');
    openOverlay(menuOv, resumeBtn);
  }
  function closeMenu(silentSound) {
    if (!menuOv.classList.contains('is-on')) return;
    if (!silentSound) sound('ui.close');
    closeOverlay(menuOv, menuFromTitle);
    if (menuFromTitle) {
      menuFromTitle = false;
      if (titleOv.dataset.open === '1') openOverlay(titleOv, titleSettingsBtn);
      return;
    }
    if (paused) {
      paused = false;
      if (pauseCb) pauseCb(false);
      announce('Resumed.');
    }
  }
  function setPaused(v, fromCaller) {
    v = !!v;
    if (v === paused) return;
    if (v) {
      if (!(last && (last.status === 'playing' || last.status === 'paused')) && !fromCaller) return;
      paused = true;
      menuFromTitle = false;
      menuHead.textContent = 'Paused';
      menuKicker.textContent = 'SYSTEMS // DRIFT SUSPENDED';
      resumeBtn.querySelector('.vd-btn-label').textContent = 'Resume';
      openOverlay(menuOv, resumeBtn);
      announce('Paused.');
      if (!fromCaller && pauseCb) pauseCb(true);
    } else {
      paused = false;
      closeOverlay(menuOv);
      announce('Resumed.');
      if (!fromCaller && pauseCb) pauseCb(false);
    }
  }

  function doCapture() {
    if (!(last && last.status === 'playing')) return;
    if (typeof opts.onAction === 'function' && !(last.flags && last.flags.captureLocked)) {
      sound('ui.confirm');
      try { opts.onAction('capture'); } catch (_) { /* ignore */ }
    } else {
      sound('ui.error');
      hud.pushLog('CAPTURE · LOCKED', 'warn', 'cap-locked');
      announce('Capture is locked.');
    }
  }

  // ---------- Update ----------
  function update(state, view) {
    if (!state) return;
    last = state;
    const status = state.status;
    const now = performance.now();
    const dt = Math.min(0.25, (now - lastTick) / 1000);
    lastTick = now;

    const hudOn = status === 'playing' || status === 'choice' || status === 'paused';
    if (hud.el.classList.contains('is-on') !== hudOn) hud.el.classList.toggle('is-on', hudOn);
    if (status === 'playing' && prevStatus !== 'playing' && prevStatus !== 'choice' && prevStatus !== 'paused') hud.showHint();
    if (status === 'title' || status === 'ended') hud.hideHint();

    // Sim-driven pause (3D): mirror it with the systems panel.
    if (status === 'paused' && prevStatus !== 'paused' && !menuOv.classList.contains('is-on') && !devOv.classList.contains('is-on')) {
      paused = true;
      menuFromTitle = false;
      menuHead.textContent = 'Paused';
      menuKicker.textContent = 'SYSTEMS // DRIFT SUSPENDED';
      resumeBtn.querySelector('.vd-btn-label').textContent = 'Resume';
      openOverlay(menuOv, resumeBtn);
    } else if (prevStatus === 'paused' && status === 'playing' && paused) {
      paused = false;
      closeOverlay(menuOv);
    }
    prevStatus = status;

    if (hudOn) hud.update(state, view, dt, now);
  }

  // ---------- Screens ----------
  function showTitle(onStart, o) {
    paused = false;
    hud.clearPending();
    choiceHandler = null;
    closeOverlay(menuOv, true); closeOverlay(endOv, true); closeOverlay(choiceOv, true);
    hud.el.classList.remove('is-on');
    const seed = (o && o.seed) || (last && last.seed);
    titleSeed.textContent = seed ? `SEED ${seed}` : '';
    titleSeed.hidden = !seed;
    titleOv.dataset.open = '1';
    openOverlay(titleOv, startBtn);
    startBtn.onclick = () => {
      sound('ui.confirm');
      titleOv.dataset.open = '0';
      closeOverlay(titleOv, true);
      if (typeof onStart === 'function') onStart();
    };
  }

  function showEnd(ending, onRestart) {
    ending = ending || {};
    paused = false;
    hud.clearPending();
    choiceHandler = null;
    closeOverlay(menuOv, true); closeOverlay(choiceOv, true);
    const s = last || {};
    const kind = ending.kind || (s.deathCause === 'captured' || ending.id === 'event_horizon' ? 'eventHorizon' : s.deathCause ? 'death' : 'finale');
    endOv.dataset.kind = kind;
    endKicker.textContent = kind === 'death' ? 'SIGNAL LOST // RUN TERMINATED' : kind === 'eventHorizon' ? 'CAPTURED // EVENT HORIZON CROSSED' : 'TRANSMISSION COMPLETE';
    endTitle.textContent = ending.title || 'The End';
    endText.textContent = ending.text || '';
    endText.hidden = !ending.text;
    const st = s.stats || {};
    const setStat = (k, v) => { statEls[k].s.hidden = v == null; if (v != null) statEls[k].v.textContent = v; };
    setStat('time', fmtTime(num(st.elapsed) ?? s.time));
    setStat('mass', fmtMass(num(s.mass) ?? 0));
    setStat('maxMass', num(st.maxMass) !== null && st.maxMass > (s.mass || 0) ? fmtMass(st.maxMass) : null);
    setStat('stage', stageName(Math.max(0, s.stageIndex | 0)));
    for (const k of ['absorbed', 'hits', 'nearMisses', 'disruptions']) setStat(k, num(st[k]) !== null ? String(st[k]) : null);
    announce(`${endTitle.textContent}. ${ending.text || ''}`);
    openOverlay(endOv, restartBtn);
    restartBtn.onclick = () => {
      sound('ui.confirm');
      closeOverlay(endOv, true);
      hud.reset();
      if (typeof onRestart === 'function') onRestart();
    };
  }

  function showChoice(choices, onPick, opts = {}) {
    choices = (choices || []).slice(0, 4);
    if (!choices.length) return;
    cards.textContent = '';
    const done = { v: false };
    const idx = last ? Math.max(0, last.stageIndex | 0) : 0;
    choiceKicker.textContent = `STAGE ${String(idx + 1).padStart(2, '0')} // ${stageName(idx).toUpperCase()} // MUTATION WINDOW OPEN`;
    const buttons = choices.map((c, i) => {
      const li = el('li');
      const isAbandon = c.id === abandonId;
      const b = el('button', `vd-card vd-frame vd-interactive${isAbandon ? ' vd-card--abandon' : ''}`, null, { type: 'button', 'data-id': c.id, 'aria-keyshortcuts': String(i + 1) });
      b.style.setProperty('--i', i);
      const key = el('span', 'vd-card-key vd-mono', String(i + 1).padStart(2, '0'), { 'aria-hidden': 'true' });
      const tag = el('span', 'vd-card-tag vd-mono', isAbandon ? 'HOLD FORM' : `BRANCH ${String.fromCharCode(65 + i)}`, { 'aria-hidden': 'true' });
      const lab = el('span', 'vd-card-label', c.label || c.id);
      const desc = el('span', 'vd-card-desc', c.description || '');
      const schem = el('span', 'vd-card-schem', null, { 'aria-hidden': 'true' });
      let shot = null;
      try { shot = typeof opts.preview === 'function' ? opts.preview(c) : null; } catch (e) { shot = null; }
      if (shot) { shot.className = 'vd-card-shot'; schem.appendChild(shot); } else schem.innerHTML = stageGlyph(idx);   // no 3D renderer: the stage glyph
      b.append(key, tag, schem, lab, desc);
      b.onclick = () => pick(i);
      b.addEventListener('focus', () => sound('ui.choice.select'));
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
      sound('ui.choice.confirm');
      announce(`Chose ${c.label || c.id}.`);
      setTimeout(() => {
        closeOverlay(choiceOv, true);
        if (typeof onPick === 'function') onPick(c.id, c);
      }, reduced() ? 0 : 420);
    }
    choiceHandler = { pick, buttons, done };
    sound('ui.open');
    openOverlay(choiceOv, buttons[0]);
    announce(`Evolution choice: ${choices.map((c, i) => `${i + 1}, ${c.label || c.id}`).join('; ')}.`);
  }

  function warnBoundary(on) {
    // Deprecated in the 3D contract (no world edge). The legacy 2D build still has one, so the warning
    // shows only when the state has no `hud` (i.e. the 2D build); otherwise this is a no-op.
    hud.warnLegacy(on);
  }

  // ---------- Event bus ----------
  const handlers = {
    'run-start': () => { hud.reset(); },
    status: (p) => { if (p && p.status === 'paused' && last) { /* mirrored in update */ } },
    absorb: (p) => {
      if (!p) return;
      const chain = (p.chain | 0) > 1 ? ` · CHAIN ×${p.chain}` : '';
      hud.pushLog(`+${fmtMass(num(p.gained) ?? 0)} ${clsName(p.cls).toUpperCase()}${p.tde ? ' · TIDAL FEAST' : ''}${chain}`, 'prey', 'absorb');
    },
    hit: (p) => {
      if (!p) return;
      if (!reduced()) hud.damage(num(p.strength) ?? 0.5);
      hud.pushLog(`IMPACT · ${clsName(p.cls).toUpperCase()} · HULL ${Math.round((num(p.health) ?? 0) * 100)}%`, 'threat');
      if (p.lethal) announce('Lethal impact.', true);
    },
    'near-miss': (p) => { if (p) hud.pushLog(`NEAR MISS · ${clsName(p.cls).toUpperCase()} · ${fmtDist(p.gap)}`, 'info', 'near'); },
    'roche-disruption': (p) => {
      if (!p || p.phase !== 'start') return;
      if (p.victim === 'player') { hud.pushLog('TIDAL STRESS · BREAKUP IMMINENT', 'threat'); announce('Warning: tidal disruption.', true); }
      else hud.pushLog(`ROCHE LIMIT · ${clsName(p.cls).toUpperCase()} SHREDDED · ${p.fragments | 0} FRAGMENTS`, 'prey');
    },
    'orbit-acquired': (p) => { if (p) { hud.pushLog(`ORBIT ACQUIRED · ${clsName(p.hostCls).toUpperCase()} · T ${(num(p.period) ?? 0).toFixed(1)}s`, 'info'); announce(`Orbit acquired around ${clsName(p.hostCls)}.`); } },
    'orbit-lost': () => hud.pushLog('ORBIT LOST', 'info'),
    slingshot: (p) => { if (p) hud.pushLog(`SLINGSHOT · +${Math.round(num(p.speedGain) ?? 0)} Δv`, 'prey', 'sling'); },
    evolve: () => { /* banner is driven by stageIndex in update (works on both builds) */ },
    'choice-picked': () => {},
    'health-low': () => announce('Hull integrity critical.', true),
    'region-change': (p) => {
      if (!p) return;
      hud.pushLog(p.inVoid ? 'ENTERING DEEP VOID · BEACON ACTIVE' : 'MATTER DETECTED · LEAVING VOID', p.inVoid ? 'warn' : 'info');
      announce(p.inVoid ? 'Entering a void. Follow the beacon to nearest matter.' : 'Leaving the void.');
    },
    'beacon-ping': (p) => {
      if (!reduced()) hud.beaconPing();
      if (p) announce(`Beacon: nearest matter ${fmtDist(p.dist)}, bearing ${fmtBearing(p.bearing)}.`);
    },
    'capture-warning': (p) => {
      if (!p) return;
      if (!reduced()) hud.captureFlash();
      const pct = Math.round((num(p.level) ?? 0) * 100);
      hud.pushLog(`CAPTURE ${pct}% · ${pct < 75 ? 'BURN OUTWARD' : 'ESCAPE WINDOW CLOSING'}`, 'threat', 'capture');
      announce(`Capture warning, ${pct} percent. ${pct < 75 ? 'Steer away from the black hole.' : 'Escape window closing.'}`, true);
    },
    'capture-clear': () => { hud.pushLog('CAPTURE CLEARED', 'prey'); announce('Escaped capture.'); },
    death: (p) => { if (p) announce(p.cause === 'captured' ? 'Captured by a black hole.' : 'Destroyed.', true); },
  };
  function attach(b) {
    detach();
    if (!b || typeof b.on !== 'function') return;
    bus = b;
    for (const type in handlers) {
      const fn = (payload) => { try { handlers[type](payload); } catch (err) { console.warn('[ui]', type, err); } };
      const off = b.on(type, fn);
      offs.push(typeof off === 'function' ? off : () => b.off && b.off(type, fn));
    }
  }
  function detach() {
    for (const off of offs) { try { off(); } catch (_) { /* ignore */ } }
    offs = [];
    bus = null;
  }

  // ---------- Keyboard ----------
  function onKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const tgt = e.target;
    const typing = tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable);
    if (e.code === 'Backquote' && devCfg && !typing) {
      e.preventDefault();
      if (devOv.classList.contains('is-on')) closeDev(); else openDev();
      return;
    }
    if (e.key === 'Escape') {
      if (devOv.classList.contains('is-on')) { e.preventDefault(); closeDev(); return; }
      if (menuOv.classList.contains('is-on')) { e.preventDefault(); sound('ui.back'); closeMenu(true); }
      else if (last && last.status === 'playing' && !activeOverlay) { e.preventDefault(); openMenu(); }
      return;
    }
    if (choiceHandler && !choiceHandler.done.v) {
      if (/^[1-4]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i < choiceHandler.buttons.length) { e.preventDefault(); choiceHandler.pick(i); }
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const bs = choiceHandler.buttons;
        const cur = bs.indexOf(document.activeElement);
        const d = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
        bs[(Math.max(0, cur) + d + bs.length) % bs.length].focus();
        e.preventDefault();
        return;
      }
    }
    if (e.key === 'Tab' && activeOverlay) {
      const f = [...activeOverlay.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], lastEl = f[f.length - 1];
      if (!activeOverlay.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
      return;
    }
    if (typing || activeOverlay || !(last && last.status === 'playing') || e.repeat) return;
    if (e.code === 'KeyQ') { e.preventDefault(); doCapture(); }
    else if (e.code === 'KeyT' && last.hud) { e.preventDefault(); setSetting('topDown', !settings.topDown); sound('ui.click'); }
    else if (e.code === 'KeyV' && last.hud) { e.preventDefault(); setSetting('trajectory', !settings.trajectory); sound('ui.click'); }
  }
  document.addEventListener('keydown', onKey);

  // After a mouse click on a HUD button, drop focus so Space (stabilise) does not re-press it.
  ui.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.vd-hud button');
    if (b && e.detail > 0) b.blur();
  });

  // ---------- Responsive scale ----------
  function rescale() {
    const w = root.clientWidth || window.innerWidth, h = root.clientHeight || window.innerHeight;
    const s = clamp(Math.min(w / 1280, h / 720), 0.72, 1.5);
    uiScale = s;
    ui.style.setProperty('--s', s.toFixed(3));
    ui.classList.toggle('vd-narrow', w < 720);
    ui.classList.toggle('vd-short', h < 520);
  }
  rescale();
  let ro = null;
  if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(rescale); ro.observe(root); }
  else window.addEventListener('resize', rescale);

  function hide() {
    for (const o of [titleOv, choiceOv, menuOv, devOv, endOv]) closeOverlay(o, true);
    titleOv.dataset.open = '0';
    choiceHandler = null;
    hud.el.classList.remove('is-on');
  }
  function dispose() {
    detach();
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', rescale);
    if (mqReduce && mqReduce.removeEventListener) mqReduce.removeEventListener('change', onMq);
    if (ro) ro.disconnect();
    hud.dispose();
    ui.remove();
  }

  return {
    update, showChoice, showTitle, showEnd, warnBoundary, attach, detach, hide, dispose, setDevMenu,
    getSettings: () => ({ ...settings }),
    onPause(cb) { pauseCb = typeof cb === 'function' ? cb : null; },
    setPaused: (v) => setPaused(v, true), // programmatic; does not fire onPause
    showHint: () => hud.showHint(),
    destroy: dispose,
  };
}

// ---------------------------------------------------------------------------------------------
// Contract API (docs/interfaces.md §6): a module-level singleton over createUI.
let inst = null;
const I = () => inst || (inst = createUI(null, {}));

export function init(opts = {}) {
  if (inst) inst.dispose();
  inst = createUI(opts.root || null, opts);
}
export const showTitle = (onStart, opts) => I().showTitle(onStart, opts);
export const showChoice = (choices, onPick, opts) => I().showChoice(choices, onPick, opts);
export const showEnd = (ending, onRestart) => I().showEnd(ending, onRestart);
export const update = (state, view) => I().update(state, view);
export const attach = (bus) => I().attach(bus);
export const setDevMenu = (cfg) => I().setDevMenu(cfg);
export const detach = () => { if (inst) inst.detach(); };
export const getSettings = () => (inst ? inst.getSettings() : loadSettings());
export const warnBoundary = (on) => { if (inst) inst.warnBoundary(on); };
export const hide = () => { if (inst) inst.hide(); };
export const dispose = () => { if (inst) { inst.dispose(); inst = null; } };
