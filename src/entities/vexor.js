'use strict';
// ============================================================================
//  GENERAL VEXOR — jefe final.
//  · Vuela y EMBISTE horizontalmente (esquivar con Dash o volando).
//  · GRITO DE FRECUENCIA: onda sónica que cruza la pantalla. Se esquiva con
//    Dash o se CONTRARRESTA pulsando Q (Grito de Resistencia) en el momento justo.
//  · Su armadura resiste en el aire. Su punto débil es la GRAVEDAD EXTREMA:
//    si entra en una zona activa cae al suelo y queda vulnerable.
// ============================================================================
(function (K) {
  // ---------- Onda sónica de Vexor ----------
  K.SonicWave = class {
    constructor(x, y) { this.x = x; this.y = y; this.r = 24; this.speed = 400; this.max = 1100; this.dead = false; this.hit = false; this.t = 0; }
    update(dt, g) {
      this.t += dt; this.r += this.speed * dt;
      if (this.r > this.max) this.dead = true;
      const p = g.player;
      if (!p.alive || this.hit) return;
      const d = K.dist(this.x, this.y, p.cx, p.cy);
      // contraataque: el Grito de Resistencia de Kriss alcanza el frente de la onda
      if (p.resistT > 0 && d - this.r < p.resistR + 40 && d - this.r > -30) {
        this.hit = true; this.dead = true;
        g.onCounter(this);
        return;
      }
      if (Math.abs(d - this.r) < 22) {
        this.hit = true;
        if (p.dashT > 0 || p.invT > 0.3) { K.FX.text(p.cx, p.y - 10, 'ESQUIVADO', '#5ff3ff', 15); return; }
        p.damage(26, this.x, g, 1.5);
      }
    }
    draw(ctx) {
      const k = 1 - this.r / this.max;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const rr = this.r - i * 14;
        if (rr <= 0) continue;
        ctx.strokeStyle = i === 0 ? `rgba(255,90,140,${0.85 * k})` : `rgba(255,40,80,${0.4 * k / i})`;
        ctx.lineWidth = i === 0 ? 9 : 4;
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.12) {
          const w = Math.sin(a * 12 + this.t * 40) * 4;
          ctx.lineTo(this.x + Math.cos(a) * (rr + w), this.y + Math.sin(a) * (rr + w));
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  };
  // ---------- Onda de choque en el suelo (golpe en picada) ----------
  K.GroundWave = class {
    constructor(x, y, dir) { this.x = x; this.y = y; this.dir = dir; this.life = 1.5; this.dead = false; this.hit = false; }
    update(dt, g) {
      this.x += this.dir * 470 * dt; this.life -= dt;
      if (this.life <= 0 || g.map.solidAt(this.x + this.dir * 12, this.y - 10)) this.dead = true;
      if (Math.random() < dt * 60) K.FX.spawn({ x: this.x, y: this.y - 4, vx: -this.dir * 40, vy: -K.rand(60, 180), life: 0.4, size: K.rand(1.5, 3), color: K.pick(['#ff5a8a', '#ffb0c8']), type: 'spark', add: true });
      const p = g.player;
      if (!this.hit && p.alive && K.overlap({ x: this.x - 14, y: this.y - 30, w: 28, h: 30 }, p.box)) {
        this.hit = true;
        if (p.dashT <= 0) p.damage(18, this.x - this.dir * 20, g);
      }
    }
    draw(ctx) {
      const a = K.clamp(this.life, 0, 1);
      K.FX.glow(ctx, this.x, this.y - 10, 30, '#ff3a7a', a);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,120,170,${a})`;
      ctx.beginPath(); ctx.moveTo(this.x - this.dir * 16, this.y); ctx.lineTo(this.x + this.dir * 6, this.y - 28); ctx.lineTo(this.x + this.dir * 14, this.y); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  };

  K.Vexor = class extends K.Entity {
    constructor(x, y) {
      super(x, y, 30, 64);
      this.maxHp = 600; this.hp = this.maxHp;
      this.state = 'intro'; this.stT = 0; this.facing = -1; this.t = 0;
      this.nextT = 1.6; this.immuneT = 0; this.hurtT = 0; this.lastAtk = null; this.phase = 1;
      this.cape = new K.Cape(8, 7.4, 6, 12);
      this.dead = false; this.name = 'GENERAL VEXOR';
      this.side = 1;
    }
    hurtbox() { return { x: this.x - 4, y: this.y, w: this.w + 8, h: this.h }; }
    get vulnerable() { return this.state === 'stunned' || this.state === 'falling' || this.state === 'slamRecover'; }
    set(s, t) { this.state = s; this.stT = t || 0; }

    update(dt, g) {
      this.t += dt; this.hurtT -= dt; this.immuneT -= dt; this.stT -= dt;
      const p = g.player, map = g.map;
      const groundY = g.bossGround;
      const dx = p.cx - this.cx;
      const flyTo = (tx, ty, k) => {
        this.vx = K.lerp(this.vx, (tx - this.cx) * k, Math.min(1, dt * 4));
        this.vy = K.lerp(this.vy, (ty - this.cy) * k, Math.min(1, dt * 4));
      };
      switch (this.state) {
        case 'intro': this.vx = 0; this.vy = Math.sin(this.t * 2) * 10; break;
        case 'hover': {
          this.facing = K.sign(dx);
          if (Math.abs(dx) < 60) this.side = -K.sign(dx || 1);
          const tx = p.cx + this.side * (this.phase === 2 ? 120 : 170);
          flyTo(K.clamp(tx, 60, map.pw - 60), groundY - 150 + Math.sin(this.t * 2.2) * 14, 2.4);
          this.nextT -= dt;
          if (this.nextT <= 0) this.chooseAttack(g);
          break;
        }
        case 'ramWind': {
          this.facing = K.sign(dx);
          flyTo(this.cx, this.ramY, 4);
          this.vx *= 0.8;
          if (this.stT <= 0) { this.set('ram', 2.2); this.hitDone = false; K.Audio.sfx('dash'); K.FX.shake(4, 0.2); }
          break;
        }
        case 'ram': {
          this.vx = this.facing * 880; this.vy = (this.ramY - this.cy) * 3;
          if (!this.hitDone && K.overlap(this.hurtbox(), p.box)) {
            if (p.dashT > 0) { this.hitDone = true; K.FX.text(p.cx, p.y - 10, 'ESQUIVADO', '#5ff3ff', 15); }
            else this.hitDone = p.damage(22, this.cx - this.facing * 30, g, 1.5) || this.hitDone;
          }
          if (Math.random() < dt * 60) K.FX.spawn({ x: this.cx - this.facing * 20, y: this.cy + K.rand(-16, 16), vx: -this.facing * 200, life: 0.3, size: K.rand(4, 8), color: '#ff2a3a', type: 'glow', add: true });
          if ((this.facing > 0 && this.cx > map.pw - 70) || (this.facing < 0 && this.cx < 70) || this.stT <= 0) {
            this.vx = -this.facing * 120; this.set('hover'); this.nextT = K.rand(1.0, 1.6); this.side = -this.side;
          }
          break;
        }
        case 'shoutWind': {
          this.vx *= 0.9; this.vy *= 0.9; this.facing = K.sign(dx);
          if (Math.random() < dt * 40) {
            const a = Math.random() * 6.28;
            K.FX.spawn({ x: this.cx + Math.cos(a) * 90, y: this.cy + Math.sin(a) * 90, vx: -Math.cos(a) * 260, vy: -Math.sin(a) * 260, life: 0.34, size: 2, color: '#ff5a8a', type: 'spark', add: true });
          }
          if (this.stT <= 0) {
            g.waves.push(new K.SonicWave(this.cx, this.cy));
            K.Audio.sfx('sonic'); K.FX.shake(6, 0.4); K.FX.flash('#ff2a6a', 0.15);
            this.set('shoutRecover', 0.7);
          }
          break;
        }
        case 'shoutRecover': this.vx *= 0.9; this.vy *= 0.9; if (this.stT <= 0) { this.set('hover'); this.nextT = K.rand(0.8, 1.4); } break;
        case 'slamUp': {
          flyTo(p.cx, groundY - 330, 3.5);
          if (this.stT <= 0) { this.set('slamDown', 2); this.vx = 0; this.vy = 200; K.Audio.sfx('whoosh'); }
          break;
        }
        case 'slamDown': {
          this.vx = 0; this.vy = Math.min(this.vy + 4200 * dt, 1300);
          if (!this.hitDone && K.overlap(this.hurtbox(), p.box)) this.hitDone = p.damage(24, this.cx, g, 1.2) || this.hitDone;
          break;
        }
        case 'slamRecover': this.vx *= 0.85; if (this.stT <= 0) { this.set('rise', 0.7); this.immuneT = 2.2; } break;
        case 'falling': {
          this.vx *= Math.pow(0.92, dt * 60);
          this.vy = Math.min(this.vy + 2900 * dt, 1300);
          break;
        }
        case 'stunned': {
          this.vx *= 0.85;
          if (Math.random() < dt * 14) K.FX.spawn({ x: this.cx + K.rand(-14, 14), y: this.y + K.rand(0, 30), vy: -K.rand(30, 90), life: 0.5, size: 1.6, color: '#c48aff', type: 'spark', add: true });
          if (this.stT <= 0) { this.set('rise', 0.8); this.immuneT = 2.6; K.Audio.sfx('whoosh'); }
          break;
        }
        case 'rise': flyTo(this.cx, groundY - 170, 3); if (this.stT <= 0) { this.set('hover'); this.nextT = 0.8; } break;
        case 'defeated': this.vx *= 0.9; this.vy += 1500 * dt; break;
      }
      // punto débil: zonas de gravedad extrema
      if (['hover', 'ramWind', 'ram', 'shoutWind', 'slamUp', 'rise', 'shoutRecover'].includes(this.state) && this.immuneT <= 0 && g.gravityActiveAt(this.cx, this.cy)) {
        this.set('falling'); this.vy = 200;
        K.FX.text(this.cx, this.y - 16, '¡LA GRAVEDAD LO ARRASTRA!', '#c48aff', 16);
        K.Audio.sfx('door');
      }
      const wasGround = this.onGround;
      K.moveBody(this, map, dt);
      if (this.onGround && (this.state === 'falling' || this.state === 'slamDown')) {
        K.Audio.sfx('boom'); K.FX.shake(12, 0.5);
        K.FX.burst(this.cx, this.bottom, 30, { color: ['#c48aff', '#ff5a8a', '#ffffff'], speed: [100, 400], angle: -Math.PI / 2, spread: 3, life: [0.3, 0.8], size: [1.5, 3], type: 'spark', add: true });
        K.FX.burst(this.cx, this.bottom, 10, { color: '#3a2a4a', speed: [40, 160], angle: -Math.PI / 2, spread: 3, life: [0.6, 1], size: [10, 18], type: 'smoke' });
        if (this.state === 'falling') {
          this.set('stunned', 3.0);
          K.FX.text(this.cx, this.y - 16, '¡VULNERABLE!', '#5ff3ff', 20);
          if (!g.vexHintStun) { g.toast('¡Está en el suelo! ¡Golpéalo ahora!', '#5ff3ff', 2.2); g.vexHintStun = true; }
        } else {
          g.gwaves.push(new K.GroundWave(this.cx, this.bottom, 1), new K.GroundWave(this.cx, this.bottom, -1));
          this.set('slamRecover', 0.9);
        }
      }
      if (this.state === 'defeated' && this.onGround) this.vx = 0;
      this.cape.update(this.cx - this.facing * 4, this.y + 10, dt, this.facing, -this.vx * 0.4 + Math.sin(this.t * 3) * 40, this.t);
    }

    chooseAttack(g) {
      const opts = ['ram', 'ram', 'shout', 'shout'];
      if (this.phase === 2) opts.push('slam', 'slam');
      let a = K.pick(opts);
      if (a === this.lastAtk && Math.random() < 0.6) a = K.pick(opts);
      this.lastAtk = a;
      const p = g.player;
      if (a === 'ram') { this.ramY = K.clamp(p.cy, g.bossGround - 170, g.bossGround - 34); this.set('ramWind', 0.8); K.Audio.sfx('shoutCharge'); }
      else if (a === 'shout') {
        this.set('shoutWind', 1.15); K.Audio.sfx('shoutCharge');
        if (!g.vexHintQ || g.time - g.vexHintQ > 12) { g.toast('¡Grito de Frecuencia! Pulsa Q cuando la onda se acerque (o esquiva con DASH)', '#ff8aa8', 2.6); g.vexHintQ = g.time; }
      } else { this.set('slamUp', 0.9); this.hitDone = false; }
    }
    countered(g) {
      this.set('falling'); this.vy = 150; this.vx = -this.facing * 160;
      this.hurtT = 0.2;
    }

    takeHit(dmg, dir, info, g) {
      if (this.state === 'intro' || this.state === 'defeated') return false;
      const vul = this.vulnerable;
      const mult = vul ? 1 : 0.3;
      const d = Math.max(1, Math.round(dmg * mult));
      this.hp -= d; this.hurtT = 0.1;
      K.FX.text(this.cx, this.y - 6, String(d), vul ? '#5ff3ff' : '#9aa0b0', vul ? 18 : 12);
      if (!vul) {
        K.Audio.sfx('block');
        if (!g.vexHintArmor || g.time - g.vexHintArmor > 10) { g.toast('Su armadura resiste en el aire: atráelo a la GRAVEDAD o contraataca con Q', '#c48aff', 2.8); g.vexHintArmor = g.time; }
      } else this.vx = dir * 80;
      if (this.hp <= this.maxHp * 0.5 && this.phase === 1) {
        this.phase = 2;
        K.FX.text(this.cx, this.y - 24, '¡VEXOR SE ENFURECE!', '#ff4258', 18);
        K.FX.flash('#ff2040', 0.3); K.Audio.sfx('alarm');
      }
      if (this.hp <= 0) {
        this.hp = 0; this.set('defeated');
        K.Audio.sfx('boom'); K.FX.shake(14, 0.8); K.FX.slow(0.25, 1.2); K.FX.flash('#ffffff', 0.6);
        K.FX.burst(this.cx, this.cy, 50, { color: ['#ff2a3a', '#ffffff', '#c48aff'], speed: [80, 460], life: [0.5, 1.2], size: [2, 4], type: 'spark', add: true });
        g.onVexorDefeated(this);
      }
      return true;
    }

    draw(ctx, g) {
      const S = K.Styles.vexor;
      let pose;
      switch (this.state) {
        case 'intro': case 'hover': case 'rise': case 'shoutRecover': pose = K.Poses.hover(this.t); break;
        case 'ramWind': pose = K.Poses.windup(); pose.ground = false; break;
        case 'ram': pose = K.Poses.ram(); break;
        case 'shoutWind': pose = K.Poses.gather(this.t); break;
        case 'slamUp': pose = K.Poses.air(-1); break;
        case 'slamDown': pose = K.Poses.air(1); pose.shR = 2.9; pose.shL = 2.7; break;
        case 'falling': pose = K.Poses.hurt(); pose.ground = false; break;
        case 'slamRecover': pose = K.Poses.stunned(this.t); pose.lean = 0.7; break;
        case 'stunned': case 'defeated': pose = K.Poses.stunned(this.t); break;
        default: pose = K.Poses.hover(this.t);
      }
      this.pose = this.pose ? K.Rig.blend(this.pose, pose, 0.3) : pose;
      // telegrafía de la embestida
      if (this.state === 'ramWind') {
        const k = 1 - this.stT / 0.8;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,40,60,${0.12 + k * 0.25})`;
        const x0 = this.facing > 0 ? this.cx : 0, x1 = this.facing > 0 ? g.map.pw : this.cx;
        ctx.fillRect(x0, this.ramY - 26, x1 - x0, 52);
        ctx.fillStyle = `rgba(255,120,140,${0.3 + k * 0.5})`; ctx.fillRect(x0, this.ramY - 1, x1 - x0, 2);
        ctx.restore();
      }
      if (this.state === 'shoutWind') {
        const k = 1 - this.stT / 1.15;
        K.FX.glow(ctx, this.cx, this.cy, 40 + k * 90, '#ff2a6a', 0.4 + k * 0.4);
        ctx.strokeStyle = `rgba(255,120,170,${k})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.cx, this.cy, 110 * (1 - k) + 20, 0, Math.PI * 2); ctx.stroke();
      }
      K.FX.glow(ctx, this.cx, this.cy, 90, '#ff2a3a', this.vulnerable ? 0.18 : 0.38);
      K.FX.glow(ctx, this.cx, this.y + 14, 40, '#ffb0b8', 0.22);
      const st = this.hurtT > 0 ? K.Rig.variant(S, '#ffffff') : S;
      this.cape.draw(ctx, st.cape[0], st.cape[1], st.flat);
      K.Rig.draw(ctx, this.cx, this.bottom + 1, this.facing, this.pose, st, this.t);
      // aura de armadura (resistencia en el aire)
      if (!this.vulnerable && this.state !== 'defeated' && this.state !== 'intro') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,60,80,${0.22 + Math.sin(this.t * 6) * 0.08})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(this.cx, this.cy, 30, 46, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      if (this.state === 'stunned') {
        for (let i = 0; i < 3; i++) {
          const a = this.t * 5 + i * 2.1;
          ctx.fillStyle = '#c48aff'; ctx.beginPath(); ctx.arc(this.cx + Math.cos(a) * 18, this.y - 12 + Math.sin(a) * 5, 2.6, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  };
})(window.K);
