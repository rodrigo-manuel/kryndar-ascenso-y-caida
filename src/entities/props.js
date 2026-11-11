'use strict';
// ============================================================================
//  Objetos del escenario: fragmentos del Núcleo, puntos de control, orbes de
//  energía, palancas, compuertas, muros agrietados, salidas, carteles de ayuda,
//  personajes aliados, disparadores de diálogo y zonas de gravedad.
// ============================================================================
(function (K) {
  const TS = K.TS;
  const near = (p, x, y, r) => K.dist(p.cx, p.cy, x, y) < r;

  // ---------- Fragmento del Núcleo de Solthar ----------
  K.Fragment = class {
    constructor(x, y) { this.x = x; this.y = y; this.t = Math.random() * 6; this.taken = false; this.kind = 'fragment'; }
    update(dt, g) {
      this.t += dt;
      if (this.taken) return;
      if (Math.random() < dt * 12) { const a = Math.random() * 6.28; K.FX.spawn({ x: this.x + Math.cos(a) * 22, y: this.y + Math.sin(a) * 22, vx: -Math.cos(a) * 20, vy: -Math.sin(a) * 20 - 20, life: 0.9, size: 2, color: K.pick(['#ffcf6b', '#c48aff', '#ffffff']), type: 'glow', add: true }); }
      if (g.player.alive && near(g.player, this.x, this.y + Math.sin(this.t * 2) * 5, 34)) { this.taken = true; g.collectFragment(this); }
    }
    light() { return this.taken ? null : { x: this.x, y: this.y, r: 200, color: '#ffcf6b' }; }
    draw(ctx) {
      if (this.taken) return;
      const y = this.y + Math.sin(this.t * 2) * 5;
      K.FX.glow(ctx, this.x, y, 70 + Math.sin(this.t * 3) * 8, '#c48aff', 0.55);
      K.FX.glow(ctx, this.x, y, 34, '#ffcf6b', 0.8);
      ctx.save(); ctx.translate(this.x, y);
      const sq = Math.cos(this.t * 1.6);
      ctx.scale(0.35 + Math.abs(sq) * 0.65, 1);
      const g = ctx.createLinearGradient(-10, -18, 10, 18);
      g.addColorStop(0, '#fff6d8'); g.addColorStop(0.45, '#ffcf6b'); g.addColorStop(1, '#9b4bff');
      ctx.fillStyle = g; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(10, -4); ctx.lineTo(5, 17); ctx.lineTo(-6, 15); ctx.lineTo(-10, -3); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.moveTo(0, -19); ctx.lineTo(-1, 15); ctx.moveTo(10, -4); ctx.lineTo(-10, -3); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,207,107,0.5)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(this.x, y, 26, 8, Math.sin(this.t) * 0.3, 0, Math.PI * 2); ctx.stroke();
    }
  };

  // ---------- Punto de control ----------
  K.Checkpoint = class {
    constructor(x, y) { this.x = x; this.y = y; this.active = false; this.t = Math.random() * 6; this.kind = 'checkpoint'; }
    update(dt, g) {
      this.t += dt;
      const p = g.player;
      if (!this.active && p.alive && Math.abs(p.cx - this.x) < 26 && p.bottom > this.y - 80 && p.y < this.y) {
        g.setCheckpoint(this);
      }
    }
    activate() {
      this.active = true;
      K.Audio.sfx('checkpoint');
      K.FX.ring(this.x, this.y - 40, 6, 70, 0.6, '#5ff3ff', 3);
      K.FX.burst(this.x, this.y - 44, 20, { color: ['#5ff3ff', '#bff8ff'], speed: [40, 180], life: [0.4, 0.9], size: [1.5, 3], type: 'glow', add: true });
    }
    light() { return { x: this.x, y: this.y - 44, r: this.active ? 150 : 70, color: this.active ? '#5ff3ff' : '#ff6070' }; }
    draw(ctx) {
      const x = this.x, y = this.y;
      ctx.fillStyle = '#1a1a28'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x - 6, y - 34); ctx.lineTo(x + 6, y - 34); ctx.lineTo(x + 9, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2b2b40'; ctx.fillRect(x - 12, y - 4, 24, 4);
      const c = this.active ? '#5ff3ff' : '#ff6070';
      ctx.fillStyle = K.rgba(c, 0.7); ctx.fillRect(x - 1, y - 30, 2, 24);
      const fy = y - 46 + Math.sin(this.t * 2.5) * 3;
      K.FX.glow(ctx, x, fy, this.active ? 40 : 22, c, 0.8);
      ctx.fillStyle = this.active ? '#e8ffff' : '#ffc0c8';
      ctx.beginPath(); ctx.moveTo(x, fy - 8); ctx.lineTo(x + 5, fy); ctx.lineTo(x, fy + 8); ctx.lineTo(x - 5, fy); ctx.closePath(); ctx.fill();
    }
  };

  // ---------- Orbe de energía ----------
  K.Orb = class {
    constructor(x, y, dyn) { this.x = x; this.y = y; this.t = Math.random() * 6; this.taken = false; this.kind = 'orb'; this.vy = dyn ? -200 : 0; this.dyn = dyn; this.life = dyn ? 12 : Infinity; }
    update(dt, g) {
      this.t += dt; this.life -= dt;
      if (this.life <= 0) this.taken = true;
      if (this.dyn) {
        this.vy += 900 * dt; this.y += this.vy * dt;
        if (g.map.solidAt(this.x, this.y + 10) || g.map.isFloor(Math.floor(this.x / TS), Math.floor((this.y + 10) / TS))) { this.y = Math.floor((this.y + 10) / TS) * TS - 12; this.vy = 0; this.dyn = false; }
      }
      const p = g.player;
      if (!this.taken && p.alive && near(p, this.x, this.y, 30)) {
        this.taken = true;
        p.energy = Math.min(p.maxE, p.energy + 30);
        K.Audio.sfx('orb');
        K.FX.text(p.cx, p.y - 10, '+30 ENERGÍA', '#7dffb0', 14);
        K.FX.burst(this.x, this.y, 14, { color: ['#7dffb0', '#ffffff'], speed: [40, 160], life: [0.3, 0.6], size: [1.5, 3], type: 'glow', add: true });
      }
    }
    light() { return this.taken ? null : { x: this.x, y: this.y, r: 80, color: '#7dffb0' }; }
    draw(ctx) {
      if (this.taken) return;
      if (this.life < 3 && Math.floor(this.t * 8) % 2) return;
      const y = this.y + Math.sin(this.t * 3) * 3;
      K.FX.glow(ctx, this.x, y, 26, '#7dffb0', 0.8);
      ctx.fillStyle = '#e8fff0'; ctx.beginPath(); ctx.arc(this.x, y, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(125,255,176,0.8)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(this.x, y, 9 + Math.sin(this.t * 5) * 1.5, 0, Math.PI * 2); ctx.stroke();
    }
  };

  // ---------- Compuerta (se abre deslizando hacia arriba) ----------
  K.Door = class {
    constructor(group, map, closed = true) {
      this.tiles = group.tiles; this.x = group.x; this.y = group.y; this.w = group.w; this.h = group.h;
      this.map = map; this.open = !closed; this.amt = closed ? 0 : 1; this.key = group.key;
      this.timer = 0; this.solid = null; this.kind = 'door';
      this.apply(closed);
    }
    apply(solid) { if (this.solid === solid) return; this.solid = solid; for (const t of this.tiles) this.map.setColl(t.x, t.y, solid ? 1 : 0); }
    setOpen(o) { if (this.open === o) return; this.open = o; K.Audio.sfx('door'); }
    update(dt, g) {
      if (this.timer > 0) {
        this.timer -= dt;
        if (Math.floor(this.timer * 4) !== Math.floor((this.timer + dt) * 4)) K.Audio.sfx('tick');
        if (this.timer <= 0) this.setOpen(false);
      }
      this.amt = K.approach(this.amt, this.open ? 1 : 0, dt * (this.open ? 2.6 : 3.2));
      if (this.amt > 0.75) this.apply(false);
      else if (this.amt < 0.4) {
        // no aplastar al jugador ni a enemigos
        const blockers = [g.player, ...g.enemies.filter(e => !e.dead)];
        if (blockers.some(b => K.overlap(b, this))) { this.amt = 0.45; return; }
        this.apply(true);
      }
    }
    light() { return { x: this.x + this.w / 2, y: this.y + this.h * (1 - this.amt) - 10, r: 70, color: this.open ? '#7dffb0' : '#ff6070', a: 0.6 }; }
    draw(ctx, g) {
      const vh = this.h * (1 - this.amt);
      if (vh <= 1) return;
      const x = this.x + 4, w = this.w - 8, y = this.y;
      const P = g.theme.tile;
      const gr = ctx.createLinearGradient(x, 0, x + w, 0);
      gr.addColorStop(0, K.shade(P.base, 0.1)); gr.addColorStop(0.5, K.shade(P.base, 0.35)); gr.addColorStop(1, K.shade(P.base, -0.2));
      ctx.fillStyle = gr; ctx.fillRect(x, y, w, vh);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, vh);
      for (let yy = y + vh - 16; yy > y; yy -= 32) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, yy, w, 2); }
      const c = this.open ? '#7dffb0' : (this.timer > 0 ? '#ffcf6b' : '#ff4258');
      ctx.fillStyle = c; ctx.fillRect(x + w / 2 - 2, y + 6, 4, vh - 12);
      K.FX.glow(ctx, x + w / 2, y + vh - 10, 24, c, 0.7);
      ctx.fillStyle = '#e8b440';
      for (let k = 0; k < w; k += 8) { ctx.beginPath(); ctx.moveTo(x + k, y + vh); ctx.lineTo(x + k + 4, y + vh - 6); ctx.lineTo(x + k + 8, y + vh); ctx.fill(); }
    }
  };

  // ---------- Palanca ----------
  K.Lever = class {
    constructor(x, y, id, timed) { this.x = x; this.y = y; this.id = id; this.on = false; this.timed = timed || 0; this.t = 0; this.kind = 'lever'; this.doors = []; }
    interactable(g) { return g.abilities.interact && !(this.on && !this.timed) && !(this.timed && this.doors.some(d => d.timer > 0)); }
    prompt() { return 'Activar'; }
    interact(g) {
      this.on = true; this.t = 0;
      K.Audio.sfx('lever');
      K.FX.burst(this.x, this.y - 18, 10, { color: ['#7dffb0', '#ffffff'], speed: [40, 140], life: [0.2, 0.4], size: [1.5, 2.5], type: 'spark', add: true });
      for (const d of this.doors) { d.setOpen(true); if (this.timed) d.timer = this.timed; }
      if (this.timed) g.toast(`¡Compuerta abierta ${this.timed.toFixed(1)} s! Usa el DASH (Shift)`, '#ffcf6b', 1.8);
    }
    update(dt) { this.t += dt; if (this.timed && this.on && !this.doors.some(d => d.timer > 0)) this.on = false; }
    light() { return { x: this.x, y: this.y - 20, r: 60, color: this.on ? '#7dffb0' : '#ffcf6b', a: 0.7 }; }
    draw(ctx) {
      const x = this.x, y = this.y;
      ctx.fillStyle = '#2a2d38'; ctx.fillRect(x - 10, y - 8, 20, 8);
      ctx.fillStyle = '#3a3e4c'; ctx.fillRect(x - 7, y - 12, 14, 5);
      const a = this.on ? 0.7 : -0.7;
      ctx.strokeStyle = '#c0c6d4'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + Math.sin(a) * 18, y - 10 - Math.cos(a) * 18); ctx.stroke();
      const c = this.on ? '#7dffb0' : '#ffcf6b';
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + Math.sin(a) * 18, y - 10 - Math.cos(a) * 18, 4, 0, Math.PI * 2); ctx.fill();
      K.FX.glow(ctx, x + Math.sin(a) * 18, y - 10 - Math.cos(a) * 18, 16, c, 0.8);
      if (this.timed) {
        const d = this.doors[0];
        if (d && d.timer > 0) {
          ctx.strokeStyle = '#ffcf6b'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(x, y - 40, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (d.timer / this.timed)); ctx.stroke();
        }
      }
    }
  };

  // ---------- Muro agrietado ----------
  let bid = 1;
  K.Breakable = class {
    constructor(group, map) {
      this.id = bid++; this.tiles = group.tiles; this.x = group.x; this.y = group.y; this.w = group.w; this.h = group.h; this.map = map; this.broken = false;
      for (const t of this.tiles) map.setColl(t.x, t.y, 1);
      const r = K.seeded(this.id * 97);
      this.cracks = [];
      for (let i = 0; i < 6; i++) { let x = this.x + r() * this.w, y = this.y + r() * this.h; const pts = [[x, y]]; for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 26; y += (r() - 0.5) * 26; pts.push([x, y]); } this.cracks.push(pts); }
    }
    smash(g, dir) {
      this.broken = true;
      for (const t of this.tiles) this.map.setColl(t.x, t.y, 0);
      K.Audio.sfx('break'); K.FX.shake(9, 0.35); K.FX.stop(0.08);
      for (const t of this.tiles) {
        K.FX.burst(t.x * TS + 16, t.y * TS + 16, 6, { color: [g.theme.tile.base, g.theme.tile.top, K.shade(g.theme.tile.base, -0.3)], speed: [80, 360], angle: dir > 0 ? 0 : Math.PI, spread: 2, life: [0.6, 1.2], size: [4, 9], type: 'rect', grav: 900, spin: 8 });
      }
      K.FX.burst(this.x + this.w / 2, this.y + this.h / 2, 14, { color: '#6a5a5a', speed: [30, 120], life: [0.7, 1.3], size: [10, 20], type: 'smoke' });
    }
    light() { return this.broken ? null : { x: this.x + this.w / 2, y: this.y + this.h / 2, r: 60, color: '#ffcf6b', a: 0.4 }; }
    draw(ctx, g) {
      if (this.broken) return;
      const P = g.theme.tile;
      ctx.fillStyle = K.shade(P.base, 0.08); ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
      for (const t of this.tiles) ctx.strokeRect(t.x * TS + 0.5, t.y * TS + 0.5, TS - 1, TS - 1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,190,90,${0.55 + Math.sin(g.time * 3) * 0.2})`; ctx.lineWidth = 1.6;
      for (const c of this.cracks) { ctx.beginPath(); ctx.moveTo(c[0][0], c[0][1]); for (const q of c) ctx.lineTo(q[0], q[1]); ctx.stroke(); }
      ctx.restore();
    }
  };

  // ---------- Salida ----------
  K.Exit = class {
    constructor(x, y) { this.x = x; this.y = y; this.t = 0; this.kind = 'exit'; this.msgT = 0; }
    update(dt, g) {
      this.t += dt; this.msgT -= dt;
      const p = g.player;
      if (p.alive && Math.abs(p.cx - this.x) < 22 && Math.abs(p.cy - (this.y - 30)) < 40) {
        if (g.fragmentTaken) g.completeLevel();
        else if (this.msgT <= 0) { g.toast('Necesitas el fragmento de esta zona', '#ffcf6b', 2); K.Audio.sfx('deny'); this.msgT = 2.5; }
      }
    }
    light(g) { return { x: this.x, y: this.y - 32, r: 140, color: g.fragmentTaken ? '#c48aff' : '#556' }; }
    draw(ctx, g) {
      const on = g.fragmentTaken, x = this.x, y = this.y - 34;
      ctx.fillStyle = '#16131f'; ctx.fillRect(x - 24, y + 30, 48, 6);
      if (on) {
        K.FX.glow(ctx, x, y, 70, '#9b6bff', 0.7);
        ctx.save(); ctx.translate(x, y);
        for (let i = 0; i < 3; i++) {
          ctx.rotate(this.t * (1 + i * 0.5));
          ctx.strokeStyle = ['rgba(196,138,255,0.9)', 'rgba(95,243,255,0.7)', 'rgba(255,255,255,0.6)'][i]; ctx.lineWidth = 2.5 - i * 0.5;
          ctx.beginPath(); ctx.ellipse(0, 0, 16 - i * 3, 30 - i * 5, 0, 0.3, Math.PI * 1.7); ctx.stroke();
        }
        ctx.restore();
        if (Math.random() < 0.3) K.FX.spawn({ x: x + K.rand(-14, 14), y: y + K.rand(-26, 26), vy: -40, life: 0.6, size: 2, color: '#c48aff', type: 'glow', add: true });
      } else {
        ctx.strokeStyle = 'rgba(120,120,150,0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x, y, 16, 30, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.strokeStyle = '#2b2740'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(x, y, 20, 35, 0, 0, Math.PI * 2); ctx.stroke();
    }
  };

  // ---------- Cartel holográfico de ayuda ----------
  K.Hint = class {
    constructor(x, y, text) { this.x = x; this.y = y; this.text = text; this.a = 0; this.kind = 'hint'; }
    update(dt, g) { const d = Math.abs(g.player.cx - this.x); this.a = K.approach(this.a, d < 190 ? 1 : 0, dt * 3); }
    drawPanel(ctx, g) {
      if (this.a <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = this.a;
      ctx.font = K.font(15, 600);
      const lines = this.text.split('\n');
      const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 26, h = lines.length * 19 + 14;
      const v = g.view || { x: -1e9 }, VW = K.W / (g.zoom || 1);
      const x = K.clamp(this.x - w / 2, v.x + 8, v.x + VW - w - 8), y = this.y - 72 - h + (1 - this.a) * 10;
      ctx.fillStyle = 'rgba(8,14,30,0.78)'; ctx.strokeStyle = 'rgba(95,243,255,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 6, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - 6); ctx.lineTo(x + w - 6, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5ff3ff'; ctx.fillRect(x, y + 4, 2, h - 8);
      ctx.fillStyle = '#e8f6ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + 8 + i * 19));
      ctx.strokeStyle = 'rgba(95,243,255,0.35)'; ctx.beginPath(); ctx.moveTo(this.x, y + h); ctx.lineTo(this.x, this.y - 18); ctx.stroke();
      ctx.restore();
    }
    draw(ctx, g) {
      const x = this.x, y = this.y;
      ctx.fillStyle = '#1d2030'; ctx.fillRect(x - 6, y - 16, 12, 16);
      ctx.fillStyle = '#5ff3ff'; ctx.fillRect(x - 4, y - 14, 8, 2);
      K.FX.glow(ctx, x, y - 16, 14, '#5ff3ff', 0.6 + Math.sin(g.time * 4) * 0.2);
    }
    light() { return { x: this.x, y: this.y - 20, r: 60, color: '#5ff3ff', a: 0.5 }; }
  };

  // ---------- Personajes aliados (explorador rebelde, Nyra) ----------
  K.NPC = class {
    constructor(x, y, who, dialog, needE) { this.x = x; this.y = y; this.who = who; this.dialog = dialog; this.needE = needE; this.talked = false; this.t = Math.random() * 5; this.kind = 'npc'; this.facing = -1; }
    interactable(g) { return this.needE && g.abilities.interact && !this.talked; }
    prompt() { return 'Hablar'; }
    interact(g) { this.talked = true; g.startDialog(this.dialog); }
    update(dt, g) {
      this.t += dt;
      const p = g.player;
      this.facing = K.sign(p.cx - this.x);
      if (!this.talked && !this.needE && p.alive && Math.abs(p.cx - this.x) < 90 && Math.abs(p.cy - this.y) < 70) { this.talked = true; g.startDialog(this.dialog); }
    }
    light() { return { x: this.x, y: this.y - 30, r: 120, color: K.Styles[this.who].glow }; }
    draw(ctx, g) {
      const S = K.Styles[this.who];
      const pose = this.who === 'explorer' ? K.Poses.sit(this.t) : (g.state === 'dialog' ? K.Poses.talk(this.t) : K.Poses.idle(this.t));
      if (this.who === 'explorer') { ctx.fillStyle = '#20141c'; ctx.beginPath(); ctx.ellipse(this.x - 14, this.y - 6, 18, 10, 0, 0, Math.PI * 2); ctx.fill(); }
      K.Rig.draw(ctx, this.x, this.y + 1, this.who === 'explorer' ? 1 : this.facing, pose, S, this.t);
      if (!this.talked && !this.needE) {
        ctx.fillStyle = K.rgba(S.glow, 0.6 + Math.sin(this.t * 4) * 0.3);
        ctx.font = K.font(18, 700, 'Orbitron'); ctx.textAlign = 'center'; ctx.fillText('…', this.x, this.y - 66);
      }
    }
  };

  // ---------- Disparador de diálogo / evento ----------
  K.Trigger = class {
    constructor(x, y, def) { this.x = x; this.y = y; this.def = def; this.fired = false; this.kind = 'trigger'; }
    update(dt, g) {
      if (this.fired || !g.player.alive) return;
      if (g.player.cx > this.x && Math.abs(g.player.cy - this.y) < 260) { this.fired = true; g.runTrigger(this.def); }
    }
    draw() {}
  };

  // ---------- Zonas de gravedad extrema ----------
  K.GravZone = class {
    constructor(group) { this.x = group.x; this.y = group.y; this.w = group.w; this.h = group.h; this.code = group.key; this.kind = 'zone'; }
    draw(ctx, g) {
      const st = g.zoneState(this.code); // 'on' | 'off' | 'warn'
      const t = g.time;
      let a = st === 'on' ? 1 : st === 'warn' ? (Math.floor(t * 8) % 2 ? 0.7 : 0.25) : 0.12;
      ctx.save();
      ctx.beginPath(); ctx.rect(this.x, this.y, this.w, this.h); ctx.clip();
      const gr = ctx.createLinearGradient(0, this.y, 0, this.y + this.h);
      gr.addColorStop(0, `rgba(120,60,220,${0.06 * a})`); gr.addColorStop(1, `rgba(170,90,255,${0.32 * a})`);
      ctx.fillStyle = gr; ctx.fillRect(this.x, this.y, this.w, this.h);
      if (st !== 'off') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(200,150,255,${0.35 * a})`; ctx.lineWidth = 2;
        const sp = st === 'on' ? 110 : 30;
        for (let x = this.x + 16; x < this.x + this.w; x += 48) {
          for (let k = 0; k < 3; k++) {
            const yy = this.y + ((t * sp + k * 60 + x * 0.7) % (this.h + 30)) - 15;
            ctx.beginPath(); ctx.moveTo(x - 7, yy - 6); ctx.lineTo(x, yy); ctx.lineTo(x + 7, yy - 6); ctx.stroke();
          }
        }
        ctx.fillStyle = `rgba(210,170,255,${0.5 * a})`; ctx.fillRect(this.x, this.y + this.h - 3, this.w, 3);
      }
      ctx.restore();
      ctx.strokeStyle = `rgba(196,138,255,${0.25 + a * 0.35})`; ctx.setLineDash([6, 6]); ctx.lineWidth = 1;
      ctx.strokeRect(this.x + 0.5, this.y + 0.5, this.w - 1, this.h - 1); ctx.setLineDash([]);
    }
  };
})(window.K);
