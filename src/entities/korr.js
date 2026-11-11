'use strict';
// ============================================================================
//  TENIENTE KORR — minijefe de la Fortaleza.
//  Patrón: se acerca, se protege con un ESCUDO frontal (bloquea golpes básicos;
//  el golpe cargado o golpear por la espalda lo rompen), combo de 3 golpes y
//  EMBESTIDA telegrafiada: si choca contra un muro queda aturdido.
// ============================================================================
(function (K) {
  K.Korr = class extends K.Entity {
    constructor(x, y) {
      super(x, y, 34, 64);
      this.maxHp = 360; this.hp = this.maxHp;
      this.state = 'wait'; this.facing = -1;
      this.t = 0; this.stT = 0; this.decT = 1.0; this.combo = 0; this.walkPh = 0;
      this.guard = false; this.hurtT = 0; this.dead = false; this.deadT = 0;
      this.name = 'TENIENTE KORR';
    }
    hurtbox() { return { x: this.x - 2, y: this.y, w: this.w + 4, h: this.h }; }
    set(state, t) { this.state = state; this.stT = t || 0; }

    update(dt, g) {
      this.t += dt; this.hurtT -= dt;
      const p = g.player;
      this.vy += 1500 * dt;
      if (this.dead) {
        this.deadT += dt; this.vx *= 0.9;
        K.moveBody(this, g.map, dt);
        if (Math.random() < dt * 20) K.FX.spawn({ x: this.cx + K.rand(-14, 14), y: this.cy + K.rand(-20, 20), vy: -60, life: 0.8, size: K.rand(8, 14), color: '#2a2420', type: 'smoke' });
        return;
      }
      if (this.state === 'wait') { this.vx = 0; K.moveBody(this, g.map, dt); return; }
      const dx = p.cx - this.cx, adx = Math.abs(dx);
      this.stT -= dt;
      switch (this.state) {
        case 'approach': {
          this.guard = false;
          this.facing = K.sign(dx);
          this.vx = adx > 80 ? this.facing * 115 : 0;
          this.decT -= dt;
          if (this.decT <= 0) {
            const r = Math.random();
            if (adx > 230) this.set('chargeWind', 0.75);
            else if (adx < 110 && r < 0.5) { this.combo = 0; this.set('wind', 0.42); }
            else if (r < 0.8) { this.set('guard', K.rand(1.4, 2.2)); }
            else this.set('chargeWind', 0.75);
            if (this.state === 'chargeWind') K.Audio.sfx('shoutCharge');
          }
          break;
        }
        case 'guard':
          this.guard = true; this.facing = K.sign(dx);
          this.vx = adx > 60 ? this.facing * 45 : 0;
          if (adx < 64 && this.stT < 0.9) { this.guard = false; this.combo = 0; this.set('wind', 0.3); }
          else if (this.stT <= 0) { this.guard = false; this.set('approach'); this.decT = 0.4; }
          break;
        case 'wind':
          this.vx = 0; this.guard = false;
          if (this.stT <= 0) { this.set('swing', 0.14); this.hitDone = false; this.vx = this.facing * 230; K.Audio.sfx('whoosh'); }
          break;
        case 'swing': {
          const hb = { x: this.facing > 0 ? this.cx : this.cx - 58, y: this.y + 10, w: 58, h: 36 };
          if (!this.hitDone && K.overlap(hb, p.box)) { this.hitDone = true; p.damage(15, this.cx, g); }
          this.vx *= 0.9;
          if (this.stT <= 0) {
            this.combo++;
            if (this.combo < 3) { this.facing = K.sign(dx); this.set('wind', 0.24); }
            else this.set('recover', 0.85);
          }
          break;
        }
        case 'chargeWind':
          this.vx = 0; this.facing = K.sign(dx);
          if (Math.random() < dt * 40) K.FX.spawn({ x: this.cx - this.facing * 16, y: this.bottom - 2, vx: -this.facing * K.rand(40, 120), vy: -K.rand(10, 50), life: 0.4, size: K.rand(4, 8), color: '#8a7060', type: 'smoke' });
          if (this.stT <= 0) { this.set('charge', 1.4); this.hitDone = false; this.startX = this.x; K.Audio.sfx('dash'); }
          break;
        case 'charge': {
          this.vx = this.facing * 560;
          if (!this.hitDone && K.overlap(this.hurtbox(), p.box)) { this.hitDone = p.damage(24, this.cx, g, 1.4) || this.hitDone; }
          if (Math.random() < dt * 50) K.FX.spawn({ x: this.cx - this.facing * 18, y: this.bottom - 4, vx: -this.facing * 60, vy: -20, life: 0.4, size: K.rand(5, 9), color: '#7a6050', type: 'smoke' });
          if (this.hitWall) {
            this.set('stunned', 1.9); this.vx = -this.facing * 120;
            K.Audio.sfx('boom'); K.FX.shake(10, 0.4);
            K.FX.burst(this.cx + this.facing * 18, this.cy, 24, { color: ['#ffcf6b', '#ffffff', '#ff8a2a'], speed: [80, 320], life: [0.3, 0.7], size: [1.5, 3], type: 'spark', add: true });
            K.FX.text(this.cx, this.y - 14, '¡ATURDIDO!', '#ffcf6b', 18);
          } else if (Math.abs(this.x - this.startX) > 560 || this.stT <= 0) this.set('recover', 0.6);
          break;
        }
        case 'stunned':
          this.vx *= 0.9;
          if (this.stT <= 0) { this.set('approach'); this.decT = 0.5; }
          break;
        case 'stagger':
          this.vx *= 0.9;
          if (this.stT <= 0) { this.set('approach'); this.decT = 0.3; }
          break;
        case 'recover':
          this.vx *= 0.85;
          if (this.stT <= 0) { this.set('approach'); this.decT = K.rand(0.4, 1.0); }
          break;
      }
      K.moveBody(this, g.map, dt);
      if (Math.abs(this.vx) > 5 && this.onGround) this.walkPh += Math.abs(this.vx) * dt * 0.045;
    }

    takeHit(dmg, dir, info, g) {
      if (this.dead || this.state === 'wait') return false;
      const p = g.player;
      const behind = K.sign(p.cx - this.cx) !== this.facing;
      if (this.guard && !behind) {
        if (!info.charged) {
          K.Audio.sfx('block');
          K.FX.burst(this.cx + this.facing * 22, this.y + 26, 12, { color: ['#ffcf6b', '#ffffff'], speed: [100, 260], life: [0.15, 0.3], size: [1.5, 2.5], type: 'spark', add: true });
          K.FX.text(this.cx, this.y - 10, 'BLOQUEO', '#ffcf6b', 14);
          p.vx = -dir * 220;
          if (!g.korrHintT || g.time - g.korrHintT > 4) { g.toast('¡Su escudo bloquea! Golpe CARGADO o atácalo por la espalda con DASH', '#ffcf6b', 2.6); g.korrHintT = g.time; }
          return 'blocked';
        }
        this.guard = false; this.set('stagger', 1.15);
        K.Audio.sfx('break'); K.FX.shake(8, 0.3);
        K.FX.text(this.cx, this.y - 14, '¡GUARDIA ROTA!', '#5ff3ff', 18);
        K.FX.burst(this.cx + this.facing * 22, this.y + 26, 26, { color: ['#ffcf6b', '#ff8a2a', '#ffffff'], speed: [120, 380], life: [0.3, 0.6], size: [2, 4], type: 'shard', spin: 10 });
      }
      const mult = (this.state === 'stunned' || this.state === 'stagger') ? 1.5 : 1;
      const d = Math.round(dmg * mult);
      this.hp -= d; this.hurtT = 0.12;
      K.FX.text(this.cx, this.y - 6, String(d), mult > 1 ? '#5ff3ff' : '#ffffff', mult > 1 ? 18 : 14);
      if (this.state !== 'charge' && this.state !== 'swing') this.vx = dir * (info.charged ? 200 : 60);
      if (this.hp <= 0) {
        this.hp = 0; this.dead = true; this.deadT = 0;
        K.Audio.sfx('boom'); K.FX.shake(12, 0.6); K.FX.slow(0.3, 0.8); K.FX.flash('#ffffff', 0.4);
        K.FX.burst(this.cx, this.cy, 40, { color: ['#ff8a2a', '#ffcf6b', '#ffffff'], speed: [80, 420], life: [0.4, 1.1], size: [2, 4], type: 'spark', add: true });
        g.onKorrDefeated(this);
      }
      return true;
    }

    draw(ctx, g) {
      const S = K.Styles.korr;
      let pose;
      if (this.dead) pose = K.Poses.stunned(this.t);
      else switch (this.state) {
        case 'wait': pose = K.Poses.guard(this.t); break;
        case 'approach': pose = Math.abs(this.vx) > 5 ? K.Poses.walk(this.walkPh) : K.Poses.guard(this.t); break;
        case 'guard': pose = K.Poses.guard(this.t); pose.shL = 1.5; pose.elL = 0.5; break;
        case 'wind': pose = K.Poses.windup(); break;
        case 'swing': pose = K.Poses.punch(0.35, this.combo % 2 === 1); break;
        case 'chargeWind': pose = K.Poses.charge(this.t); pose.lean = 0.35; break;
        case 'charge': pose = K.Poses.run(this.t * 16); pose.lean = 0.55; pose.shR = 1.4; pose.elR = 0.3; break;
        case 'stunned': case 'stagger': pose = K.Poses.stunned(this.t); break;
        default: pose = K.Poses.guard(this.t);
      }
      this.pose = this.pose ? K.Rig.blend(this.pose, pose, 0.35) : pose;
      if (this.state === 'chargeWind') K.FX.glow(ctx, this.cx, this.cy, 60 + Math.sin(this.t * 30) * 8, '#ff5a2a', 0.5);
      const st = this.hurtT > 0 ? K.Rig.variant(S, '#ffffff') : S;
      ctx.save();
      if (this.dead) ctx.globalAlpha = K.clamp(1.8 - this.deadT * 0.6, 0.35, 1);
      K.Rig.draw(ctx, this.cx, this.bottom + 1, this.facing, this.pose, st, this.t);
      ctx.restore();
      // escudo de energía
      if (this.guard && !this.dead) {
        const sx = this.cx + this.facing * 26, sy = this.y + 30;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const a = 0.55 + Math.sin(this.t * 12) * 0.1;
        ctx.strokeStyle = `rgba(255,170,70,${a})`; ctx.lineWidth = 3;
        ctx.fillStyle = `rgba(255,140,40,${a * 0.25})`;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const an = i * Math.PI / 3 + Math.PI / 6; ctx.lineTo(sx + Math.cos(an) * 12, sy + Math.sin(an) * 28); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
        K.FX.glow(ctx, sx, sy, 40, '#ff8a2a', 0.35);
      }
      if (this.state === 'stunned' && !this.dead) {
        for (let i = 0; i < 3; i++) {
          const a = this.t * 5 + i * 2.1;
          ctx.fillStyle = '#ffcf6b';
          ctx.beginPath(); ctx.arc(this.cx + Math.cos(a) * 16, this.y - 10 + Math.sin(a) * 5, 2.5, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  };
})(window.K);
