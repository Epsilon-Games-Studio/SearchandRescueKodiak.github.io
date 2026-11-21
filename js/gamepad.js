// ---------- gamepad support: W3C Gamepad API (USB / Bluetooth: Xbox, PlayStation, Nintendo & PC) ----------
import { clamp } from './utils.js';
import { tr } from './i18n.js';

const STORAGE_KEY = 'rkPad';

export const DEFAULT_BINDS = {
  Space: 0,   // A / Cross: deploy swimmer
  KeyD: 1,    // B / Circle: side door
  KeyT: 2,    // X / Square: jump / hoist mode
  KeyR: 3,    // Y / Triangle: recall swimmer
  KeyG: 4,    // LB / L1: gear (in flight) / ENG 1 (landed)
  KeyH: 5,    // RB / R1: flare (in flight) / ENG 2 (landed)
  KeyW: 6,    // LT / L2: hoist up (analog)
  KeyS: 7,    // RT / R2: hoist down (analog)
  KeyC: 8,    // View / Share / -: cut cable (hold 0.5s, instant on snag)
  KeyP: 9,    // Menu / Options / +: pause
  KeyF: 12,   // D-Pad Up: searchlight
  KeyL: 13,   // D-Pad Down: navigation lights
  KeyB: 14,   // D-Pad Left: battery (landed)
  KeyM: 15,   // D-Pad Right: mute SFX
};

export const REMAP_ACTIONS = [
  ['Space', 'Desplegar nadador'],
  ['KeyD', 'Puerta lateral'],
  ['KeyT', 'Modo salto / grúa'],
  ['KeyR', 'Recoger nadador'],
  ['KeyG', 'Tren / Motor 1 (tierra)'],
  ['KeyH', 'Bengala / Motor 2 (tierra)'],
  ['KeyW', 'Subir grúa'],
  ['KeyS', 'Bajar grúa'],
  ['KeyF', 'Foco de búsqueda'],
  ['KeyL', 'Luces de navegación'],
  ['KeyB', 'Batería principal'],
  ['KeyM', 'Silenciar sonido'],
  ['KeyC', 'Cortar cable'],
  ['KeyP', 'Pausa'],
];

const GLYPHS = {
  xbox: {
    0: 'A', 1: 'B', 2: 'X', 3: 'Y',
    4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
    8: 'View', 9: 'Menu', 10: 'L3', 11: 'R3',
    12: '▲', 13: '▼', 14: '◀', 15: '▶',
    16: 'Xbox',
  },
  ps: {
    0: '✕', 1: '○', 2: '□', 3: '△',
    4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2',
    8: 'Share', 9: 'Opt', 10: 'L3', 11: 'R3',
    12: '▲', 13: '▼', 14: '◀', 15: '▶',
    16: 'PS',
  },
  nintendo: {
    0: 'B', 1: 'A', 2: 'Y', 3: 'X',
    4: 'L', 5: 'R', 6: 'ZL', 7: 'ZR',
    8: '-', 9: '+', 10: 'L3', 11: 'R3',
    12: '▲', 13: '▼', 14: '◀', 15: '▶',
    16: 'Home',
  },
};

const RUMBLE_PRESETS = {
  land:  { duration: 95,  weakMagnitude: 0.25, strongMagnitude: 0.35, cd: 0.25 },
  latch: { duration: 75,  weakMagnitude: 0.3,  strongMagnitude: 0.2,  cd: 0.15 },
  snag:  { duration: 160, weakMagnitude: 0.45, strongMagnitude: 0.6,  cd: 0.55 },
  gust:  { duration: 220, weakMagnitude: 0.35, strongMagnitude: 0.45, cd: 0.8 },
  boom:  { duration: 580, weakMagnitude: 0.9,  strongMagnitude: 1.0,  cd: 0.3 },
  crash: { duration: 850, weakMagnitude: 1.0,  strongMagnitude: 1.0,  cd: 0.5 },
};

let cfg = loadCfg();
let activeIdx = -1;
let inputMode = matchMedia('(pointer:coarse)').matches ? 'touch' : 'keyboard';
let prevBtns = new Map();
let cutHold = 0;
let doorHintCd = 0;
let navRepeat = { x: 0, y: 0, tx: 0, ty: 0 };
let navFocusEl = null;
let remapTarget = null;
let toastTimer = 0;
let rumbleCd = {};
let flightVec = { x: 0, y: 0 };
let hoistVal = 0;
let photoVec = { x: 0, y: 0 };
let modalOpen = false;
let modalReturnFocus = null;

