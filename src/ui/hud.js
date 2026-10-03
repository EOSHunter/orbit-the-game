// Vesper Drift UI: in-flight HUD (stage card, scanner, target panel, alerts, edge markers, action bar, log).
// Reads only the legacy State fields plus state.hud / state.seed (docs/interfaces.md §6). Every widget hides
// itself when its data is absent, so the same HUD runs on the 2D build's legacy state.

import {
  el, svg, num, clamp, fmtMass, fmtTime, fmtDist, fmtBearing, clsName, icon, stageGlyph, relShape,
  REL_LABEL, STAGE_CODES,
} from './util.js';

const MAX_MARKERS = 12;
const LOG_MAX = 5;
const SCRAMBLE = '#%/<>[]=+*01░▒';
const BLIP_D = {
  threat: 'M0 -3.6 3.6 0 0 3.6 -3.6 0z',
  prey: 'M-2.4 0a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0',
  neutral: 'M-2.6 0a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0',
};

// ctx: { scale(), stageName(i), stageCount, stageRange(i), stageMin(i), announce(msg, assertive), sound(name),
//        reduced(), openMenu(), capture(), canCapture(state), toggleSetting(key), getSettings() }
export function createHud(ctx) {
  const N = ctx.stageCount;
  const root = el('div', 'vd-hud');
  const cache = Object.create(null);
  const setText = (key, node, v) => { if (cache[key] !== v) { cache[key] = v; node.textContent = v; } };
  const setAttr = (key, node, a, v) => { if (cache[key] !== v) { cache[key] = v; node.setAttribute(a, v); } };
  const setStyle = (key, node, prop, v) => { if (cache[key] !== v) { cache[key] = v; node.style.setProperty(prop, v); } };
  const toggle = (key, node, cls, on) => { on = !!on; if (cache[key] !== on) { cache[key] = on; node.classList.toggle(cls, on); } };
  const show = (key, node, on) => { on = !!on; if (cache[key] !== on) { cache[key] = on; node.hidden = !on; } };

  // ---------- Stage card (upper left) ----------
  const tl = el('div', 'vd-tl');
  const card = el('section', 'vd-panel vd-frame vd-stagecard', null, { 'aria-label': 'Body status' });
  const glyphWrap = el('div', 'vd-sc-glyph');
  const glyphRing = el('div', 'vd-sc-ring', null, { 'aria-hidden': 'true' });
  const glyph = el('div', 'vd-sc-icon');
  glyphWrap.append(glyphRing, glyph);
  const body = el('div', 'vd-sc-body');
  const kicker = el('div', 'vd-sc-kicker vd-mono');
  const kStage = el('span', 'vd-sc-num');
  const kCode = el('span', 'vd-sc-code');
  kicker.append(el('span', 'vd-dim', 'STG '), kStage, el('span', 'vd-dim', ' // '), kCode);
  const nameEl = el('h2', 'vd-sc-name vd-stage-name'); // vd-stage-name: stable hook (tests/smoke.mjs)
  const massRow = el('div', 'vd-sc-mass');
  const massEl = el('span', 'vd-sc-massval vd-mono');
  massRow.append(el('span', 'vd-label', 'Mass'), massEl);
  const bar = el('div', 'vd-bar', null, {
    role: 'progressbar', 'aria-label': 'Progress to next stage', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0',
  });
  const ghost = el('div', 'vd-bar-ghost');
  const fill = el('div', 'vd-bar-fill');
  const cursor = el('div', 'vd-bar-cursor');
  bar.append(ghost, fill, el('div', 'vd-bar-ticks'), cursor);
  const nextRow = el('div', 'vd-sc-next vd-mono');
  const nextEl = el('span', 'vd-sc-nextname');
  const pctEl = el('span', 'vd-sc-pct');
  nextRow.append(nextEl, pctEl);
  const ladder = el('ol', 'vd-ladder', null, { 'aria-label': 'Evolution stages' });
  const pips = [];
  for (let i = 0; i < N; i++) {
    const li = el('li', null, null, { title: ctx.stageName(i) });
    li.append(el('span', 'vd-ladder-code', STAGE_CODES[i] || String(i + 1), { 'aria-hidden': 'true' }), el('span', 'vd-sr', ctx.stageName(i)));
    ladder.appendChild(li);
    pips.push(li);
  }
  const hull = el('div', 'vd-hull');
  const hullBar = el('div', 'vd-meter', null, { role: 'meter', 'aria-label': 'Hull integrity', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '100' });
  const hullFill = el('i');
  hullBar.appendChild(hullFill);
  const hullVal = el('span', 'vd-mono vd-hull-val');
  hull.append(el('span', 'vd-label', 'Hull'), hullBar, hullVal);
  body.append(kicker, nameEl, massRow, bar, nextRow, ladder, hull);
  card.append(glyphWrap, body);

  // Round command buttons under the card (reference layout: Esc/Settings, Q/Capture).
  const cmds = el('div', 'vd-cmds');
  const mkCmd = (ico, key, label, aria) => {
    const b = el('button', 'vd-rbtn vd-interactive', null, { type: 'button', 'aria-label': aria, 'aria-keyshortcuts': key === 'Esc' ? 'Escape' : key });
    const disc = el('span', 'vd-rbtn-disc');
    disc.innerHTML = icon(ico);
    b.append(disc, el('kbd', 'vd-rbtn-key', key), el('span', 'vd-rbtn-cap', label));
    cmds.appendChild(b);
    return b;
  };
  const menuBtn = mkCmd('settings', 'Esc', 'Settings', 'Settings and pause (Esc)');
  menuBtn.classList.add('vd-icon-btn'); // stable pause-button hook (tests/smoke.mjs)
  const capBtn = mkCmd('capture', 'Q', 'Capture', 'Capture (Q)');
  const capLock = el('span', 'vd-rbtn-lock');
  capLock.innerHTML = icon('lock');
  capBtn.querySelector('.vd-rbtn-disc').appendChild(capLock);
  menuBtn.addEventListener('click', () => ctx.openMenu());
  capBtn.addEventListener('click', () => ctx.capture());
  tl.append(card, cmds);

  // ---------- Scanner (upper right) ----------
  const tr = el('div', 'vd-tr');
  const scanner = el('section', 'vd-panel vd-frame vd-scanner', null, { 'aria-label': 'Sensor sweep' });
  const scanHead = el('div', 'vd-scan-head vd-mono');
  const timeEl = el('span', 'vd-scan-time');
  const rangeEl = el('span', 'vd-scan-range');
  scanHead.append(el('span', 'vd-dim', 'T+ '), timeEl, el('span', 'vd-spacer'), el('span', 'vd-dim', 'RNG '), rangeEl);
  const radarWrap = el('div', 'vd-radar');
  const sweep = el('div', 'vd-radar-sweep', null, { 'aria-hidden': 'true' });
  const rsvg = svg('svg', { viewBox: '-50 -50 100 100', class: 'vd-radar-svg', role: 'img', 'aria-label': 'Radar' });
  rsvg.innerHTML =
    '<circle r="46" class="vd-r-ring vd-r-outer"/><circle r="30.7" class="vd-r-ring"/><circle r="15.3" class="vd-r-ring"/>' +
    '<path d="M-46 0H-4M4 0H46M0 -46V-4M0 4V46" class="vd-r-cross"/>' +
    '<path d="M0 -49.5 2.4 -45.4H-2.4z" class="vd-r-north"/>' +
    '<g class="vd-r-ticks"></g>';
  const ticks = rsvg.querySelector('.vd-r-ticks');
  for (let a = 0; a < 360; a += 15) {
    const r1 = a % 90 === 0 ? 41.5 : 43.6, rad = (a * Math.PI) / 180;
    ticks.appendChild(svg('line', { x1: (Math.sin(rad) * r1).toFixed(2), y1: (-Math.cos(rad) * r1).toFixed(2), x2: (Math.sin(rad) * 46).toFixed(2), y2: (-Math.cos(rad) * 46).toFixed(2) }));
  }
  const ping = svg('circle', { r: '46', class: 'vd-r-ping' });
  const beacon = svg('path', { d: 'M0 -48 3.4 -42.6 0 -44.2 -3.4 -42.6z', class: 'vd-r-beacon' });
  const blipG = svg('g', { class: 'vd-r-blips' });
  const self = svg('path', { d: 'M0 -3.4 2.6 2.6 0 1.3 -2.6 2.6z', class: 'vd-r-self' });
  rsvg.append(ping, blipG, beacon, self);
  const blips = [];
  for (let i = 0; i < MAX_MARKERS; i++) {
    const p = svg('path', { class: 'vd-r-blip' });
    p.style.display = 'none';
    blipG.appendChild(p);
    blips.push({ node: p, rel: '', tf: '' });
  }
  radarWrap.append(rsvg, sweep);
  const prox = el('div', 'vd-prox');
  const proxRows = {};
  for (const [k, label] of [['star', 'STAR'], ['blackHole', 'B.HOLE'], ['pulsar', 'PULSAR']]) {
    const row = el('div', 'vd-prox-row');
    const m = el('div', 'vd-meter vd-meter--thin');
    const f = el('i');
    m.appendChild(f);
    row.append(el('span', 'vd-label', label), m);
    prox.appendChild(row);
    proxRows[k] = { row, f };
  }
  const seedEl = el('div', 'vd-seed vd-mono');
  scanner.append(scanHead, radarWrap, prox, seedEl);
  tr.appendChild(scanner);

  // ---------- Target panel (right) ----------
  const targets = el('section', 'vd-panel vd-frame vd-targets', null, { 'aria-label': 'Nearby bodies' });
  targets.appendChild(el('div', 'vd-panel-head vd-mono', 'TARGET ANALYSIS'));
  const rows = {};
  for (const rel of ['threat', 'prey', 'neutral']) {
    const r = el('div', `vd-tgt vd-rel-${rel}`);
    const shape = el('span', 'vd-tgt-shape');
    shape.innerHTML = relShape(rel);
    const tag = el('span', 'vd-tgt-tag vd-mono', REL_LABEL[rel].toUpperCase());
    const name = el('span', 'vd-tgt-name');
    const dist = el('span', 'vd-tgt-dist vd-mono');
    const meta = el('span', 'vd-tgt-meta vd-mono');
    r.append(shape, tag, name, dist, meta);
    targets.appendChild(r);
    rows[rel] = { r, name, dist, meta };
  }
  tr.appendChild(targets);

  // ---------- Alerts (top centre) ----------
  const alerts = el('div', 'vd-alerts');
  const mkAlert = (cls, ico, title) => {
    const a = el('div', `vd-alert vd-frame ${cls}`);
    const i = el('span', 'vd-alert-ico');
    i.innerHTML = icon(ico);
    const t = el('span', 'vd-alert-title', title);
    const sub = el('span', 'vd-alert-sub vd-mono');
    a.append(i, t, sub);
    a.hidden = true;
    alerts.appendChild(a);
    return { a, t, sub };
  };
  const capAlert = mkAlert('vd-alert--capture', 'warn', 'Gravitational capture');
  const capMeter = el('div', 'vd-capmeter', null, { role: 'meter', 'aria-label': 'Capture level', 'aria-valuemin': '0', 'aria-valuemax': '100' });
  const capFill = el('i');
  capMeter.append(capFill, el('b'), el('b'), el('b'));
  capAlert.a.appendChild(capMeter);
  const voidAlert = mkAlert('vd-alert--void', 'beacon', 'Deep void');
  const edgeAlert = mkAlert('vd-alert--capture vd-warn', 'warn', 'Edge of charted space'); // .vd-warn.is-on: stable hook
  edgeAlert.sub.textContent = 'TURN BACK';
  const hullAlert = mkAlert('vd-alert--hull', 'warn', 'Hull integrity critical');
  const atmoChip = el('div', 'vd-chip vd-mono');
  atmoChip.hidden = true;
  alerts.appendChild(atmoChip);

  // ---------- Edge markers + reticles (full-screen layer) ----------
  const markers = el('div', 'vd-markers', null, { 'aria-hidden': 'true' });
  const mks = [];
  for (let i = 0; i < MAX_MARKERS; i++) {
    const m = el('div', 'vd-mk');
    const arrow = el('span', 'vd-mk-arrow');
    const lab = el('span', 'vd-mk-dist vd-mono');
    m.append(arrow, lab);
    m.style.display = 'none';
    markers.appendChild(m);
    mks.push({ m, arrow, lab, rel: '', vis: false, txt: '' });
  }
  const mkReticle = (rel) => {
    const r = el('div', `vd-reticle vd-rel-${rel}`);
    r.append(el('i'), el('i'), el('i'), el('i'), el('span', 'vd-reticle-lab vd-mono'));
    r.style.display = 'none';
    markers.appendChild(r);
    return { r, lab: r.lastChild, vis: false, txt: '' };
  };
  const reticles = { threat: mkReticle('threat'), prey: mkReticle('prey') };

  // ---------- Action bar (bottom centre) ----------
  const action = el('section', 'vd-panel vd-frame vd-actionbar', null, { 'aria-label': 'Flight telemetry' });
  const mkCell = (label, cls) => {
    const c = el('div', `vd-tele ${cls || ''}`);
    const v = el('span', 'vd-tele-val vd-mono');
    const m = el('div', 'vd-meter');
    const f = el('i');
    const mark = el('b', 'vd-meter-mark');
    m.append(f, mark);
    const sub = el('span', 'vd-tele-sub vd-mono');
    c.append(el('span', 'vd-label', label), v, m, sub);
    action.appendChild(c);
    return { c, v, f, mark, sub };
  };
  const tVel = mkCell('Velocity', 'vd-tele--vel');
  const tThr = mkCell('Steer', 'vd-tele--thr');
  const tGrav = mkCell('Gravity well', 'vd-tele--grav');
  const orbitCell = el('div', 'vd-tele vd-tele--orbit');
  const orbitIco = el('span', 'vd-tele-ico');
  orbitIco.innerHTML = icon('orbit');
  const orbitVal = el('span', 'vd-tele-val vd-mono');
  const orbitSub = el('span', 'vd-tele-sub vd-mono');
  orbitCell.append(el('span', 'vd-label', 'Orbit'), orbitVal, orbitSub, orbitIco);
  action.appendChild(orbitCell);
  action.appendChild(el('span', 'vd-divider', null, { 'aria-hidden': 'true' }));
  const mkToggle = (ico, key, label, setting) => {
    const b = el('button', 'vd-tbtn vd-interactive', null, { type: 'button', 'aria-pressed': 'false', 'aria-keyshortcuts': key, title: `${label} (${key})` });
    b.innerHTML = icon(ico);
    b.append(el('span', 'vd-tbtn-cap', label), el('kbd', null, key));
    b.addEventListener('click', () => ctx.toggleSetting(setting));
    action.appendChild(b);
    return b;
  };
  const topBtn = mkToggle('topdown', 'T', 'Top-down', 'topDown');
  const trajBtn = mkToggle('trajectory', 'V', 'Trajectory', 'trajectory');

  // ---------- Log, hint, banner, vignettes ----------
  const log = el('div', 'vd-log', null, { 'aria-hidden': 'true' });
  const hint = el('div', 'vd-hint vd-mono');
  hint.innerHTML = 'STEER <kbd>MOUSE</kbd>/<kbd>WASD</kbd> · ABSORB <span class="vd-c-prey">SMALLER</span> · AVOID <span class="vd-c-threat">LARGER</span> · <kbd>ESC</kbd> MENU';
  const banner = el('div', 'vd-banner', null, { 'aria-hidden': 'true' });
  const bannerKicker = el('span', 'vd-banner-kicker vd-mono', 'EVOLUTION COMPLETE');
  const bannerName = el('span', 'vd-banner-name');
  const bannerSub = el('span', 'vd-banner-sub vd-mono');
  banner.append(el('span', 'vd-banner-line'), bannerKicker, bannerName, bannerSub, el('span', 'vd-banner-line'));
  const vigDmg = el('div', 'vd-vig vd-vig--dmg', null, { 'aria-hidden': 'true' });
  const vigLow = el('div', 'vd-vig vd-vig--low', null, { 'aria-hidden': 'true' });
  const vigCap = el('div', 'vd-vig vd-vig--cap', null, { 'aria-hidden': 'true' });

  root.append(vigLow, vigCap, vigDmg, markers, tl, tr, alerts, log, hint, action, banner);

  // ---------- Runtime state ----------
  let prevStage = null;
  let pendingBanner = null; // stage-up banner held back while the choice cards are open (from main #7)
  let shownMass = 0;
  let decodeStart = -1, decodeName = '';
  let range = 1000;
  let legacyEdge = false;
  let bannerTimer = 0, hintTimer = 0;
  let lastLog = null;
  const pctCache = { p: -1 };

  function restart(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth; // reflow so the animation restarts
    node.classList.add(cls);
  }

  function stageUp(i) {
    bannerName.textContent = ctx.stageName(i);
    bannerSub.textContent = `STAGE ${String(i + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
    restart(banner, 'is-on');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => banner.classList.remove('is-on'), 2200);
    restart(bar, 'is-flash');
    restart(glyphRing, 'is-pulse');
    ctx.sound('ui.stagebanner');
    ctx.announce(`Evolved. Stage ${i + 1} of ${N}: ${ctx.stageName(i)}.`);
  }

  function showHint() {
    hint.classList.add('is-on');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hint.classList.remove('is-on'), 5000);
  }

  function pushLog(text, kind = 'info', mergeKey = null) {
    const now = performance.now();
    if (mergeKey && lastLog && lastLog.key === mergeKey && now - lastLog.t < 1500 && lastLog.node.isConnected) {
      lastLog.node.textContent = text;
      lastLog.t = now;
      restart(lastLog.node, 'is-bump');
      clearTimeout(lastLog.timer);
      lastLog.timer = setTimeout(() => lastLog && lastLog.node.remove(), 2600);
      return;
    }
    const n = el('div', `vd-log-line vd-log--${kind}`, text);
    log.appendChild(n);
    while (log.children.length > LOG_MAX) log.firstChild.remove();
    const entry = { node: n, key: mergeKey, t: now, timer: setTimeout(() => n.remove(), 2600) };
    lastLog = entry;
  }

  function damage(strength) {
    vigDmg.style.setProperty('--dmg', clamp(0.35 + (strength || 0) * 0.65, 0, 1).toFixed(2));
    restart(vigDmg, 'is-on');
  }

  function beaconPing() { restart(ping, 'is-ping'); restart(voidAlert.a, 'is-ping'); }
  function captureFlash() { restart(capAlert.a, 'is-flash'); }
  function warnLegacy(on) { legacyEdge = !!on; edgeAlert.a.classList.toggle('is-on', legacyEdge); }

  function reset() {
    prevStage = null;
    pendingBanner = null;
    nameEl.classList.remove('is-decoding');
    shownMass = 0;
    decodeStart = -1;
    range = 1000;
    legacyEdge = false;
    for (const k in cache) delete cache[k];
    pctCache.p = -1;
    log.textContent = '';
    lastLog = null;
    banner.classList.remove('is-on');
  }

  // ---------- Per-frame update ----------
  function update(state, view, dt, now) {
    const hud = state.hud && typeof state.hud === 'object' ? state.hud : null;
    const reduced = ctx.reduced();
    const idx = clamp(state.stageIndex | 0, 0, N - 1);
    const name = ctx.stageName(idx);

    // Stage change
    if (prevStage !== idx) {
      const evolved = prevStage !== null && idx > prevStage;
      if (evolved) {
        if (state.status === 'choice') pendingBanner = idx;
        else if (state.status === 'playing') stageUp(idx);
      }
      prevStage = idx;
      glyph.innerHTML = stageGlyph(idx);
      setText('kStage', kStage, `${String(idx + 1).padStart(2, '0')}/${String(N).padStart(2, '0')}`);
      setText('kCode', kCode, (STAGE_CODES[idx] || '').toUpperCase());
      ladder.setAttribute('aria-label', `Evolution stages, currently ${name}, ${idx + 1} of ${N}`);
      for (let i = 0; i < pips.length; i++) {
        pips[i].classList.toggle('is-done', i < idx);
        pips[i].classList.toggle('is-current', i === idx);
        if (i === idx) pips[i].setAttribute('aria-current', 'step'); else pips[i].removeAttribute('aria-current');
      }
      if (!reduced && evolved && decodeName && decodeName !== name) decodeStart = now;
      decodeName = name;
    }
    setText('name', nameEl, name); // the real name always stays in the DOM text (screen readers, tests)
    if (state.status === 'choice' && banner.classList.contains('is-on')) banner.classList.remove('is-on');
    if (pendingBanner !== null && state.status === 'playing') { stageUp(pendingBanner); pendingBanner = null; }
    // Short visual "decode" scramble after an evolution, drawn by CSS from data-scramble over the real text
    if (decodeStart >= 0 && now - decodeStart < 480) {
      const k = Math.floor(((now - decodeStart) / 480) * name.length);
      let s = name.slice(0, k);
      for (let i = k; i < name.length; i++) s += name[i] === ' ' ? ' ' : SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0];
      nameEl.setAttribute('data-scramble', s);
      toggle('decoding', nameEl, 'is-decoding', true);
    } else if (decodeStart >= 0) {
      decodeStart = -1;
      toggle('decoding', nameEl, 'is-decoding', false);
    }

    // Mass count-up (ease-out)
    const mass = num(state.mass) ?? 0;
    if (reduced || Math.abs(mass - shownMass) < 0.05 || mass < shownMass) shownMass = mass;
    else shownMass += (mass - shownMass) * (1 - Math.exp(-dt / 0.1));
    setText('mass', massEl, fmtMass(shownMass));

    // Progress
    const last = idx >= N - 1;
    let p;
    if (last) p = 1;
    else if (num(state.progress) !== null) p = state.progress;
    else { const [a, b] = ctx.stageRange(idx); p = b > a ? (mass - a) / (b - a) : 0; }
    p = clamp(p, 0, 1);
    const pq = Math.round(p * 1000) / 1000;
    if (pctCache.p !== pq) {
      pctCache.p = pq;
      fill.style.transform = ghost.style.transform = `scaleX(${pq})`;
      cursor.style.left = `${(pq * 100).toFixed(1)}%`;
      bar.setAttribute('aria-valuenow', String(Math.floor(p * 100)));
    }
    setText('pct', pctEl, last ? 'FINAL FORM' : `${String(Math.floor(p * 100)).padStart(2, '0')}%`);
    setText('next', nextEl, last ? 'NOTHING LEFT TO BECOME' : `NEXT ▸ ${ctx.stageName(idx + 1).toUpperCase()}`);

    // Hull
    const health = num(state.health) ?? num(state.player && state.player.health);
    show('hull', hull, health !== null);
    if (health !== null) {
      const h = clamp(health, 0, 1);
      const hq = Math.round(h * 100);
      setStyle('hullW', hullFill, 'transform', `scaleX(${(hq / 100).toFixed(2)})`);
      setText('hullV', hullVal, `${String(hq).padStart(3, ' ')}%`);
      setAttr('hullA', hullBar, 'aria-valuenow', String(hq));
      toggle('hullLow', hull, 'is-low', h < 0.3);
      toggle('vigLow', vigLow, 'is-on', h < 0.3 && state.status === 'playing');
      show('hullAlert', hullAlert.a, h < 0.3 && h > 0 && state.status === 'playing');
      if (h < 0.3) setText('hullSub', hullAlert.sub, `${hq}% REMAINING`);
    } else {
      show('hullAlert', hullAlert.a, false);
      toggle('vigLow', vigLow, 'is-on', false);
    }

    // Capture button availability
    const capOk = ctx.canCapture(state);
    toggle('capLocked', capBtn, 'is-locked', !capOk);
    setAttr('capAria', capBtn, 'aria-label', capOk ? 'Capture (Q)' : 'Capture, locked (Q)');

    // Scanner
    setText('time', timeEl, fmtTime(state.time));
    const seed = state.seed != null ? String(state.seed) : '';
    show('seed', seedEl, !!seed);
    if (seed) setText('seedT', seedEl, `SEED ${seed}`);
    toggle('scanNoHud', scanner, 'is-nofeed', !hud);
    show('prox', prox, !!(hud && hud.proximity));
    show('targets', targets, !!hud);
    show('action', action, !!hud);

    // Toggles reflect settings
    const st = ctx.getSettings();
    setAttr('topP', topBtn, 'aria-pressed', String(!!st.topDown));
    setAttr('trajP', trajBtn, 'aria-pressed', String(!!st.trajectory));

    show('edgeAlert', edgeAlert.a, legacyEdge && !hud);

    if (!hud) {
      show('capAlert', capAlert.a, false);
      show('voidAlert', voidAlert.a, false);
      show('atmo', atmoChip, false);
      setStyle('cap', vigCap, '--cap', '0');
      show('markers', markers, false);
      setText('range', rangeEl, '--');
      return;
    }

    // Proximity
    if (hud.proximity) {
      for (const k in proxRows) {
        const v = clamp(num(hud.proximity[k]) ?? 0, 0, 1);
        setStyle(`px${k}`, proxRows[k].f, 'transform', `scaleX(${v.toFixed(2)})`);
        toggle(`pxh${k}`, proxRows[k].row, 'is-hot', v > 0.6);
      }
    }

    // Radar blips
    const list = Array.isArray(hud.markers) ? hud.markers : [];
    let far = 0;
    for (let i = 0; i < list.length && i < MAX_MARKERS; i++) { const d = num(list[i].dist); if (d !== null && d > far) far = d; }
    const target = Math.max(200, far * 1.15);
    range += (target - range) * (reduced ? 1 : 1 - Math.exp(-dt / 0.6));
    setText('range', rangeEl, fmtDist(range));
    for (let i = 0; i < MAX_MARKERS; i++) {
      const b = blips[i];
      const m = list[i];
      if (!m || num(m.dist) === null || num(m.bearing) === null) {
        if (b.tf !== 'off') { b.tf = 'off'; b.node.style.display = 'none'; }
        continue;
      }
      const rel = m.rel === 'threat' || m.rel === 'prey' ? m.rel : 'neutral';
      if (b.rel !== rel) { b.rel = rel; b.node.setAttribute('d', BLIP_D[rel]); b.node.setAttribute('class', `vd-r-blip vd-rel-${rel}`); }
      const r = 45 * Math.sqrt(clamp(m.dist / range, 0, 1));
      const tf = `translate(${(Math.sin(m.bearing) * r).toFixed(1)} ${(-Math.cos(m.bearing) * r).toFixed(1)})`;
      if (b.tf !== tf) { if (b.tf === 'off' || b.tf === '') b.node.style.display = ''; b.tf = tf; b.node.setAttribute('transform', tf); }
    }

    // Region / beacon (boundary replacement)
    const reg = hud.region;
    const inVoid = !!(reg && reg.inVoid);
    show('voidAlert', voidAlert.a, inVoid);
    const nm = reg && reg.nearestMatter;
    show('beacon', beacon, inVoid && !!nm);
    if (inVoid) {
      setText('voidSub', voidAlert.sub, nm ? `NEAREST MATTER ${fmtDist(nm.dist)} · BRG ${fmtBearing(nm.bearing)}` : 'NO MATTER IN RANGE');
      if (nm) setAttr('beaconTf', beacon, 'transform', `rotate(${((nm.bearing * 180) / Math.PI).toFixed(1)})`);
    }
    toggle('voidScan', scanner, 'is-void', inVoid);

    // Capture (boundary replacement)
    const cap = hud.capture && num(hud.capture.level) !== null ? clamp(hud.capture.level, 0, 1) : 0;
    show('capAlert', capAlert.a, cap > 0.01);
    const cq = Math.round(cap * 100);
    setStyle('cap', vigCap, '--cap', (cq / 100).toFixed(2));
    if (cap > 0.01) {
      setStyle('capW', capFill, 'transform', `scaleX(${(cq / 100).toFixed(2)})`);
      setAttr('capA', capMeter, 'aria-valuenow', String(cq));
      setText('capSub', capAlert.sub, cap < 0.75 ? `${cq}% · ESCAPE VECTOR AVAILABLE` : `${cq}% · ESCAPE WINDOW CLOSING`);
      toggle('capCrit', capAlert.a, 'is-critical', cap >= 0.75);
    }

    // Atmosphere chip
    show('atmo', atmoChip, !!hud.inAtmosphere);
    if (hud.inAtmosphere) setText('atmoT', atmoChip, `IN ATMOSPHERE · ρ ${(num(hud.atmosphereDensity) ?? 0).toFixed(2)}`);

    // Targets
    let nearestNeutral = null;
    for (let i = 0; i < list.length; i++) if (list[i].rel === 'neutral' && (!nearestNeutral || list[i].dist < nearestNeutral.dist)) nearestNeutral = list[i];
    fillRow('threat', hud.nearestThreat);
    fillRow('prey', hud.nearestPrey);
    fillRow('neutral', nearestNeutral);

    // Telemetry
    const speed = num(hud.speed), smax = num(hud.speedMax), esc = num(hud.escapeSpeed);
    show('vel', tVel.c, speed !== null);
    if (speed !== null) {
      setText('velV', tVel.v, String(Math.round(speed)).padStart(4, ' '));
      const scale = smax && smax > 0 ? smax : Math.max(speed, esc || 0, 1);
      setStyle('velF', tVel.f, 'transform', `scaleX(${clamp(speed / scale, 0, 1).toFixed(3)})`);
      show('velM', tVel.mark, esc !== null);
      if (esc !== null) setStyle('velMk', tVel.mark, 'left', `${(clamp(esc / scale, 0, 1) * 100).toFixed(1)}%`);
      setText('velS', tVel.sub, esc === null ? 'FREE FLIGHT' : speed > esc ? `ESC ${Math.round(esc)} · UNBOUND` : `ESC ${Math.round(esc)} · BOUND`);
      toggle('velU', tVel.c, 'is-unbound', esc !== null && speed > esc);
    }
    const thr = num(hud.thrust);
    show('thr', tThr.c, thr !== null);
    if (thr !== null) {
      const tq = Math.round(clamp(thr, 0, 1) * 100);
      setText('thrV', tThr.v, `${String(tq).padStart(3, ' ')}%`);
      setStyle('thrF', tThr.f, 'transform', `scaleX(${(tq / 100).toFixed(2)})`);
      setText('thrS', tThr.sub, tq > 2 ? 'GRAV STEERING' : 'COASTING');
    }
    const gd = num(hud.gravityDepth);
    show('grav', tGrav.c, gd !== null);
    if (gd !== null) {
      const gq = Math.round(clamp(gd, 0, 1) * 100);
      setText('gravV', tGrav.v, `${String(gq).padStart(3, ' ')}%`);
      setStyle('gravF', tGrav.f, 'transform', `scaleX(${(gq / 100).toFixed(2)})`);
      setText('gravS', tGrav.sub, gq > 66 ? 'DEEP WELL' : gq > 25 ? 'IN WELL' : 'FLAT SPACE');
      toggle('gravH', tGrav.c, 'is-hot', gq > 66);
    }
    const orb = hud.orbit;
    toggle('orbOn', orbitCell, 'is-locked', !!orb);
    if (orb) {
      setText('orbV', orbitVal, clsName(orb.hostCls).toUpperCase());
      setText('orbS', orbitSub, `T ${(num(orb.period) ?? 0).toFixed(1)}s · ALT ${fmtDist(num(orb.altitude) ?? 0)}`);
    } else {
      setText('orbV', orbitVal, 'NO LOCK');
      setText('orbS', orbitSub, 'UNBOUND');
    }

    // Edge markers + reticles (need the renderer's projection)
    const canProject = !!(view && typeof view.project === 'function');
    show('markers', markers, canProject);
    if (canProject) placeMarkers(list, hud, view);
  }

  function fillRow(rel, t) {
    const row = rows[rel];
    const on = !!(t && num(t.dist) !== null);
    show(`row${rel}`, row.r, on);
    if (!on) return;
    setText(`rn${rel}`, row.name, clsName(t.cls));
    setText(`rd${rel}`, row.dist, fmtDist(t.dist));
    const ratio = num(t.ratio);
    const parts = [];
    if (ratio !== null) parts.push(`×${ratio < 10 ? ratio.toFixed(2) : ratio.toFixed(0)}`);
    if (num(t.gap) !== null) parts.push(`GAP ${fmtDist(t.gap)}`);
    if (num(t.bearing) !== null) parts.push(fmtBearing(t.bearing));
    setText(`rm${rel}`, row.meta, parts.join(' · '));
  }

  function placeMarkers(list, hud, view) {
    const W = root.clientWidth || window.innerWidth;
    const H = root.clientHeight || window.innerHeight;
    const sx = view.width ? W / view.width : 1;
    const sy = view.height ? H / view.height : 1;
    const pad = 30, cx = W / 2, cy = H / 2;
    const padB = action.hidden ? pad : pad + 78 * ctx.scale(); // keep bottom markers above the action bar
    const thId = hud.nearestThreat ? hud.nearestThreat.id : null;
    const prId = hud.nearestPrey ? hud.nearestPrey.id : null;
    let thPlaced = false, prPlaced = false;
    for (let i = 0; i < MAX_MARKERS; i++) {
      const mk = mks[i];
      const m = list[i];
      let vis = false;
      if (m && Array.isArray(m.p) && m.rel !== 'neutral') {
        let pr = null;
        try { pr = view.project(m.p); } catch (_) { pr = null; }
        let x, y, dx, dy;
        if (pr && pr.visible) { x = pr.x * sx; y = pr.y * sy; dx = x - cx; dy = y - cy; }
        else { dx = Math.sin(m.bearing || 0); dy = -Math.cos(m.bearing || 0); }
        const onScreen = pr && pr.visible && x > pad && x < W - pad && y > pad && y < H - padB;
        if (onScreen) {
          // On screen: reticle for the nearest threat/prey only.
          if (m.id === thId) { placeReticle(reticles.threat, x, y, m.dist); thPlaced = true; }
          else if (m.id === prId) { placeReticle(reticles.prey, x, y, m.dist); prPlaced = true; }
        } else {
          const ax = Math.abs(dx) || 1e-6, ay = Math.abs(dy) || 1e-6;
          const t = Math.min((cx - pad) / ax, (dy > 0 ? cy - padB : cy - pad) / ay);
          const ex = cx + dx * t, ey = cy + dy * t;
          const ang = Math.atan2(dy, dx);
          if (mk.rel !== m.rel) { mk.rel = m.rel; mk.m.className = `vd-mk vd-rel-${m.rel}`; }
          mk.m.style.transform = `translate(${ex.toFixed(1)}px, ${ey.toFixed(1)}px)`;
          mk.arrow.style.transform = `rotate(${ang.toFixed(3)}rad)`;
          const txt = fmtDist(m.dist);
          if (mk.txt !== txt) { mk.txt = txt; mk.lab.textContent = txt; }
          vis = true;
        }
      }
      if (mk.vis !== vis) { mk.vis = vis; mk.m.style.display = vis ? '' : 'none'; }
    }
    if (!thPlaced && reticles.threat.vis) { reticles.threat.vis = false; reticles.threat.r.style.display = 'none'; }
    if (!prPlaced && reticles.prey.vis) { reticles.prey.vis = false; reticles.prey.r.style.display = 'none'; }
  }

  function placeReticle(rt, x, y, dist) {
    if (!rt.vis) { rt.vis = true; rt.r.style.display = ''; }
    rt.r.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    const txt = fmtDist(dist);
    if (rt.txt !== txt) { rt.txt = txt; rt.lab.textContent = txt; }
  }

  function dispose() { clearTimeout(bannerTimer); clearTimeout(hintTimer); if (lastLog) clearTimeout(lastLog.timer); }

  return { el: root, update, reset, stageUp, showHint, pushLog, damage, beaconPing, captureFlash, warnLegacy, dispose,
    hideHint: () => hint.classList.remove('is-on'), clearPending: () => { pendingBanner = null; } };
}
