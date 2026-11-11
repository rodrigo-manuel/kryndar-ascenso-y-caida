'use strict';
// ============================================================================
//  Mapas de baldosas: los niveles se describen como TEXTO (una fila por línea,
//  un carácter por baldosa). Aquí se leen, se calculan colisiones y física.
//
//  Leyenda de caracteres:
//   #  roca/metal sólido          -  plataforma fina (se atraviesa desde abajo)
//   ^  pinchos (daño)             B  pared agrietada (golpe cargado)
//   g  gravedad extrema fija      h  gravedad extrema intermitente
//   y / z  zonas de gravedad del jefe (izquierda / derecha)
//   P  inicio de Kriss            C  punto de control        F  fragmento
//   E  orbe de energía            S  soldado                 K  Teniente Korr
//   V  General Vexor              N  personaje aliado        X  salida
//   ?  disparador de diálogo      i  cartel de ayuda
//   1-5 palancas  →  q w e r t compuertas que abren (1→q, 2→w, ...)
//   a  barrera que se cierra en la arena   b  barrera que se abre al vencer
// ============================================================================
(function (K) {
  const TS = K.TS;

  // Constructor de mapas: permite "dibujar" el texto del nivel con rectángulos.
  K.MapBuilder = function (w, h) {
    const g = [];
    for (let y = 0; y < h; y++) g.push(new Array(w).fill(' '));
    const api = {
      w, h, g,
      fill(x, y, ww, hh, ch = '#') {
        for (let j = y; j < y + hh; j++) for (let i = x; i < x + ww; i++) if (i >= 0 && i < w && j >= 0 && j < h) g[j][i] = ch;
        return api;
      },
      set(x, y, ch) { if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = ch; return api; },
      ground(x1, x2, top, ch = '#') { return api.fill(x1, top, x2 - x1 + 1, h - top, ch); },
      plat(x, y, len, ch = '-') { return api.fill(x, y, len, 1, ch); },
      col(x, y1, y2, ch) { return api.fill(x, y1, 1, y2 - y1 + 1, ch); },
      rows() { return g.map(r => r.join('')); },
    };
    return api;
  };

  const GRAV = { g: 1, h: 2, y: 3, z: 4 };

  K.Tilemap = class {
    constructor(rows) {
      this.h = rows.length;
      this.w = Math.max(...rows.map(r => r.length));
      this.ch = rows.map(r => r.padEnd(this.w, ' ').split(''));
      this.coll = new Uint8Array(this.w * this.h);   // 0 vacío, 1 sólido, 2 plataforma fina, 3 pinchos
      this.grav = new Uint8Array(this.w * this.h);
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          const c = this.ch[y][x];
          const i = y * this.w + x;
          this.coll[i] = c === '#' ? 1 : c === '-' ? 2 : c === '^' ? 3 : 0;
          if (GRAV[c]) this.grav[i] = GRAV[c];
        }
      }
    }
    get pw() { return this.w * TS; }
    get ph() { return this.h * TS; }
    cell(tx, ty) {
      if (tx < 0 || tx >= this.w) return 1;
      if (ty < 0 || ty >= this.h) return 0;
      return this.coll[ty * this.w + tx];
    }
    setColl(tx, ty, v) { if (tx >= 0 && tx < this.w && ty >= 0 && ty < this.h) this.coll[ty * this.w + tx] = v; }
    isSolid(tx, ty) { return this.cell(tx, ty) === 1; }
    isFloor(tx, ty) { const c = this.cell(tx, ty); return c === 1 || c === 2; }
    solidAt(px, py) { return this.isSolid(Math.floor(px / TS), Math.floor(py / TS)); }
    gravAt(px, py) {
      const tx = Math.floor(px / TS), ty = Math.floor(py / TS);
      if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return 0;
      return this.grav[ty * this.w + tx];
    }
    // ¿Hay línea de visión libre entre dos puntos?
    lineClear(x1, y1, x2, y2) {
      const d = Math.hypot(x2 - x1, y2 - y1);
      const n = Math.ceil(d / 8);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        if (this.solidAt(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
      }
      return true;
    }
    // Distancia hasta el primer sólido en una dirección (para conos de visión).
    rayLen(x, y, ang, max) {
      const dx = Math.cos(ang), dy = Math.sin(ang);
      for (let d = 8; d < max; d += 8) {
        if (this.solidAt(x + dx * d, y + dy * d)) {
          for (let e = d - 7; e <= d; e += 1) if (this.solidAt(x + dx * e, y + dy * e)) return e;
          return d;
        }
      }
      return max;
    }
    hazardOverlap(b) {
      const x0 = Math.floor((b.x + 3) / TS), x1 = Math.floor((b.x + b.w - 3) / TS);
      const y0 = Math.floor((b.y + 6) / TS), y1 = Math.floor((b.y + b.h - 1) / TS);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
        if (this.cell(tx, ty) === 3) {
          // los pinchos ocupan la mitad inferior de la baldosa
          if (b.y + b.h > ty * TS + TS * 0.45) return true;
        }
      }
      return false;
    }
    // Agrupa baldosas contiguas que cumplan una condición (relleno por inundación).
    groups(test) {
      const seen = new Uint8Array(this.w * this.h);
      const out = [];
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const i = y * this.w + x;
        if (seen[i] || !test(x, y)) continue;
        const key = test(x, y);
        const tiles = [], stack = [[x, y]]; seen[i] = 1;
        let minx = x, maxx = x, miny = y, maxy = y;
        while (stack.length) {
          const [cx, cy] = stack.pop();
          tiles.push({ x: cx, y: cy });
          minx = Math.min(minx, cx); maxx = Math.max(maxx, cx); miny = Math.min(miny, cy); maxy = Math.max(maxy, cy);
          for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
            if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
            const j = ny * this.w + nx;
            if (!seen[j] && test(nx, ny) === key) { seen[j] = 1; stack.push([nx, ny]); }
          }
        }
        out.push({ key, tiles, x: minx * TS, y: miny * TS, w: (maxx - minx + 1) * TS, h: (maxy - miny + 1) * TS });
      }
      return out;
    }
  };

  // ---------- Física con colisión por ejes separados (AABB contra baldosas) ----------
  function moveX(b, map, dx) {
    if (!dx) return;
    b.x += dx;
    const top = Math.floor(b.y / TS), bot = Math.floor((b.y + b.h - 0.01) / TS);
    if (dx > 0) {
      const tx = Math.floor((b.x + b.w) / TS);
      for (let ty = top; ty <= bot; ty++) if (map.isSolid(tx, ty)) { b.x = tx * TS - b.w - 0.001; b.vx = 0; b.hitWall = 1; return; }
    } else {
      const tx = Math.floor(b.x / TS);
      for (let ty = top; ty <= bot; ty++) if (map.isSolid(tx, ty)) { b.x = (tx + 1) * TS + 0.001; b.vx = 0; b.hitWall = -1; return; }
    }
  }
  function moveY(b, map, dy) {
    if (!dy) return;
    const oldBottom = b.y + b.h;
    b.y += dy;
    const l = Math.floor(b.x / TS), r = Math.floor((b.x + b.w - 0.01) / TS);
    if (dy > 0) {
      const ty = Math.floor((b.y + b.h) / TS);
      for (let tx = l; tx <= r; tx++) {
        const c = map.cell(tx, ty);
        if (c === 1 || (c === 2 && oldBottom <= ty * TS + 0.5 && !b.dropThrough)) {
          b.y = ty * TS - b.h; b.vy = 0; b.onGround = true; return;
        }
      }
    } else {
      const ty = Math.floor(b.y / TS);
      for (let tx = l; tx <= r; tx++) if (map.isSolid(tx, ty)) { b.y = (ty + 1) * TS; b.vy = 0; b.hitCeil = true; return; }
    }
  }
  K.moveBody = function (b, map, dt) {
    const dx = b.vx * dt, dy = b.vy * dt;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 10));
    b.hitWall = 0; b.hitCeil = false; b.onGround = false;
    for (let i = 0; i < steps; i++) { moveX(b, map, dx / steps); moveY(b, map, dy / steps); }
  };
})(window.K);
