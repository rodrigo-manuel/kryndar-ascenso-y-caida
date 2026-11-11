'use strict';
// ============================================================================
//  SOLDADO DEL DOMINIO — IA de patrulla con cono de visión 2D.
//  Estados: patrulla → sospecha → persecución → ataque cuerpo a cuerpo.
//  El cono se recorta contra las paredes (rayos), y si el jugador permanece
//  dentro se llena la barra de sospecha hasta "¡DETECTADO!".
// ============================================================================
(function (K) {
  const TS = K.TS;
  const HALF = 0.46;

  K.Soldier = class extends K.Entity {
    constructor(x, y) {
      super(x, y, 22, 46);
      this.hp = 42; this.maxHp = 42;
      this.state = 'patrol';
      this.facing = Math.random() < 0.5 ? -1 : 1;
      this.sus = 0; this.lostT = 0; this.atkT = 0; this.cool = 0; this.waitT = 0;
      this.t = Math.random() * 10; this.walkPh = 0;
      this.hurtT = 0; this.markT = 0;
      this.dead = false; this.deadT = 0;
      this.spawn = { x, y };
      this.cone = [];
    }
    setupPatrol(map) {
      const ty = Math.floor((this.y + this.h + 2) / TS);
      const tx = Math.floor(this.cx / TS);
      let l = tx, r = tx;
      const blocked = (x) => map.isSolid(x, ty - 1) || !map.isFloor(x, ty);
      for (let i = 0; i < 7; i++) { if (blocked(l - 1)) break; l--; }
      for (let i = 0; i < 7; i++) { if (blocked(r + 1)) break; r++; }
      this.minX = l * TS + 2; this.maxX = (r + 1) * TS - this.w - 2;
    }
    reset() {
      if (this.dead) return;
      this.x = this.spawn.x; this.y = this.spawn.y; this.vx = this.vy = 0;
      this.state = 'patrol'; this.sus = 0; this.lostT = 0; this.hp = this.maxHp;
    }
    get eye() { return { x: this.cx + this.facing * 5, y: this.y + 11 }; }

    canSee(p, g) {
      if (!p.alive) return false;
      const chase = this.state !== 'patrol';
      const range = (g.alertMax ? 300 : 235) * (chase ? 1.25 : 1);
      const half = chase ? 1.1 : HALF;
      const e = this.eye;
      // fuera de los niveles de sigilo (fortaleza en alerta) también te OYEN de cerca
      if (!g.level.stealth && K.dist(this.cx, this.cy, p.cx, p.cy) < 190 && g.map.lineClear(e.x, e.y, p.cx, p.cy)) return true;
      for (const ty of [p.y + 10, p.y + p.h * 0.6]) {
        const dx = p.cx - e.x, dy = ty - e.y;
        const d = Math.hypot(dx, dy);
        if (d > range) continue;
        const a = Math.atan2(dy, dx * this.facing);
        if (Math.abs(a) > half) continue;
        if (g.map.lineClear(e.x, e.y, p.cx, ty)) return true;
      }
      return false;
    }
    becomeAlert(g, silent) {
      const was = this.state;
      this.state = 'chase'; this.sus = 1; this.lostT = 0; this.markT = 1.1;
      if (was === 'patrol' && !silent) g.onDetected(this);
    }

    update(dt, g) {
      this.t += dt;
      if (this.dead) {
        this.deadT += dt;
        this.vy += 1300 * dt; this.vx *= Math.pow(0.9, dt * 60);
        K.moveBody(this, g.map, dt);
        if (this.deadT > 2.2) this.remove = true;
        return;
      }
      const p = g.player, mul = g.alertMax ? 1.35 : 1;
      this.hurtT -= dt; this.cool -= dt; this.markT -= dt;
      this.vy += 1300 * dt;
      const seen = this.canSee(p, g);
      const floorAhead = () => g.map.isFloor(Math.floor((this.cx + this.facing * 16) / TS), Math.floor((this.bottom + 4) / TS));

      switch (this.state) {
        case 'patrol': {
          if (this.waitT > 0) {
            this.vx = 0; this.waitT -= dt;
            if (this.waitT <= 0) this.facing *= -1;
          } else {
            this.vx = this.facing * 68 * mul;
            if ((this.x <= this.minX && this.facing < 0) || (this.x >= this.maxX && this.facing > 0)) { this.vx = 0; this.waitT = 1.3; }
          }
          if (seen) {
            const d = K.dist(this.cx, this.cy, p.cx, p.cy);
            const rate = (g.level.stealth ? 1.9 : 6) * (1 + K.clamp(1 - d / 240, 0, 1) * 1.6) * mul;
            this.sus += dt * rate;
            if (this.sus > 0.35) { this.vx = 0; this.facing = K.sign(p.cx - this.cx); }
          } else this.sus = Math.max(0, this.sus - dt * 0.55);
          if (this.sus >= 1) this.becomeAlert(g);
          break;
        }
        case 'chase': {
          if (seen) { this.lostT = 0; this.lastX = p.cx; } else this.lostT += dt;
          const tx = this.lastX !== undefined ? this.lastX : p.cx;
          const dx = tx - this.cx;
          if (Math.abs(dx) > 8) this.facing = K.sign(dx);
          this.vx = Math.abs(dx) > 30 ? this.facing * 175 * mul : 0;
          if (!floorAhead()) this.vx = 0;
          if (seen && Math.abs(p.cx - this.cx) < 46 && Math.abs(p.cy - this.cy) < 42 && this.cool <= 0) { this.state = 'windup'; this.atkT = 0.36 / mul; }
          if (this.lostT > 3.5) { this.state = 'patrol'; this.sus = 0.4; this.waitT = 0.8; }
          break;
        }
        case 'windup':
          this.vx = 0; this.atkT -= dt;
          if (this.atkT <= 0) { this.state = 'strike'; this.atkT = 0.14; this.hitDone = false; this.vx = this.facing * 150; K.Audio.sfx('whoosh'); }
          break;
        case 'strike': {
          this.atkT -= dt;
          const hb = { x: this.facing > 0 ? this.cx : this.cx - 40, y: this.y + 8, w: 40, h: 28 };
          if (!this.hitDone && K.overlap(hb, p.box)) { this.hitDone = true; p.damage(g.alertMax ? 17 : 12, this.cx, g); }
          if (this.atkT <= 0) { this.state = 'recover'; this.atkT = 0.45; }
          break;
        }
        case 'recover':
          this.vx *= Math.pow(0.8, dt * 60); this.atkT -= dt;
          if (this.atkT <= 0) { this.state = 'chase'; this.cool = 0.55; }
          break;
        case 'stagger':
          this.vx *= Math.pow(0.88, dt * 60); this.atkT -= dt;
          if (this.atkT <= 0) this.state = 'chase';
          break;
      }
      K.moveBody(this, g.map, dt);
      if (this.onGround && Math.abs(this.vx) > 5) this.walkPh += Math.abs(this.vx) * dt * (this.state === 'patrol' ? 0.07 : 0.05);
      if (this.y > g.map.ph + 100) { this.dead = true; this.remove = true; }
      this.buildCone(g);
    }

    buildCone(g) {
      const e = this.eye, chase = this.state !== 'patrol';
      const range = (g.alertMax ? 300 : 235) * (chase ? 1.25 : 1);
      const half = chase ? 0.75 : HALF;
      const base = this.facing > 0 ? 0 : Math.PI;
      const N = 14;
      this.cone.length = 0;
      for (let i = 0; i <= N; i++) {
        const a = base - half + (2 * half * i) / N;
        const d = g.map.rayLen(e.x, e.y, a, range);
        this.cone.push(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d);
      }
      this.coneRange = range;
    }

    takeHit(dmg, dir, info, g) {
      if (this.dead) return false;
      const p = g.player;
      const behind = K.sign(p.cx - this.cx) !== this.facing;
      const unaware = this.state === 'patrol';
      if (info.charged && behind && unaware) {
        dmg = 999;
        K.FX.text(this.cx, this.y - 14, 'NEUTRALIZADO', '#5ff3ff', 15);
      }
      this.hp -= dmg;
      this.hurtT = 0.22;
      this.vx = dir * (info.charged ? 420 : 170); this.vy = info.charged ? -280 : -120;
      if (this.hp <= 0) { this.die(g, dir, !(info.charged && behind && unaware)); return true; }
      K.FX.text(this.cx, this.y - 8, String(dmg), '#ffffff', 14);
      this.state = 'stagger'; this.atkT = info.charged ? 0.65 : 0.28;
      if (unaware) { this.facing = -dir; this.becomeAlert(g); this.state = 'stagger'; }
      return true;
    }
    die(g, dir, loud) {
      this.dead = true; this.deadT = 0; this.vy = -240; this.vx = dir * 220;
      K.Audio.sfx('enemyDie');
      K.FX.burst(this.cx, this.cy, 18, { color: ['#ff3b3b', '#a3acb7', '#ffffff'], speed: [80, 300], life: [0.3, 0.7], size: [1.5, 3], type: 'spark', add: true });
      K.FX.burst(this.cx, this.cy, 6, { color: '#3a3f48', speed: [40, 120], life: [0.5, 0.9], size: [6, 12], type: 'smoke' });
      if (Math.random() < 0.45) g.spawnOrb(this.cx, this.y + 10);
    }

    drawCone(ctx, g) {
      if (this.dead || this.cone.length < 4) return;
      const e = this.eye;
      let col;
      if (this.state !== 'patrol') col = '255,60,70';
      else col = this.sus > 0.05 ? (this.sus > 0.5 ? '255,140,60' : '255,200,90') : '255,236,150';
      const a = this.state !== 'patrol' ? 0.3 : 0.22 + this.sus * 0.18;
      const gr = ctx.createRadialGradient(e.x, e.y, 4, e.x, e.y, this.coneRange);
      gr.addColorStop(0, `rgba(${col},${a + 0.12})`); gr.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(e.x, e.y);
      for (let i = 0; i < this.cone.length; i += 2) ctx.lineTo(this.cone[i], this.cone[i + 1]);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = `rgba(${col},${a * 0.9})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(this.cone[0], this.cone[1]);
      ctx.moveTo(e.x, e.y); ctx.lineTo(this.cone[this.cone.length - 2], this.cone[this.cone.length - 1]); ctx.stroke();
    }

    draw(ctx, g) {
      const S = K.Styles.soldier;
      let pose;
      if (this.dead) {
        ctx.save();
        ctx.globalAlpha = K.clamp(2.2 - this.deadT, 0, 1);
        ctx.translate(this.cx, this.bottom);
        ctx.rotate(-this.facing * K.clamp(this.deadT * 4, 0, 1) * Math.PI / 2);
        K.Rig.draw(ctx, 0, 0, this.facing, K.Poses.hurt(), S, this.t);
        ctx.restore();
        return;
      }
      switch (this.state) {
        case 'patrol': pose = this.waitT > 0 || Math.abs(this.vx) < 5 ? K.Poses.idle(this.t) : K.Poses.walk(this.walkPh); break;
        case 'chase': pose = Math.abs(this.vx) > 5 ? K.Poses.run(this.walkPh) : K.Poses.guard(this.t); break;
        case 'windup': pose = K.Poses.windup(); break;
        case 'strike': pose = K.Poses.punch(0.35, false); break;
        case 'recover': pose = K.Poses.punch(0.75, false); break;
        default: pose = K.Poses.hurt();
      }
      this.pose = this.pose ? K.Rig.blend(this.pose, pose, 0.4) : pose;
      const st = this.hurtT > 0.1 ? K.Rig.variant(S, '#ffffff') : S;
      K.Rig.draw(ctx, this.cx, this.bottom + 1, this.facing, this.pose, st, this.t);
      if (this.state === 'windup') K.FX.glow(ctx, this.cx + this.facing * 4, this.y + 10, 20, '#ff3b3b', 0.9);
      // indicador de sospecha / alerta
      const mx = this.cx, my = this.y - 16;
      if (this.markT > 0) {
        ctx.font = K.font(22, 700, 'Orbitron'); ctx.textAlign = 'center';
        ctx.fillStyle = '#ff4258'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
        const s = 1 + Math.max(0, this.markT - 0.9) * 3;
        ctx.save(); ctx.translate(mx, my); ctx.scale(s, s); ctx.strokeText('!', 0, 0); ctx.fillText('!', 0, 0); ctx.restore();
      } else if (this.state === 'patrol' && this.sus > 0.04) {
        ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = this.sus > 0.6 ? '#ff8a3c' : '#ffd36a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(mx, my, 8, -Math.PI / 2, -Math.PI / 2 + this.sus * Math.PI * 2); ctx.stroke();
        ctx.font = K.font(12, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffe9b0'; ctx.fillText('?', mx, my + 1);
        ctx.textBaseline = 'alphabetic';
      }
    }
  };
})(window.K);