let deps = {
  getState: () => 'menu',
  isPaused: () => false,
  getHeli: () => null,
  getX: () => ({}),
  isPhotoOn: () => false,
  isReplayOn: () => false,
  isCinematic: () => false,
  isTitleVisible: () => false,
  isCardVisible: () => false,
  isBriefDone: () => false,
  getReplaySpeed: () => 1,
  press: () => {},
  padLit: () => {},
  pauseOpen: () => {},
  pauseClose: () => {},
  photoOff: () => {},
  photoSave: () => {},
  photoToggleBar: () => {},
  replayEnd: () => {},
  replayCycleSpeed: () => {},
  cinematicSkip: () => {},
  titleDismiss: () => {},
  cardSkip: () => {},
  briefSkip: () => {},
  briefStart: () => {},
  briefBack: () => {},
  toMain: () => {},
  toMenu: () => {},
  onModeChange: () => {},
  say: () => {},
};

function defaultCfg() {
  return {
    glyph: 'auto',
    preset: 'analog',
    deadzone: 0.16,
    rumble: true,
    binds: { ...DEFAULT_BINDS },
  };
}

function loadCfg() {
  const base = defaultCfg();
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      if (['auto', 'xbox', 'ps', 'nintendo'].includes(raw.glyph)) base.glyph = raw.glyph;
      if (['analog', 'dpad'].includes(raw.preset)) base.preset = raw.preset;
      if (typeof raw.deadzone === 'number') base.deadzone = clamp(raw.deadzone, 0.08, 0.38);
      if (typeof raw.rumble === 'boolean') base.rumble = raw.rumble;
      if (raw.binds && typeof raw.binds === 'object') {
        for (const k of Object.keys(DEFAULT_BINDS)) {
          if (typeof raw.binds[k] === 'number' && raw.binds[k] >= 0) base.binds[k] = raw.binds[k];
        }
      }
    }
  } catch (e) {}
  return base;
}

function saveCfg() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {}
}

export function detectFamily(id = '') {
  const s = String(id).toLowerCase();
  if (/xbox|xinput|045e|microsoft/.test(s)) return 'xbox';
  if (/nintendo|switch|pro controller|joy-con|057e/.test(s)) return 'nintendo';
  if (/dualsense|dualshock|054c|sony|wireless controller|ps4|ps5|playstation/.test(s)) return 'ps';
  // Fallback estándar PC / DirectInput: Xbox (ABXY)
  return 'xbox';
}

export function getActiveGamepad() {
  if (!navigator.getGamepads) return null;
  const list = navigator.getGamepads();
  if (!list) return null;
  if (activeIdx >= 0 && list[activeIdx] && list[activeIdx].connected) return list[activeIdx];
  for (let i = 0; i < list.length; i++) {
    if (list[i] && list[i].connected && list[i].mapping === 'standard') {
      activeIdx = i;
      return list[i];
    }
  }
  for (let i = 0; i < list.length; i++) {
    if (list[i] && list[i].connected) {
      activeIdx = i;
      return list[i];
    }
  }
  activeIdx = -1;
  return null;
}

export function getActiveFamily() {
  if (cfg.glyph !== 'auto') return cfg.glyph;
  const gp = getActiveGamepad();
  return gp ? detectFamily(gp.id) : 'xbox';
}

export function getInputMode() {
  return inputMode;
}

export function setInputMode(mode) {
  if (inputMode === mode) return;
  inputMode = mode;
  if (mode !== 'gamepad') clearNavFocus();
  deps.onModeChange(mode);
}

export function getGamepadCfg() {
  return cfg;
}

export function getGlyph(code, landed = false) {
  const fam = getActiveFamily();
  const map = GLYPHS[fam] || GLYPHS.xbox;
  let targetCode = code;
  if (landed && code === 'Digit1') targetCode = 'KeyG';
  if (landed && code === 'Digit2') targetCode = 'KeyH';
  if (code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight') {
    const dir = { ArrowUp: '▲', ArrowDown: '▼', ArrowLeft: '◀', ArrowRight: '▶' }[code];
    return cfg.preset === 'dpad' ? `D-Pad ${dir}` : `Stick ${dir}`;
  }
  const idx = cfg.binds[targetCode];
  if (idx == null) return '';
  return map[idx] || `B${idx}`;
}

