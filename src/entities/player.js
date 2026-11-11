'use strict';
// ============================================================================
//  KRISS — protagonista. Movimiento, salto, VUELO (gasta energía), golpe básico,
//  golpe cargado, dash con invulnerabilidad, interacción y Grito de Resistencia.
//  La barra de ENERGÍA es salud y combustible de vuelo a la vez.
// ============================================================================
(function (K) {
  const GRAV = 1350, GRAV_HEAVY = 2450;
  const CHARGE_TIME = 0.45;

  K.Player = class extends K.Entity {
    constructor(x, y) {
      super(x, y, 20, 46);
      this.maxE = 100; this.energy = 100;
      this.alive = true; this.deadT = 0;
      this.invT = 0; this.hurtT = 0; this.sinceHurt = 9;
      this.dashT = 0; this.dashCD = 0;
      this.atkT = 0; this.atkDur = 0; this.atkType = null; this.atkHit = new Set(); this.combo = 0;
      this.charging = false; this.chargeT = 0; this.chargeReady = false;
      this.flying = false; this.flyHoldT = 0; this.flyAmt = 0;
      this.runPh = 0; this.t = 0; this.stepT = 0;
      this.coyote = 0; this.jumpBuf = 0; this.dropT = 0;
      this.resistT = 0; this.resistCD = 0; this.resistR = 0;
      this.cape = new K.Cape(7, 6.2, 4.5, 9.5);
      this.ghosts = []; this.ghostT = 0;
      this.control = true;
      this.landSquash = 0;
      this.lowWarnT = 0;
    }
    get box() { return { x: this.x + 2, y: this.y + 4, w: this.w - 4, h: this.h - 4 }; }
    hurtbox() { return this.box; }

    respawn(x, y) {
      this.x = x - this.w / 2; this.y = y - this.h;
      this.vx = this.vy = 0;
      this.energy = this.maxE; this.alive = true; this.deadT = 0;
      this.invT = 1.6; this.hurtT = 0; this.dashT = 0; this.atkT = 0; this.charging = false;
      this.cape.ready = false; this.ghosts.length = 0;
    }

    update(dt, g) {
      this.t += dt;
      if (!this.alive) { this.deadT += dt; K.Audio.setFly(0); return; }
      const I = K.Input, ab = g.abilities, map = g.map;
      const ctrl = this.control && g.state === 'play';
      this.invT -= dt; this.hurtT -= dt; this.dashCD -= dt; this.resistCD -= dt; this.sinceHurt += dt; this.dropT -= dt; this.lowWarnT -= dt;
      this.landSquash = Math.max(0, this.landSquash - dt * 4);

      const inGrav = g.gravityActiveAt(this.cx, this.cy);
      this.inGrav = inGrav;
      let mx = 0;
      if (ctrl) { if (I.isDown('left')) mx -= 1; if (I.isDown('right')) mx += 1; }

      // ---------------- dash ----------------
      if (ab.dash && ctrl && I.wasPressed('dash') && this.dashCD <= 0 && this.dashT <= 0) {
        if (mx) this.facing = mx;
        this.dashT = 0.17; this.dashCD = 0.62; this.invT = Math.max(this.invT, 0.24);
        this.charging = false; this.atkT = 0;
        K.Audio.sfx('dash');
        K.FX.burst(this.cx, this.cy, 10, { color: ['#5ff3ff', '#bff8ff'], speed: [40, 140], life: [0.2, 0.45], size: [1.5, 3], type: 'glow', add: true });
      }

      const wasGround = this.onGround, prevVy = this.vy;
      if (this.dashT > 0) {
        this.dashT -= dt;
        this.vy = 0; this.vx = this.facing * 760;
        this.flying = false;
        this.ghostT -= dt;
        if (this.ghostT <= 0) { this.ghostT = 0.025; this.ghosts.push({ x: this.cx, y: this.bottom, f: this.facing, a: 0.5 }); }
        if (this.dashT <= 0) this.vx *= 0.35;
      } else {
        // ---------------- carrera ----------------
        const slow = (this.charging ? 0.55 : 1) * (this.atkT > 0 && this.onGround ? 0.45 : 1);
        const maxS = (inGrav ? 150 : (this.flying ? 300 : 265)) * slow;
        const acc = this.onGround ? 2600 : 1600;
        if (mx) {
          this.vx = K.approach(this.vx, mx * maxS, acc * dt);
          if (this.atkT <= 0 && !this.charging) this.facing = mx;
        } else {
          this.vx = K.approach(this.vx, 0, (this.onGround ? 2800 : 650) * dt);
        }
        // ---------------- salto y vuelo ----------------
        this.coyote = this.onGround ? 0.1 : this.coyote - dt;
        if (ctrl && I.wasPressed('fly')) this.jumpBuf = 0.12; else this.jumpBuf -= dt;
        const holding = ctrl && I.isDown('fly');
        if (this.jumpBuf > 0 && this.coyote > 0) {
          this.vy = -470; this.jumpBuf = 0; this.coyote = 0; this.flyHoldT = 0;
          K.Audio.sfx('jump');
          K.FX.burst(this.cx, this.bottom, 6, { color: '#cbb8a8', speed: [20, 70], angle: -Math.PI / 2, spread: 2.6, life: [0.3, 0.5], size: [3, 6], type: 'smoke' });
        }
        const wasFlying = this.flying;
        this.flying = false;
        if (holding && !this.onGround) {
          this.flyHoldT += dt;
          if (!inGrav && (this.flyHoldT > 0.15 || this.vy > 0)) {
            if (this.energy > 6) this.flying = true;
            else if (this.lowWarnT <= 0) { g.toast('Energía insuficiente para volar', '#ff6070', 1.6); this.lowWarnT = 2.5; }
          } else if (inGrav && this.lowWarnT <= 0 && this.flyHoldT > 0.2) { g.toast('La gravedad extrema impide volar', '#c48aff', 1.6); this.lowWarnT = 2.5; }
        } else if (!holding) this.flyHoldT = 0;
        if (this.flying) {
          this.vy -= 2950 * dt;
          if (ctrl && I.isDown('down')) this.vy += 2400 * dt;
          this.vy = Math.max(this.vy, -330);
          this.energy -= 8.5 * dt;
          if (!wasFlying) K.FX.ring(this.cx, this.bottom, 4, 26, 0.35, '#5ff3ff', 2);
        }
        this.vy += (inGrav ? GRAV_HEAVY : GRAV) * dt;
        this.vy = Math.min(this.vy, inGrav ? 1100 : 860);
        if (ctrl && I.isDown('down') && I.wasPressed('down') && this.onGround) this.dropT = 0.22;
      }
      this.dropThrough = this.dropT > 0;
      this.flyAmt = K.approach(this.flyAmt, this.flying ? 1 : 0, dt * 5);
      K.Audio.setFly(this.flyAmt * (g.state === 'play' ? 1 : 0));

      // ---------------- ataque ----------------
      this.handleAttack(dt, g, ctrl);

      // ---------------- Grito de Resistencia (Q) ----------------
      if (ab.shout && ctrl && I.wasPressed('shout') && this.resistCD <= 0) {
        this.resistT = 0.42; this.resistCD = 1.4;
        K.Audio.sfx('resist');
        K.FX.ring(this.cx, this.cy, 10, 210, 0.45, '#5ff3ff', 6);
        K.FX.ring(this.cx, this.cy, 6, 160, 0.38, '#ffffff', 3);
        K.FX.shake(4, 0.2);
      }
      if (this.resistT > 0) { this.resistT -= dt; this.resistR = K.lerp(10, 220, K.ease.outCubic(1 - Math.max(0, this.resistT) / 0.42)); } else this.resistR = 0;

      // ---------------- movimiento ----------------
      K.moveBody(this, map, dt);
      if (this.y < 4) { this.y = 4; if (this.vy < 0) this.vy = 0; }

      if (!wasGround && this.onGround && prevVy > 380) {
        K.Audio.sfx('land');
        this.landSquash = K.clamp(prevVy / 900, 0.2, 1);
        K.FX.burst(this.cx, this.bottom, 8, { color: '#bfb0a6', speed: [30, 110], angle: -Math.PI / 2, spread: 3, life: [0.3, 0.6], size: [3, 7], type: 'smoke' });
      }
      if (this.onGround && Math.abs(this.vx) > 40) {
        this.runPh += Math.abs(this.vx) * dt * 0.05;
        this.stepT -= dt;
        if (this.stepT <= 0) { this.stepT = 0.28; K.Audio.sfx('step'); }
      }
      // peligros: pinchos
      if (map.hazardOverlap(this.box)) { if (this.damage(15, this.cx - this.vx, g)) this.vy = -480; }
      // caída al vacío
      if (this.y > map.ph + 60) g.playerFell();
      // regeneración de energía en el suelo
      if (this.onGround && !this.flying && this.sinceHurt > 1.4 && this.energy < this.maxE) this.energy = Math.min(this.maxE, this.energy + 7 * dt);
      if (this.energy <= 0 && this.alive) this.die(g);

      // capa
      const P = this.pose;
      const anchorX = this.cx - this.facing * (3 + (P && P.lean > 0.6 ? 2 : 0));
      const anchorY = this.y + (P && P.lean > 0.6 ? 14 : 8);
      this.cape.update(anchorX, anchorY, dt, this.facing, this.flying ? -this.vx * 0.5 + Math.sin(this.t * 9) * 60 : -this.vx * 0.3, this.t);

      // estela de vuelo
      if (this.flying && Math.random() < dt * 40) {
        K.FX.spawn({ x: this.cx - this.facing * 6 + K.rand(-4, 4), y: this.bottom - 4, vx: -this.vx * 0.3 + K.rand(-20, 20), vy: K.rand(40, 120), life: K.rand(0.25, 0.5), size: K.rand(3, 6), color: K.pick(['#5ff3ff', '#9b6bff', '#bff8ff']), type: 'glow', add: true });
      }
      for (const gh of this.ghosts) gh.a -= dt * 2.4;
      this.ghosts = this.ghosts.filter(gh => gh.a > 0);
    }

    handleAttack(dt, g, ctrl) {
      const I = K.Input, ab = g.abilities;
      if (this.atkT > 0) {
        this.atkT -= dt;
        const p = 1 - this.atkT / this.atkDur;
        if (p > 0.18 && p < 0.62) this.doHits(g);
        if (this.atkT <= 0) this.atkType = null;
      }
      if (!ctrl || this.dashT > 0) { this.charging = false; return; }
      if (I.wasPressed('attack') && this.atkT <= 0.05) {
        if (ab.charge) { this.charging = true; this.chargeT = 0; this.chargeReady = false; }
        else this.startAttack('basic');
      }
      if (this.charging) {
        this.chargeT += dt;
        if (this.chargeT >= CHARGE_TIME && !this.chargeReady) {
          this.chargeReady = true; K.Audio.sfx('chargeReady');
          K.FX.ring(this.cx + this.facing * 10, this.cy, 4, 30, 0.3, '#5ff3ff', 2);
        }
        if (this.chargeT > 0.15 && Math.random() < dt * 30) {
          const a = Math.random() * 6.28;
          K.FX.spawn({ x: this.cx + Math.cos(a) * 30, y: this.cy + Math.sin(a) * 30, vx: -Math.cos(a) * 110, vy: -Math.sin(a) * 110, life: 0.27, size: 1.6, color: '#bff8ff', type: 'spark', add: true });
        }
        if (!I.isDown('attack')) { this.charging = false; this.startAttack(this.chargeT >= CHARGE_TIME ? 'charged' : 'basic'); }
      }
    }
    startAttack(type) {
      this.atkType = type;
      this.atkDur = type === 'basic' ? 0.24 : 0.4;
      this.atkT = this.atkDur;
      this.atkHit.clear();
      this.combo = (this.combo + 1) % 2;
      if (type === 'charged') { this.vx += this.facing * 240; K.Audio.sfx('whoosh'); K.FX.shake(2, 0.1); }
      else K.Audio.sfx('whoosh');
    }
    attackBox() {
      if (this.atkType === 'charged') return { x: this.facing > 0 ? this.cx : this.cx - 66, y: this.y - 2, w: 66, h: 48 };
      return { x: this.facing > 0 ? this.cx : this.cx - 46, y: this.y + 6, w: 46, h: 32 };
    }
    doHits(g) {
      const box = this.attackBox(), charged = this.atkType === 'charged';
      for (const e of g.enemies) {
        if (e.dead || this.atkHit.has(e.id)) continue;
        if (!K.overlap(box, e.hurtbox())) continue;
        this.atkHit.add(e.id);
        const res = e.takeHit(charged ? 36 : 12, this.facing, { charged, from: this }, g);
        if (res === false) continue;
        const hx = K.clamp(this.cx + this.facing * 26, e.x, e.x + e.w), hy = this.y + 18;
        if (res === 'blocked') continue;
        K.FX.stop(charged ? 0.11 : 0.05);
        K.FX.shake(charged ? 7 : 3, charged ? 0.28 : 0.12);
        K.Audio.sfx(charged ? 'charged' : 'hit');
        K.FX.burst(hx, hy, charged ? 22 : 10, { color: ['#ffffff', '#bff8ff', '#5ff3ff'], speed: [120, charged ? 520 : 320], life: [0.12, 0.35], size: [1.5, 2.5], type: 'spark', add: true, angle: this.facing > 0 ? 0 : Math.PI, spread: 2.2 });
        K.FX.spawn({ x: hx, y: hy, life: 0.15, size: charged ? 46 : 26, type: 'glow', color: '#bff8ff', add: true });
        if (charged) K.FX.ring(hx, hy, 6, 60, 0.3, '#ffffff', 4);
      }
      // paredes agrietadas
      for (const b of g.breakables) {
        if (b.broken || this.atkHit.has('b' + b.id)) continue;
        if (!K.overlap(box, b)) continue;
        this.atkHit.add('b' + b.id);
        if (charged) b.smash(g, this.facing);
        else {
          K.Audio.sfx('block');
          K.FX.burst(this.cx + this.facing * 30, this.y + 20, 6, { color: '#d8c8b8', speed: [60, 160], life: [0.15, 0.3], size: [1, 2], type: 'spark' });
          if (!g.breakHintT || g.time - g.breakHintT > 3) { g.toast('Muro agrietado: usa el GOLPE CARGADO (mantén clic)', '#ffcf6b', 2.2); g.breakHintT = g.time; }
        }
      }
    }

    damage(amount, srcX, g, knock = 1) {
      if (this.invT > 0 || !this.alive || g.state !== 'play') return false;
      this.energy -= amount;
      this.invT = 1.0; this.sinceHurt = 0; this.hurtT = 0.32;
      const dir = this.cx >= srcX ? 1 : -1;
      this.vx = dir * 320 * knock; this.vy = -280 * knock;
      this.charging = false; this.atkT = 0; this.dashT = 0;
      K.FX.stop(0.08); K.FX.shake(7, 0.3); K.FX.flash('#ff2040', 0.28);
      K.Audio.sfx('hurt');
      K.FX.text(this.cx, this.y - 6, '-' + Math.round(amount), '#ff6070', 18);
      K.FX.burst(this.cx, this.cy, 12, { color: ['#ff6070', '#ffffff'], speed: [80, 260], life: [0.2, 0.45], size: [1.5, 2.5], type: 'spark', add: true });
      if (this.energy <= 0) { this.energy = 0; this.die(g); }
      return true;
    }
    die(g) {
      if (!this.alive) return;
      this.alive = false; this.deadT = 0; this.flying = false;
      K.Audio.sfx('death'); K.Audio.setFly(0);
      K.FX.shake(10, 0.5); K.FX.flash('#ffffff', 0.5); K.FX.slow(0.35, 0.6);
      K.FX.burst(this.cx, this.cy, 40, { color: ['#5ff3ff', '#9b6bff', '#ffffff'], speed: [60, 380], life: [0.4, 1.1], size: [2, 5], type: 'glow', add: true, drag: 0.96 });
      K.FX.ring(this.cx, this.cy, 10, 120, 0.6, '#5ff3ff', 5);
      g.onPlayerDeath();
    }

    choosePose() {
      const t = this.t;
      if (this.dashT > 0) return K.Poses.dash();
      if (this.hurtT > 0) return K.Poses.hurt();
      if (this.atkT > 0) {
        const p = 1 - this.atkT / this.atkDur;
        const o = this.atkType === 'charged' ? K.Poses.heavy(p) : K.Poses.punch(p, this.combo === 1);
        if (!this.onGround) { o.ground = false; o.hipL = 0.4; o.kneeL = 1.1; o.hipR = -0.1; o.kneeR = 0.6; }
        return o;
      }
      if (this.charging) { const o = K.Poses.charge(t); o.glow = K.clamp(this.chargeT / CHARGE_TIME, 0, 1); if (!this.onGround) o.ground = false; return o; }
      if (this.resistT > 0) return K.Poses.shout(t);
      if (this.flying) return K.Poses.fly(t, this.vx);
      if (!this.onGround) return K.Poses.air(this.vy);
      if (Math.abs(this.vx) > 30) return K.Poses.run(this.runPh);
      return K.Poses.idle(t);
    }

    draw(ctx, g) {
      if (!this.alive) return;
      const S = K.Styles.kriss;
      const target = this.choosePose();
      this.pose = this.pose ? K.Rig.blend(this.pose, target, 0.45) : target;
      // fantasmas del dash
      if (this.ghosts.length) {
        const ghostS = K.Rig.variant(S, '#5ff3ff');
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const gh of this.ghosts) { ctx.globalAlpha = gh.a * 0.6; K.Rig.draw(ctx, gh.x, gh.y, gh.f, K.Poses.dash(), ghostS); }
        ctx.restore();
      }
      const blink = this.invT > 0 && this.dashT <= 0 && Math.floor(this.t * 20) % 2 === 0;
      ctx.save();
      if (blink) ctx.globalAlpha = 0.45;
      // aura
      K.FX.glow(ctx, this.cx, this.cy, 34 + this.flyAmt * 18, '#5ff3ff', 0.12 + this.flyAmt * 0.18);
      const flash = this.hurtT > 0.22;
      const st = flash ? K.Rig.variant(S, '#ffffff') : S;
      this.cape.draw(ctx, st.cape[0], st.cape[1], st.flat);
      const sq = this.landSquash;
      if (sq > 0) { ctx.translate(this.cx, this.bottom); ctx.scale(1 + sq * 0.15, 1 - sq * 0.15); ctx.translate(-this.cx, -this.bottom); }
      this.joints = K.Rig.draw(ctx, this.cx, this.bottom + 1, this.facing, this.pose, st, this.t);
      ctx.restore();
      // anillo del grito de resistencia
      if (this.resistT > 0) {
        const k = this.resistT / 0.42;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(95,243,255,${k})`; ctx.lineWidth = 10 * k + 2;
        ctx.beginPath(); ctx.arc(this.cx, this.cy, this.resistR, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
  };
})(window.K);
