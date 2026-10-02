// Tiny standalone fallbacks for the stages / renderer / UI modules so the engine runs on its own.
// main.js imports this file lazily and only uses an export when the real module does not provide it.
// Nothing here is meant to look good - it exists to make the engine playable and testable.

// ---- stages (stub) -------------------------------------------------------------------------
const NAMES = [
  'Meteorite', 'Asteroid', 'Dwarf Planet', 'Rocky Planet', 'Gas Giant', 'Gas Planet',
  'Dwarf Star', 'Star', 'Giant Star', 'Supergiant Star', 'Neutron Star', 'Black Hole',
];
const MIN_MASS = [0, 3, 7, 14, 28, 55, 105, 200, 380, 720, 1350, 2500];

export const STAGES = NAMES.map((name, i) => {
  const t = i / (NAMES.length - 1);
  const threat = i === NAMES.length - 1 ? 0 : 0.04 + 0.28 * Math.min(1, t / 0.9);
  return {
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    minMass: MIN_MASS[i],
    radiusScale: 1,
    worldScale: 1,
    spawnMix: { prey: 0.9 - threat, neutral: 0.1, threat },
  };
});

export function getStage(mass) {
  let s = STAGES[0];
  for (const st of STAGES) if (mass >= st.minMass) s = st;
  return s;
}

const CHOICES = {
  3: [
    { id: 'terrestrial', label: 'Terrestrial', description: 'Wider absorb reach.' },
    { id: 'metallic', label: 'Metallic', description: 'Armoured against collisions.' },
  ],
  6: [
    { id: 'yellow', label: 'Yellow Dwarf', description: 'Wider absorb reach.' },
    { id: 'abandon', label: 'Abandon evolution', description: 'Take the quiet road.' },
  ],
};

export function getChoicesFor(stageIndex) {
  return CHOICES[stageIndex] || null;
}

export function applyChoice(state, choiceId) {
  (state.flags.picked ||= []).push(choiceId);
  if (choiceId === 'terrestrial' || choiceId === 'yellow') state.flags.absorbRange = 1.5;
  if (choiceId === 'metallic') state.flags.armor = 0.5;
}

export function getEnding(state) {
  if (state.flags.eventHorizon) return { id: 'event-horizon', title: 'Event Horizon (stub)', text: 'You left the map.' };
  if (state.flags.died) return { id: 'stellar-fragment', title: 'Stellar Fragment (stub)', text: 'You were destroyed.' };
  if (state.flags.finale) return { id: 'creator-god', title: 'Creator God (stub)', text: 'You consumed everything.' };
  return null;
}

// ---- renderer (stub) -----------------------------------------------------------------------
const KIND_COLOR = { prey: '#5FF0C0', neutral: '#7FD6FF', threat: '#FF5E73', player: '#FFC15A' };