function btnVal(gp, idx) {
  if (!gp || !gp.buttons || idx == null || idx < 0 || idx >= gp.buttons.length) return 0;
  const b = gp.buttons[idx];
  if (!b) return 0;
  return typeof b.value === 'number' ? b.value : (b.pressed ? 1 : 0);
}

function btnPressed(gp, idx) {
  if (!gp || !gp.buttons || idx == null || idx < 0 || idx >= gp.buttons.length) return false;
  const b = gp.buttons[idx];
  return !!(b && (b.pressed || b.value > 0.5));
}

function radialStick(ax, ay, dz) {
  const x = clamp(ax || 0, -1, 1);
  const y = clamp(ay || 0, -1, 1);
  const mag = Math.hypot(x, y);
  if (mag <= dz) return { x: 0, y: 0 };
  const norm = clamp((mag - dz) / (1 - dz), 0, 1);
  // Curva suave para estacionario fino cerca del centro y respuesta total al fondo
  const curved = 0.35 * norm + 0.65 * norm * norm;
  return { x: (x / mag) * curved, y: (y / mag) * curved };
}

function showToast(msg) {
  const el = document.querySelector('#gpToast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('on');
    setTimeout(() => { if (!el.classList.contains('on')) el.hidden = true; }, 280);
  }, 2600);
}

export function rumble(preset = 'land') {
  if (!cfg.rumble || inputMode !== 'gamepad') return;
  const gp = getActiveGamepad();
  if (!gp || !gp.vibrationActuator || typeof gp.vibrationActuator.playEffect !== 'function') return;
  const p = RUMBLE_PRESETS[preset];
  if (!p) return;
  const now = performance.now() / 1000;
  if (rumbleCd[preset] && now - rumbleCd[preset] < p.cd) return;
  rumbleCd[preset] = now;
  try {
    gp.vibrationActuator.playEffect('dual-rumble', {
      startDelay: 0,
      duration: p.duration,
      weakMagnitude: p.weakMagnitude,
      strongMagnitude: p.strongMagnitude,
    }).catch(() => {});
  } catch (e) {}
}

export function stopRumble() {
  if (!navigator.getGamepads) return;
  const list = navigator.getGamepads();
  if (!list) return;
  for (const gp of list) {
    if (gp && gp.vibrationActuator && typeof gp.vibrationActuator.reset === 'function') {
      try { gp.vibrationActuator.reset().catch(() => {}); } catch (e) {}
    }
  }
}

function hasAnyActivity(gp) {
  if (!gp) return false;
  for (let i = 0; i < gp.buttons.length; i++) {
    if (btnPressed(gp, i)) return true;
  }
  if (gp.axes) {
    for (let i = 0; i < Math.min(4, gp.axes.length); i++) {
      if (Math.abs(gp.axes[i] || 0) > Math.max(0.28, cfg.deadzone + 0.1)) return true;
    }
  }
  return false;
}

function scanActiveGamepad() {
  if (!navigator.getGamepads) return null;
  const list = navigator.getGamepads();
  if (!list) return null;
  for (let i = 0; i < list.length; i++) {
    const gp = list[i];
    if (gp && gp.connected && hasAnyActivity(gp)) {
      if (activeIdx !== i) {
        activeIdx = i;
        deps.onModeChange(inputMode);
      }
      setInputMode('gamepad');
      return gp;
    }
  }
  return getActiveGamepad();
}

let navEditing = false;

function setNavEditing(on) {
  navEditing = !!on && !!navFocusEl && (navFocusEl.tagName === 'SELECT' || (navFocusEl.tagName === 'INPUT' && navFocusEl.type === 'range'));
  if (navFocusEl) navFocusEl.classList.toggle('gp-edit', navEditing);
}

function clearNavFocus() {
  if (navFocusEl) {
    navFocusEl.classList.remove('gp-focus', 'gp-edit');
    navFocusEl = null;
  }
  navEditing = false;
}

