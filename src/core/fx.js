'use strict';
// ============================================================================
//  Efectos especiales: partículas, brillos, temblor de cámara, destellos,
//  "hit-stop" (congelar unos milisegundos al golpear) y textos flotantes.
// ============================================================================
(function (K) {
  const FX = K.FX = {
    parts: [], texts: [],
    shakeT: 0, shakeDur: 1, shakeMag: 0,
    flashA: 0, flashColor: '#ffffff',
    hitstop: 0, timeScale: 1, slowT: 0,
  };
  const MAX = 1600;

  // Sprite de brillo radial cacheado por color (mucho más barato que shadowBlur).
  const glowCache = {};
  FX.glowSprite = function (color) {
    if (glowCache[color]) return glowCache[color];
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, K.rgba(color, 1));
    gr.addColorStop(0.25, K.rgba(color, 0.55));
    gr.addColorStop(0.6, K.rgba(color, 0.14));
    gr.addColorStop(1, K.rgba(color, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    glowCache[color] = c;
    return c;
  };
  // Dibuja un brillo aditivo de radio r.
  FX.glow = function (ctx, x, y, r, color, a = 1) {
    if (a <= 0 || r <= 0) return;
    const prev = ctx.globalCompositeOperation, pa = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = pa * Math.min(1, a);
    ctx.drawImage(FX.glowSprite(color), x - r, y - r, r * 2, r * 2);
    ctx.globalCompositeOperation = prev; ctx.globalAlpha = pa;
  };

  FX.clear = function () { FX.parts.length = 0; FX.texts.length = 0; FX.flashA = 0; FX.shakeT = 0; FX.hitstop = 0; FX.timeScale = 1; FX.slowT = 0; };

  // p: {x,y,vx,vy,life,size,color,type,grav,drag,add,grow,rot,vr,len}
  FX.spawn = function (p) {
    if (FX.parts.length >= MAX) FX.parts.shift();
    p.max = p.life = p.life || 0.6;
    p.size = p.size || 3;
    p.type = p.type || 'dot';
    p.grav = p.grav || 0;
    p.drag = p.drag === undefined ? 1 : p.drag;
    p.vx = p.vx || 0; p.vy = p.vy || 0;
    p.rot = p.rot || 0; p.vr = p.vr || 0;
    FX.parts.push(p);
    return p;
  };
  FX.burst = function (x, y, n, o) {
    for (let i = 0; i < n; i++) {
      const a = (o.angle !== undefined ? o.angle : 0) + (o.spread !== undefined ? (Math.random() - 0.5) * o.spread : Math.random() * Math.PI * 2);
      const sp = K.rand(o.speed ? o.speed[0] : 50, o.speed ? o.speed[1] : 200);
      FX.spawn({
        x: x + K.rand(-(o.jitter || 0), o.jitter || 0), y: y + K.rand(-(o.jitter || 0), o.jitter || 0),
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: K.rand(o.life ? o.life[0] : 0.3, o.life ? o.life[1] : 0.7),
        size: K.rand(o.size ? o.size[0] : 2, o.size ? o.size[1] : 4),
        color: Array.isArray(o.color) ? K.pick(o.color) : o.color,
        type: o.type, grav: o.grav, drag: o.drag, add: o.add, grow: o.grow, len: o.len,
        vr: o.spin ? K.rand(-o.spin, o.spin) : 0, rot: Math.random() * 6.28,
      });
    }
  };
  FX.ring = function (x, y, r0, r1, life, color, width = 3) {
    FX.spawn({ x, y, type: 'ring', r0, r1, life, color, size: width, add: true });
  };
  FX.text = function (x, y, str, color = '#ffffff', size = 16, life = 0.9) {
    FX.texts.push({ x, y, str, color, size, life, max: life, vy: -55 });
  };
  FX.shake = function (mag, dur) {
    if (mag >= FX.shakeMag * (FX.shakeT / FX.shakeDur || 0)) { FX.shakeMag = mag; FX.shakeT = dur; FX.shakeDur = dur; }
  };
  FX.flash = function (color, a) { FX.flashColor = color; FX.flashA = Math.max(FX.flashA, a); };
  FX.stop = function (t) { FX.hitstop = Math.max(FX.hitstop, t); };
  FX.slow = function (scale, t) { FX.timeScale = scale; FX.slowT = t; };
  FX.shakeOffset = function () {
    if (FX.shakeT <= 0) return { x: 0, y: 0 };
    const m = FX.shakeMag * (FX.shakeT / FX.shakeDur);
    return { x: (Math.random() * 2 - 1) * m, y: (Math.random() * 2 - 1) * m };
  };

  FX.updateTimers = function (rdt) {
    FX.shakeT = Math.max(0, FX.shakeT - rdt);
    FX.flashA = Math.max(0, FX.flashA - rdt * 2.2);
    if (FX.slowT > 0) { FX.slowT -= rdt; if (FX.slowT <= 0) FX.timeScale = 1; }
  };
  FX.update = function (dt) {
    const P = FX.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) { P.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      if (p.drag !== 1) { const d = Math.pow(p.drag, dt * 60); p.vx *= d; p.vy *= d; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    const T = FX.texts;
    for (let i = T.length - 1; i >= 0; i--) {
      const t = T[i];
      t.life -= dt; t.y += t.vy * dt; t.vy *= Math.pow(0.9, dt * 60);
      if (t.life <= 0) T.splice(i, 1);
    }
  };

  function drawPart(ctx, p) {
    const k = p.life / p.max;
    switch (p.type) {
      case 'glow': {
        const r = p.size * (p.grow ? 1 + (1 - k) * p.grow : 1);
        ctx.globalAlpha = k;
        ctx.drawImage(FX.glowSprite(p.color), p.x - r, p.y - r, r * 2, r * 2);
        break;
      }
      case 'spark': {
        const len = p.len || 0.035;
        ctx.globalAlpha = Math.min(1, k * 1.5);
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size * k + 0.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * len, p.y - p.vy * len); ctx.stroke();
        break;
      }
      case 'smoke': {
        const r = p.size * (1 + (1 - k) * (p.grow || 1.5));
        ctx.globalAlpha = k * 0.45;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'ring': {
        const e = K.ease.outCubic(1 - k);
        const r = K.lerp(p.r0, p.r1, e);
        ctx.globalAlpha = k;
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size * k + 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 'shard': {
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.fillStyle = p.color;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        const s = p.size;
        ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, s * 0.6); ctx.lineTo(-s * 0.8, s * 0.4); ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      }
      case 'rect': {
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.fillStyle = p.color;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
        break;
      }
      default: {
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.fillStyle = p.color;
        const r = p.size * (0.4 + 0.6 * k);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  FX.draw = function (ctx, view) {
    const P = FX.parts;
    const x0 = view.x - 60, x1 = view.x + K.W + 60, y0 = view.y - 60, y1 = view.y + K.H + 60;
    ctx.save();
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalCompositeOperation = pass ? 'lighter' : 'source-over';
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        if (!!p.add !== !!pass) continue;
        if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
        drawPart(ctx, p);
      }
    }
    ctx.restore();
  };
  FX.drawTexts = function (ctx) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of FX.texts) {
      const k = t.life / t.max;
      const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
      ctx.globalAlpha = Math.min(1, k * 2.5);
      ctx.font = K.font(Math.round(t.size * pop), 700);
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(5,4,14,0.85)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
    }
    ctx.restore();
  };
})(window.K);