export function spawnEffect(state, type, x, y, opts = {}) {
  state.effects.push({ type, x, y, age: 0, life: type === 'death' ? 1.5 : 0.5, ...opts });
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  }
  resize();

  function drawFrame(state, cam, dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#070914';
    ctx.fillRect(0, 0, cam.width, cam.height);
    ctx.save();
    ctx.translate(cam.width / 2, cam.height / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    // arena edge
    ctx.lineWidth = 3 / cam.zoom;
    ctx.strokeStyle = '#FF5E73';
    ctx.beginPath();
    ctx.arc(0, 0, state.bounds.radius, 0, Math.PI * 2);
    ctx.stroke();

    const vr = Math.hypot(cam.width, cam.height) / 2 / cam.zoom;
    for (const b of state.bodies) {
      if (Math.hypot(b.x - cam.x, b.y - cam.y) > vr + b.radius) continue;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#2A2F52';
      ctx.fill();
      ctx.lineWidth = (b.kind === 'threat' ? 3 : 1.5) / cam.zoom;
      ctx.strokeStyle = KIND_COLOR[b.kind] || '#5E6C9E';
      ctx.stroke();
    }

    const p = state.player;
    if (p && p.alive) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = KIND_COLOR.player;
      ctx.fill();
    }

    for (let i = state.effects.length - 1; i >= 0; i--) {
      const e = state.effects[i];
      e.age += dt;
      if (e.age >= e.life) { state.effects.splice(i, 1); continue; }
      const k = e.age / e.life;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 2 / cam.zoom;
      ctx.strokeStyle = e.type === 'hit' || e.type === 'death' ? '#FF5E73' : e.type === 'evolve' ? '#C48BFF' : '#5FF0C0';
      ctx.beginPath();
      ctx.arc(e.x, e.y, (e.radius || 10) * (1 + 2 * k), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  return { drawFrame, resize };
}

// ---- ui (stub) -----------------------------------------------------------------------------
export function createUI(root) {
  const css = (el, s) => { el.style.cssText = s; return el; };
  const mk = (parent, tag, style, text) => {
    const el = css(document.createElement(tag), style);
    if (text) el.textContent = text;
    parent.appendChild(el);
    return el;
  };
  const font = 'font:14px system-ui,sans-serif;color:#EAF0FF;';
  const hud = mk(root, 'div', `position:absolute;left:16px;top:12px;${font}pointer-events:none`);
  const stageEl = mk(hud, 'div', 'font-size:20px;letter-spacing:.1em;text-transform:uppercase');
  const bar = mk(hud, 'div', 'margin-top:6px;width:220px;height:6px;background:#161B38;border:1px solid #2F3A73');
  const fill = mk(bar, 'div', 'height:100%;width:0;background:#5FF0C0');
  const info = mk(hud, 'div', 'margin-top:6px;color:#8F9BC7;font-variant-numeric:tabular-nums');
  const warn = mk(root, 'div', `position:absolute;left:50%;top:70px;transform:translateX(-50%);${font}color:#FF5E73;font-size:18px;display:none;pointer-events:none`, 'WARNING: leaving the known universe');
  const overlay = mk(root, 'div', `position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:12px;background:rgba(7,9,20,.7);${font}text-align:center`);

  function show(build) {
    overlay.replaceChildren();
    overlay.style.display = 'flex';
    build(overlay);
  }
  const hide = () => { overlay.style.display = 'none'; };
  const button = (parent, label, onClick) => {
    const b = mk(parent, 'button', 'padding:10px 18px;border:1px solid #2F3A73;background:#161B38;color:#EAF0FF;font:inherit;cursor:pointer', label);
    b.addEventListener('click', onClick);
    return b;
  };

  return {
    update(state) {
      const s = state.player ? state.stageIndex : 0;
      stageEl.textContent = `Stage ${s + 1}`;
      fill.style.width = `${Math.round(state.progress * 100)}%`;
      info.textContent = `mass ${state.mass.toFixed(1)}  health ${Math.round(state.health * 100)}%`;
    },
    showChoice(choices, onPick) {
      show((o) => {
        mk(o, 'div', 'font-size:22px', 'Evolve');
        const row = mk(o, 'div', 'display:flex;gap:12px');
        for (const c of choices) {
          const card = mk(row, 'div', 'padding:14px;border:1px solid #C48BFF;background:#161B38;width:180px');
          mk(card, 'div', 'font-size:16px;margin-bottom:6px', c.label);
          mk(card, 'div', 'color:#8F9BC7;margin-bottom:10px', c.description);
          button(card, 'Choose', () => { hide(); onPick(c.id); });
        }
      });
    },
    showTitle(onStart) {
      show((o) => {
        mk(o, 'div', 'font-size:40px;letter-spacing:.2em', 'DRIFT (dev stub)');
        mk(o, 'div', 'color:#8F9BC7', 'Steer with the mouse or WASD. Eat smaller, avoid larger.');
        button(o, 'Start', () => { hide(); onStart(); });
      });
    },
    showEnd(ending, onRestart) {
      show((o) => {
        mk(o, 'div', 'font-size:32px', ending.title);
        mk(o, 'div', 'max-width:420px;color:#8F9BC7', ending.text);
        button(o, 'Drift again', () => { hide(); onRestart(); });
      });
    },
    warnBoundary(on) {
      warn.style.display = on ? 'block' : 'none';
    },
  };
}