function getActiveOverlay() {
  if (modalOpen) return document.querySelector('#padCfg');
  for (const id of ['#pause', '#end', '#menu', '#camp', '#credits', '#main']) {
    const el = document.querySelector(id);
    if (el && !el.hidden) return el;
  }
  return null;
}

function getNavItems(ov) {
  if (!ov) return [];
  return Array.from(ov.querySelectorAll('button:not([hidden]):not(:disabled), select:not(:disabled), input[type=range]:not(:disabled)'))
    .filter((el) => el.offsetParent !== null && !el.closest('[hidden]'));
}

function setNavFocus(el) {
  if (navFocusEl && navFocusEl !== el) navFocusEl.classList.remove('gp-focus', 'gp-edit');
  navEditing = false;
  navFocusEl = el || null;
  if (navFocusEl) {
    navFocusEl.classList.add('gp-focus');
    try { navFocusEl.focus({ preventScroll: true }); } catch (e) {}
    try { navFocusEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
  }
}

function moveNavFocus2D(items, sx, sy) {
  if (!items.length) return;
  if (!navFocusEl || !items.includes(navFocusEl)) {
    setNavFocus(items[0]);
    return;
  }
  const cur = navFocusEl.getBoundingClientRect();
  const cx = cur.left + cur.width / 2;
  const cy = cur.top + cur.height / 2;
  let best = null;
  let bestScore = Infinity;

  for (const el of items) {
    if (el === navFocusEl) continue;
    const r = el.getBoundingClientRect();
    const ex = r.left + r.width / 2;
    const ey = r.top + r.height / 2;
    const dx = ex - cx;
    const dy = ey - cy;

    if (sx !== 0 && sx * dx > 4 && Math.abs(dy) <= Math.max(cur.height, r.height) * 1.1) {
      const score = Math.abs(dx) + Math.abs(dy) * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    } else if (sy !== 0 && sy * dy > 4) {
      const score = Math.abs(dy) + Math.abs(dx) * 0.45;
      if (score < bestScore) { bestScore = score; best = el; }
    }
  }

  if (best) {
    setNavFocus(best);
    return;
  }
  // Fallback secuencial si no hay vecino directo en esa dirección
  const step = sx !== 0 ? sx : sy;
  const idx = (items.indexOf(navFocusEl) + step + items.length) % items.length;
  setNavFocus(items[idx]);
}

function adjustControl(el, dir) {
  if (!el) return;
  if (el.tagName === 'INPUT' && el.type === 'range') {
    const min = parseFloat(el.min || '0');
    const max = parseFloat(el.max || '100');
    const step = parseFloat(el.step || '1');
    const span = max - min;
    const delta = span > 20 ? Math.max(step, Math.round(span / 16)) : step;
    const next = clamp(parseFloat(el.value) + dir * delta, min, max);
    if (next !== parseFloat(el.value)) {
      el.value = String(next);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } else if (el.tagName === 'SELECT') {
    const len = el.options.length;
    if (!len) return;
    const next = (el.selectedIndex + dir + len) % len;
    el.selectedIndex = next;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function handleBackAction() {
  if (modalOpen) {
    closeGamepadModal();
    return;
  }
  const ov = getActiveOverlay();
  if (!ov) return;
  if (ov.id === 'pause') deps.pauseClose();
  else if (ov.id === 'menu' || ov.id === 'camp' || ov.id === 'credits' || ov.id === 'end') deps.toMain();
}

function updateModalTester(gp) {
  if (!modalOpen) return;
  const nameEl = document.querySelector('#gpName');
  const mapEl = document.querySelector('#gpMap');
  const dot = document.querySelector('#gpDot');
  if (gp) {
    const fam = detectFamily(gp.id);
    const famLbl = fam === 'ps' ? 'PlayStation' : fam === 'nintendo' ? 'Nintendo' : 'Xbox / PC';
    if (nameEl) nameEl.textContent = gp.id;
    if (mapEl) mapEl.textContent = `${famLbl} · ${gp.mapping === 'standard' ? 'Standard' : tr('Genérico')}`;
    if (dot) dot.classList.add('on');
    const ls = radialStick(gp.axes[0], gp.axes[1], cfg.deadzone);
    const rs = radialStick(gp.axes[2], gp.axes[3], cfg.deadzone);
    const lDot = document.querySelector('#gpStickL');
    const rDot = document.querySelector('#gpStickR');
    if (lDot) lDot.style.transform = `translate(${(ls.x * 14).toFixed(1)}px, ${(ls.y * 14).toFixed(1)}px)`;
    if (rDot) rDot.style.transform = `translate(${(rs.x * 14).toFixed(1)}px, ${(rs.y * 14).toFixed(1)}px)`;
    const lt = document.querySelector('#gpTrigL');
    const rt = document.querySelector('#gpTrigR');
    if (lt) lt.style.width = `${Math.round(btnVal(gp, cfg.binds.KeyW) * 100)}%`;
    if (rt) rt.style.width = `${Math.round(btnVal(gp, cfg.binds.KeyS) * 100)}%`;
    const activeEl = document.querySelector('#gpActiveBtns');
    if (activeEl) {
      const famMap = GLYPHS[getActiveFamily()] || GLYPHS.xbox;
      const pressed = [];
      for (let i = 0; i < gp.buttons.length; i++) {
        if (btnPressed(gp, i)) pressed.push(famMap[i] || `B${i}`);
      }
      activeEl.textContent = pressed.length ? pressed.join(' · ') : '—';
    }
  } else {
    if (nameEl) nameEl.textContent = tr('Ningún mando conectado');
    if (mapEl) mapEl.textContent = tr('Conecta un mando USB o Bluetooth y pulsa cualquier botón');
    if (dot) dot.classList.remove('on');
    const activeEl = document.querySelector('#gpActiveBtns');
    if (activeEl) activeEl.textContent = '—';
  }
}

export function pollGamepad(dt) {
  flightVec.x = 0;
  flightVec.y = 0;
  hoistVal = 0;
  photoVec.x = 0;
  photoVec.y = 0;
  if (doorHintCd > 0) doorHintCd -= dt;

  const gp = scanActiveGamepad();
  updateModalTester(gp);
  if (!gp) {
    cutHold = 0;
    return;
  }

  const prev = prevBtns.get(gp.index) || [];
  const curr = [];
  const justPressed = [];
  const justReleased = [];
  const len = gp.buttons ? gp.buttons.length : 0;
  for (let i = 0; i < len; i++) {
    const p = btnPressed(gp, i);
    curr[i] = p;
    if (p && !prev[i]) justPressed.push(i);
    if (!p && prev[i]) justReleased.push(i);
  }
  prevBtns.set(gp.index, curr);

  // Modo remapeo activo: captura el primer botón pulsado
  if (remapTarget) {
    if (justPressed.length) {
      const bIdx = justPressed[0];
      cfg.binds[remapTarget] = bIdx;
      saveCfg();
      remapTarget = null;
      renderRemapList();
      deps.onModeChange(inputMode);
    }
    return;
  }

  const anyJust = justPressed.length > 0;
  if (anyJust) setInputMode('gamepad');

  // 1. Pantalla de título
  if (deps.isTitleVisible()) {
    if (anyJust) deps.titleDismiss();
    return;
  }

  // 2. Tarjetas de campaña
  if (deps.isCardVisible()) {
    if (anyJust) deps.cardSkip();
    return;
  }

  const st = deps.getState();

  // 3. Briefing
  if (st === 'brief' && !modalOpen) {
    const aBtn = cfg.binds.Space ?? 0;
    const bBtn = cfg.binds.KeyD ?? 1;
    const startBtn = cfg.binds.KeyP ?? 9;
    if (justPressed.includes(bBtn)) {
      deps.briefBack();
      return;
    }
    if (justPressed.includes(aBtn) || justPressed.includes(startBtn)) {
      if (deps.isBriefDone()) deps.briefStart();
      else deps.briefSkip();
    }
    return;
  }

  // 4. Repetición / Cinemáticas
  if (deps.isReplayOn() && !modalOpen) {
    const bBtn = cfg.binds.KeyD ?? 1;
    const xBtn = cfg.binds.KeyT ?? 2;
    const startBtn = cfg.binds.KeyP ?? 9;
    if (justPressed.includes(bBtn) || justPressed.includes(startBtn)) deps.replayEnd();
    else if (justPressed.includes(xBtn)) deps.replayCycleSpeed();
    return;
  }
  if (deps.isCinematic() && !modalOpen) {
    const bBtn = cfg.binds.KeyD ?? 1;
    const startBtn = cfg.binds.KeyP ?? 9;
    if (justPressed.includes(bBtn) || justPressed.includes(startBtn)) deps.cinematicSkip();
    return;
  }

  // 5. Modo foto
  if (deps.isPhotoOn() && !modalOpen) {
    const ls = radialStick(gp.axes[0], gp.axes[1], cfg.deadzone);
    const dx = (btnPressed(gp, 15) ? 1 : 0) - (btnPressed(gp, 14) ? 1 : 0);
    const dy = (btnPressed(gp, 13) ? 1 : 0) - (btnPressed(gp, 12) ? 1 : 0);
    photoVec.x = clamp(ls.x + dx, -1, 1);
    photoVec.y = clamp(ls.y + dy, -1, 1);
    if (justPressed.includes(0)) deps.photoSave();
    else if (justPressed.includes(1) || justPressed.includes(cfg.binds.KeyP ?? 9)) deps.photoOff();
    else if (justPressed.includes(3)) deps.photoToggleBar();
    return;
  }

  // 6. Menús DOM (incluido #pause, #menu, #main, #camp, #end, #credits, #padCfg)
  const ov = getActiveOverlay();
  if (ov) {
    const items = getNavItems(ov);
    if (items.length && (!navFocusEl || !ov.contains(navFocusEl) || navFocusEl.disabled)) {
      setNavFocus(items[0]);
    }
    const ls = radialStick(gp.axes[0], gp.axes[1], Math.max(0.24, cfg.deadzone));
    const dx = (btnPressed(gp, 15) ? 1 : 0) - (btnPressed(gp, 14) ? 1 : 0) + (Math.abs(ls.x) > 0.45 ? Math.sign(ls.x) : 0);
    const dy = (btnPressed(gp, 13) ? 1 : 0) - (btnPressed(gp, 12) ? 1 : 0) + (Math.abs(ls.y) > 0.45 ? Math.sign(ls.y) : 0);
    const sx = Math.sign(dx);
    const sy = Math.sign(dy);

    if (navEditing) {
      const dir = sx !== 0 ? sx : sy;
      if (dir !== 0) {
        if (navRepeat.x !== dir) {
          adjustControl(navFocusEl, dir);
          navRepeat.x = dir;
          navRepeat.tx = 0.32;
        } else {
          navRepeat.tx -= dt;
          if (navRepeat.tx <= 0) {
            adjustControl(navFocusEl, dir);
            navRepeat.tx = 0.09;
          }
        }
      } else {
        navRepeat.x = 0;
      }
      if (justPressed.includes(0) || justPressed.includes(1)) {
        setNavEditing(false);
      }
      return;
    }

    if (sy !== 0) {
      if (navRepeat.y !== sy) {
        moveNavFocus2D(items, 0, sy);
        navRepeat.y = sy;
        navRepeat.ty = 0.34;
      } else {
        navRepeat.ty -= dt;
        if (navRepeat.ty <= 0) {
          moveNavFocus2D(items, 0, sy);
          navRepeat.ty = 0.11;
        }
      }
    } else {
      navRepeat.y = 0;
    }

    if (sx !== 0) {
      if (navRepeat.x !== sx) {
        moveNavFocus2D(items, sx, 0);
        navRepeat.x = sx;
        navRepeat.tx = 0.34;
      } else {
        navRepeat.tx -= dt;
        if (navRepeat.tx <= 0) {
          moveNavFocus2D(items, sx, 0);
          navRepeat.tx = 0.11;
        }
      }
    } else {
      navRepeat.x = 0;
    }

    if (justPressed.includes(0) && navFocusEl) {
      if (navFocusEl.tagName === 'SELECT' || (navFocusEl.tagName === 'INPUT' && navFocusEl.type === 'range')) {
        setNavEditing(true);
      } else {
        navFocusEl.click();
      }
    } else if (justPressed.includes(1)) {
      handleBackAction();
    } else if (justPressed.includes(9)) {
      if (ov.id === 'pause') deps.pauseClose();
      else if (ov.id === 'menu') {
        const go = document.querySelector('#start');
        if (go) go.click();
      }
    }
    return;
  }

  // 7. En vuelo / tierra (state === 'play')
  if (st !== 'play' || deps.isPaused()) return;
  const h = deps.getHeli();
  if (!h || h.dead) return;

  // Pilotaje: preset analógico (stick izq.) o preset cruceta (D-Pad)
  if (cfg.preset === 'dpad') {
    flightVec.x = (btnPressed(gp, 15) ? 1 : 0) - (btnPressed(gp, 14) ? 1 : 0);
    flightVec.y = (btnPressed(gp, 13) ? 1 : 0) - (btnPressed(gp, 12) ? 1 : 0);
  } else {
    const ls = radialStick(gp.axes[0], gp.axes[1], cfg.deadzone);
    flightVec.x = ls.x;
    flightVec.y = ls.y;
  }

  // Grúa analógica doble: gatillos (LT/RT) + Stick Derecho vertical
  const upTrig = btnVal(gp, cfg.binds.KeyW);
  const dnTrig = btnVal(gp, cfg.binds.KeyS);
  const rs = radialStick(gp.axes[2], gp.axes[3], cfg.deadzone);
  hoistVal = clamp((dnTrig - upTrig) + rs.y, -1, 1);

  if (Math.abs(hoistVal) > 0.2 && !h.landed && h.door < 0.95 && doorHintCd <= 0) {
    doorHintCd = 3;
    deps.say('Abre la puerta lateral (D) para usar la grúa.', 3);
  }

  // Acciones discretas con flancos
  const fireAction = (code, bIdx) => {
    if (justPressed.includes(bIdx)) {
      deps.padLit(code, true);
      deps.press(code);
    }
    if (justReleased.includes(bIdx)) {
      deps.padLit(code, false);
    }
  };

  fireAction('KeyP', cfg.binds.KeyP);
  fireAction('Space', cfg.binds.Space);
  fireAction('KeyD', cfg.binds.KeyD);
  fireAction('KeyT', cfg.binds.KeyT);
  fireAction('KeyR', cfg.binds.KeyR);

  // En tierra: LB/RB arrancan motores; en vuelo: tren / bengala
  if (h.landed) {
    fireAction('Digit1', cfg.binds.KeyG);
    fireAction('Digit2', cfg.binds.KeyH);
  } else {
    fireAction('KeyG', cfg.binds.KeyG);
    fireAction('KeyH', cfg.binds.KeyH);
  }

  // En preset cruceta, el D-Pad se usa para volar: las acciones secundarias siguen accesibles en L3/R3
  if (cfg.preset === 'dpad') {
    fireAction('KeyF', 10);
    fireAction('KeyL', 11);
  } else {
    fireAction('KeyF', cfg.binds.KeyF);
    fireAction('KeyL', cfg.binds.KeyL);
    fireAction('KeyB', cfg.binds.KeyB);
    fireAction('KeyM', cfg.binds.KeyM);
  }

  // Seguridad en corte de cable (KeyC): instantáneo si está enganchado, 0.5 s mantenido en vuelo normal
  const cIdx = cfg.binds.KeyC;
  const X = deps.getX();
  if (X && X.snag) {
    fireAction('KeyC', cIdx);
    cutHold = 0;
  } else if (btnPressed(gp, cIdx)) {
    if (cutHold >= 0) {
      cutHold += dt;
      if (cutHold >= 0.5) {
        cutHold = -1; // evita repetir hasta soltar
        deps.press('KeyC');
      }
    }
  } else {
    cutHold = 0;
  }
}

export function getFlightInput() {
  return flightVec;
}

export function getHoistInput() {
  return hoistVal;
}

export function getPhotoPanInput() {
  return photoVec;
}

function renderRemapList() {
  const box = document.querySelector('#gpRemap');
  if (!box) return;
  const map = GLYPHS[getActiveFamily()] || GLYPHS.xbox;
  box.innerHTML = REMAP_ACTIONS.map(([code, label]) => {
    const bIdx = cfg.binds[code];
    const waiting = remapTarget === code;
    const val = waiting ? tr('Pulsa un botón…') : (map[bIdx] || `B${bIdx}`);
    return `<button type="button" class="chip${waiting ? ' rand' : ''}" data-bind="${code}"><span>${tr(label)}</span><b>${val}</b></button>`;
  }).join('');
}

export function openGamepadModal() {
  const modal = document.querySelector('#padCfg');
  if (!modal) return;
  modalReturnFocus = document.activeElement;
  modalOpen = true;
  remapTarget = null;
  const gEl = document.querySelector('#gpGlyph');
  const pEl = document.querySelector('#gpPreset');
  const dEl = document.querySelector('#gpDeadzone');
  const dOut = document.querySelector('#gpDeadzoneOut');
  const rEl = document.querySelector('#gpRumble');
  if (gEl) gEl.value = cfg.glyph;
  if (pEl) pEl.value = cfg.preset;
  if (dEl) dEl.value = String(Math.round(cfg.deadzone * 100));
  if (dOut) dOut.textContent = `${Math.round(cfg.deadzone * 100)}%`;
  if (rEl) rEl.value = cfg.rumble ? '1' : '0';
  renderRemapList();
  modal.hidden = false;
  const first = modal.querySelector('#gpGlyph');
  if (first) setNavFocus(first);
}

export function closeGamepadModal() {
  const modal = document.querySelector('#padCfg');
  if (!modal) return;
  modalOpen = false;
  remapTarget = null;
  modal.hidden = true;
  clearNavFocus();
  if (modalReturnFocus && typeof modalReturnFocus.focus === 'function') {
    try { modalReturnFocus.focus(); } catch (e) {}
  }
}

function bindModalUI() {
  const modal = document.querySelector('#padCfg');
  if (!modal) return;
  const gEl = document.querySelector('#gpGlyph');
  const pEl = document.querySelector('#gpPreset');
  const dEl = document.querySelector('#gpDeadzone');
  const dOut = document.querySelector('#gpDeadzoneOut');
  const rEl = document.querySelector('#gpRumble');
  const rst = document.querySelector('#gpReset');
  const close = document.querySelector('#gpClose');
  const remap = document.querySelector('#gpRemap');

  if (gEl) gEl.addEventListener('change', () => { cfg.glyph = gEl.value; saveCfg(); renderRemapList(); deps.onModeChange(inputMode); });
  if (pEl) pEl.addEventListener('change', () => { cfg.preset = pEl.value; saveCfg(); deps.onModeChange(inputMode); });
  if (dEl) dEl.addEventListener('input', () => {
    cfg.deadzone = clamp(parseInt(dEl.value, 10) / 100, 0.08, 0.38);
    if (dOut) dOut.textContent = `${dEl.value}%`;
    saveCfg();
  });
  if (rEl) rEl.addEventListener('change', () => { cfg.rumble = rEl.value === '1'; saveCfg(); if (cfg.rumble) rumble('latch'); });
  if (rst) rst.addEventListener('click', () => {
    cfg = defaultCfg();
    saveCfg();
    openGamepadModal();
    deps.onModeChange(inputMode);
  });
  if (close) close.addEventListener('click', closeGamepadModal);
  if (remap) remap.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-bind]');
    if (!btn) return;
    remapTarget = btn.dataset.bind;
    renderRemapList();
  });
}

export function initGamepad(d) {
  deps = { ...deps, ...d };
  bindModalUI();

  addEventListener('gamepadconnected', (e) => {
    const gp = e.gamepad;
    activeIdx = gp.index;
    setInputMode('gamepad');
    const fam = detectFamily(gp.id);
    const label = fam === 'ps' ? 'PlayStation' : fam === 'nintendo' ? 'Nintendo' : 'Xbox / PC';
    showToast(tr('Mando conectado') + `: ${label}`);
    deps.onModeChange('gamepad');
  });

  addEventListener('gamepaddisconnected', (e) => {
    prevBtns.delete(e.gamepad.index);
    if (activeIdx === e.gamepad.index) {
      activeIdx = -1;
      stopRumble();
      showToast(tr('Mando desconectado'));
      if (deps.getState() === 'play' && !deps.isPaused() && !deps.isCinematic()) {
        deps.pauseOpen();
      }
    }
  });

  addEventListener('keydown', (e) => {
    if (!['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) setInputMode('keyboard');
  }, true);

  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') setInputMode('touch');
  }, true);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopRumble();
  });

  addEventListener('blur', () => {
    stopRumble();
    prevBtns.clear();
  });
}
