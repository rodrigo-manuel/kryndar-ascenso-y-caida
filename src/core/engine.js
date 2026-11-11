'use strict';
// ============================================================================
//  KRYNDAR — núcleo: espacio de nombres, utilidades matemáticas y entrada.
// ============================================================================
window.K = window.K || {};

(function (K) {
  K.W = 960;            // ancho lógico de la vista
  K.H = 540;            // alto lógico de la vista
  K.TS = 32;            // tamaño de baldosa (tile)

  // ---------- Matemáticas ----------
  K.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  K.lerp = (a, b, t) => a + (b - a) * t;
  K.approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
  K.rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  K.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  K.pick = arr => arr[Math.floor(Math.random() * arr.length)];
  K.sign = v => (v < 0 ? -1 : 1);
  K.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  K.overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  K.ease = {
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inCubic: t => t * t * t,
    inOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    outBack: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  };
  // Generador pseudoaleatorio con semilla (xorshift) para escenarios deterministas.
  K.seeded = function (seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  };

  // ---------- Color ----------
  const hexCache = {};
  K.hexRGB = function (hex) {
    if (hexCache[hex]) return hexCache[hex];
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const v = [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
    hexCache[hex] = v;
    return v;
  };
  K.rgba = (hex, a) => { const c = K.hexRGB(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  K.shade = function (hex, f) {
    const c = K.hexRGB(hex);
    const m = v => K.clamp(Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)), 0, 255);
    return '#' + [m(c[0]), m(c[1]), m(c[2])].map(v => v.toString(16).padStart(2, '0')).join('');
  };
  K.mix = function (h1, h2, t) {
    const a = K.hexRGB(h1), b = K.hexRGB(h2);
    return '#' + [0, 1, 2].map(i => Math.round(K.lerp(a[i], b[i], t)).toString(16).padStart(2, '0')).join('');
  };
  K.font = (size, weight = 600, fam = 'Rajdhani') => `${weight} ${size}px ${fam}, 'Segoe UI', sans-serif`;

  // ---------- Entidad base ----------
  let nextId = 1;
  K.Entity = class {
    constructor(x, y, w, h) {
      this.id = nextId++;
      this.x = x; this.y = y; this.w = w; this.h = h;
      this.vx = 0; this.vy = 0;
      this.onGround = false;
      this.facing = 1;
      this.remove = false;
    }
    get cx() { return this.x + this.w / 2; }
    get cy() { return this.y + this.h / 2; }
    get bottom() { return this.y + this.h; }
    hurtbox() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }
  };

  // ---------- Entrada (teclado + ratón) ----------
  const BIND = {
    left: ['KeyA', 'ArrowLeft'],
    right: ['KeyD', 'ArrowRight'],
    up: ['KeyW', 'ArrowUp'],
    down: ['KeyS', 'ArrowDown'],
    fly: ['Space'],
    attack: ['KeyJ'],
    dash: ['ShiftLeft', 'ShiftRight', 'KeyK'],
    interact: ['KeyE'],
    shout: ['KeyQ'],
    pause: ['Escape', 'KeyP'],
    confirm: ['Enter', 'NumpadEnter', 'Space'],
    mute: ['KeyM'],
  };
  const Input = K.Input = {
    down: {}, pressed: {}, released: {},
    mouseDown: false, mousePressed: false, mouseReleased: false,
    isDown(a) { return BIND[a].some(c => this.down[c]) || (a === 'attack' && this.mouseDown); },
    wasPressed(a) { return BIND[a].some(c => this.pressed[c]) || (a === 'attack' && this.mousePressed); },
    wasReleased(a) { return BIND[a].some(c => this.released[c]) || (a === 'attack' && this.mouseReleased); },
    anyPressed() { return Object.keys(this.pressed).length > 0 || this.mousePressed; },
    endFrame() { this.pressed = {}; this.released = {}; this.mousePressed = false; this.mouseReleased = false; },
    clear() { this.down = {}; this.mouseDown = false; this.endFrame(); },
  };
  const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
  window.addEventListener('keydown', e => {
    if (BLOCK.has(e.code)) e.preventDefault();
    if (!e.repeat) Input.pressed[e.code] = true;
    Input.down[e.code] = true;
    if (K.Audio) K.Audio.init();
  });
  window.addEventListener('keyup', e => { Input.down[e.code] = false; Input.released[e.code] = true; });
  window.addEventListener('mousedown', e => {
    if (K.Audio) K.Audio.init();
    if (e.button !== 0) return;
    if (e.target && e.target.id === 'game') { Input.mouseDown = true; Input.mousePressed = true; }
  });
  window.addEventListener('mouseup', e => { if (e.button === 0) { if (Input.mouseDown) Input.mouseReleased = true; Input.mouseDown = false; } });
  window.addEventListener('blur', () => Input.clear());
  window.addEventListener('contextmenu', e => e.preventDefault());
})(window.K);
