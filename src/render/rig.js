'use strict';
// ============================================================================
//  Rig de personajes: todos los humanoides (Kriss, soldados, Korr, Vexor,
//  aliados) se dibujan con un "esqueleto" 2D de huesos articulados.
//  Las animaciones son POSES procedurales que se interpolan cada fotograma.
//  Convención de ángulos: 0 = colgando hacia abajo, positivo = hacia delante.
// ============================================================================
(function (K) {
  const R = K.Rig = {};
  const OUT = 'rgba(6,5,14,0.9)';

  // ---------- Estilos (paleta y forma de cada personaje) ----------
  K.Styles = {
    kriss: { suit: '#1b2442', suit2: '#2a3866', armor: '#d3deee', trim: '#f0c86a', glow: '#5ff3ff', skin: '#e8b896', hair: '#eef4ff',
      head: 'hair', boot: '#11162b', glove: '#d3deee', bulk: 1, emblem: true, cape: ['#3b1f73', '#5ff3ff'] },
    soldier: { suit: '#383e48', suit2: '#4d5560', armor: '#a3acb7', trim: '#6b737d', glow: '#ff3b3b', head: 'soldier',
      boot: '#20242a', glove: '#5b636d', bulk: 1.05, weapon: '#ff3b3b' },
    korr: { scale: 1.32, suit: '#2a221e', suit2: '#3b2f27', armor: '#8c6a3c', trim: '#d09038', glow: '#ff8a2a', head: 'heavy',
      boot: '#17120f', glove: '#7a5a30', bulk: 1.4, emblem: true },
    vexor: { scale: 1.34, suit: '#0c0c12', suit2: '#191922', armor: '#b9bdca', trim: '#5c606c', glow: '#ff2a3a', skin: '#c99a82',
      head: 'vexor', boot: '#08080b', glove: '#b9bdca', bulk: 1.18, emblem: true, cape: ['#0b0b10', '#6a0c18'] },
    explorer: { suit: '#4a3a2a', suit2: '#5f4b37', armor: '#7d6749', trim: '#b08a52', glow: '#ffd27a', skin: '#c8946e', head: 'hood',
      hood: '#5a4632', boot: '#2a2018', glove: '#5a4632', bulk: 0.95 },
    nyra: { suit: '#163a36', suit2: '#22524a', armor: '#a3dccb', trim: '#ffb85a', glow: '#ffb85a', skin: '#e0a88a', hair: '#e9f0ff',
      head: 'nyra', boot: '#0e2422', glove: '#a3dccb', bulk: 0.88 },
  };

  // Variantes de color: blanco (impacto) y fantasma (estela del dash).
  const variantCache = new Map();
  R.variant = function (S, color) {
    const key = S;
    let m = variantCache.get(key);
    if (!m) { m = {}; variantCache.set(key, m); }
    if (!m[color]) {
      const v = {};
      for (const k in S) v[k] = typeof S[k] === 'string' && S[k][0] === '#' ? color : S[k];
      if (S.cape) v.cape = [color, color];
      v.flat = true;
      m[color] = v;
    }
    return m[color];
  };

  // ---------- Poses ----------
  const P = K.Poses = {
    idle(t) { const b = Math.sin(t * 2.4); return { lean: 0.03, bob: b * 0.6, head: 0, hipL: -0.14, kneeL: 0.12, hipR: 0.16, kneeR: 0.1, shL: -0.14 + b * 0.03, elL: 0.45, shR: 0.16 - b * 0.03, elR: 0.55, ground: true }; },
    guard(t) { const b = Math.sin(t * 3); return { lean: 0.14, bob: b * 0.6, head: -0.08, hipL: -0.38, kneeL: 0.4, hipR: 0.4, kneeR: 0.5, shL: 0.6, elL: 1.9, shR: 1.0, elR: 2.0, ground: true }; },
    walk(ph) { const s = Math.sin(ph), c = Math.cos(ph); return { lean: 0.06, bob: -Math.abs(c) * 1.1, head: 0, hipL: s * 0.48, kneeL: 0.15 + Math.max(0, -c) * 0.7, hipR: -s * 0.48, kneeR: 0.15 + Math.max(0, c) * 0.7, shL: -s * 0.42, elL: 0.45, shR: s * 0.42, elR: 0.45, ground: true }; },
    run(ph) { const s = Math.sin(ph), c = Math.cos(ph); return { lean: 0.3, bob: -Math.abs(c) * 2.4, head: -0.12, hipL: s * 0.9, kneeL: 0.3 + Math.max(0, -c) * 1.4, hipR: -s * 0.9, kneeR: 0.3 + Math.max(0, c) * 1.4, shL: -s * 0.95, elL: 1.3, shR: s * 0.95, elR: 1.3, ground: true }; },
    air(vy) {
      if (vy < 0) return { lean: 0.1, head: -0.1, hipL: 0.55, kneeL: 1.4, hipR: -0.15, kneeR: 0.5, shL: -0.6, elL: 0.8, shR: 0.8, elR: 1.2 };
      return { lean: 0.04, head: 0.05, hipL: 0.25, kneeL: 0.45, hipR: -0.25, kneeR: 0.7, shL: -1.3, elL: 0.6, shR: 1.5, elR: 0.6 };
    },
    fly(t, vx) {
      const sp = K.clamp(Math.abs(vx) / 290, 0, 1), w = Math.sin(t * 7) * 0.05;
      return { lean: 0.12 + sp * 1.12, head: -sp * 0.85, hipL: 0.06 + w, kneeL: 0.25, hipR: -0.14 - w, kneeR: 0.6, shR: 2.95 - sp * 0.1, elR: 0.05, shL: -0.4 - sp * 0.3, elL: 0.3 };
    },
    hover(t) { const b = Math.sin(t * 2); return { lean: 0.05, bob: b * 2, head: -0.05, hipL: 0.12, kneeL: 0.3, hipR: -0.1, kneeR: 0.5, shL: 0.5, elL: 1.95, shR: 0.62, elR: 1.9 }; },
    punch(p, alt) {
      const ext = p < 0.35 ? K.ease.outCubic(p / 0.35) : 1 - K.ease.inOut((p - 0.35) / 0.65) * 0.85;
      const o = { lean: 0.14 + ext * 0.14, head: -0.06, hipL: -0.42, kneeL: 0.28, hipR: 0.46, kneeR: 0.36, ground: true };
      const fr = { sh: -0.3 + ext * 1.95, el: 1.7 * (1 - ext) + 0.05 }, gd = { sh: 0.62, el: 1.9 };
      if (!alt) { o.shR = fr.sh; o.elR = fr.el; o.shL = gd.sh; o.elL = gd.el; } else { o.shL = fr.sh; o.elL = fr.el; o.shR = gd.sh; o.elR = gd.el; }
      return o;
    },
    windup() { return { lean: -0.1, head: 0, hipL: -0.42, kneeL: 0.42, hipR: 0.42, kneeR: 0.5, shR: -0.95, elR: 2.0, shL: 0.7, elL: 1.6, ground: true }; },
    charge(t) { const s = Math.sin(t * 45) * 0.03; return { lean: -0.06, head: 0.04, hipL: -0.52, kneeL: 0.55, hipR: 0.52, kneeR: 0.75, shR: -0.85 + s, elR: 2.3, shL: 0.95, elL: 1.4, ground: true }; },
    heavy(p) {
      const ext = p < 0.3 ? K.ease.outCubic(p / 0.3) : 1 - (p - 0.3) / 0.7 * 0.7;
      return { lean: 0.1 + ext * 0.38, head: -0.18, hipL: -0.72, kneeL: 0.3, hipR: 0.62, kneeR: 0.75, shR: -0.8 + ext * 2.45, elR: 2.3 * (1 - ext), shL: -0.45, elL: 0.8, ground: true };
    },
    dash() { return { lean: 0.95, head: -0.7, hipL: -0.5, kneeL: 0.6, hipR: -0.2, kneeR: 0.95, shL: -1.35, elL: 0.3, shR: -1.05, elR: 0.4 }; },
    ram() { return { lean: 1.25, head: -1.0, hipL: 0.02, kneeL: 0.2, hipR: -0.12, kneeR: 0.45, shR: 3.0, elR: 0, shL: 2.75, elL: 0.12 }; },
    hurt() { return { lean: -0.38, head: 0.22, hipL: -0.3, kneeL: 0.4, hipR: 0.42, kneeR: 0.3, shL: -1.0, elL: 0.6, shR: 1.35, elR: 0.5, ground: true }; },
    stunned(t) { const s = Math.sin(t * 3) * 0.06; return { lean: 0.48 + s, head: 0.45, hipL: 1.5, kneeL: 2.4, hipR: 0.25, kneeR: 1.5, shL: 0.15, elL: 0.3, shR: 0.38, elR: 0.6, ground: true }; },
    shout(t) { const v = Math.sin(t * 32) * 0.05; return { lean: -0.26, head: -0.35, hipL: -0.48, kneeL: 0.32, hipR: 0.48, kneeR: 0.36, shL: -1.15 + v, elL: 0.5, shR: -1.3 - v, elR: 0.6, ground: true }; },
    gather(t) { const v = Math.sin(t * 20) * 0.06; return { lean: 0.1, head: 0.15, hipL: 0.1, kneeL: 0.4, hipR: -0.1, kneeR: 0.6, shL: 1.9 + v, elL: 1.2, shR: 2.1 - v, elR: 1.1 }; },
    sit(t) { const b = Math.sin(t * 1.6); return { lean: -0.28 + b * 0.02, head: 0.18, hipL: 1.5, kneeL: 1.7, hipR: 1.4, kneeR: 1.25, shL: 0.1, elL: 0.35, shR: 0.95, elR: 1.55, drop: 17 }; },
    talk(t) { const b = Math.sin(t * 2.4), g = Math.sin(t * 5.3); return { lean: 0.02, bob: b * 0.5, head: g * 0.05, hipL: -0.14, kneeL: 0.12, hipR: 0.16, kneeR: 0.1, shL: -0.1, elL: 0.6, shR: 0.4 + g * 0.15, elR: 1.3, ground: true }; },
  };
  // Mezcla dos poses (para transiciones suaves).
  R.blend = function (a, b, t) {
    const o = {};
    for (const k in b) o[k] = typeof b[k] === 'number' ? K.lerp(a[k] || 0, b[k], t) : b[k];
    return o;
  };

  // ---------- Dibujo ----------
  function pts(x, y, a1, l1, a2, l2) {
    const kx = x + Math.sin(a1) * l1, ky = y + Math.cos(a1) * l1;
    return { kx, ky, fx: kx + Math.sin(a2) * l2, fy: ky + Math.cos(a2) * l2 };
  }
  function limb(ctx, x, y, a1, l1, a2, l2, w, c1, c2, flat) {
    const p = pts(x, y, a1, l1, a2, l2);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (!flat) {
      ctx.strokeStyle = OUT; ctx.lineWidth = w + 2.6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(p.kx, p.ky); ctx.lineTo(p.fx, p.fy); ctx.stroke();
    }
    ctx.strokeStyle = c1; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(p.kx, p.ky); ctx.lineTo(p.fx, p.fy); ctx.stroke();
    ctx.strokeStyle = c2; ctx.lineWidth = w + 0.6;
    ctx.beginPath(); ctx.moveTo(K.lerp(p.kx, p.fx, 0.5), K.lerp(p.ky, p.fy, 0.5)); ctx.lineTo(p.fx, p.fy); ctx.stroke();
    return p;
  }

  function drawHead(ctx, hx, hy, rot, S, t) {
    ctx.save();
    ctx.translate(hx, hy); ctx.rotate(rot);
    const flat = S.flat;
    const ol = () => { if (!flat) { ctx.strokeStyle = OUT; ctx.lineWidth = 2.2; ctx.stroke(); } };
    switch (S.head) {
      case 'hair': {
        // pelo hacia atrás en mechones
        // mechones traseros
        ctx.fillStyle = flat ? S.hair : K.shade(S.hair, -0.18);
        ctx.beginPath();
        ctx.moveTo(1, -6.5); ctx.lineTo(-12.5, -8.5); ctx.lineTo(-7.5, -4); ctx.lineTo(-13.5, -2); ctx.lineTo(-7, 0); ctx.lineTo(-10.5, 3.5); ctx.lineTo(-4, 2.5);
        ctx.closePath(); ol(); ctx.fill();
        // rostro
        ctx.beginPath(); ctx.arc(0, 0, 6.2, 0, Math.PI * 2); ctx.fillStyle = S.skin; ol(); ctx.fill();
        // gorro de pelo (solo la parte superior y la nuca)
        ctx.fillStyle = S.hair;
        ctx.beginPath(); ctx.moveTo(6.4, -2.2); ctx.quadraticCurveTo(5, -7.4, -0.5, -7); ctx.quadraticCurveTo(-6.8, -6.4, -6.6, 1.5);
        ctx.lineTo(-3.2, 0.2); ctx.lineTo(-2.4, -3.2); ctx.quadraticCurveTo(2, -4.6, 6.4, -2.2); ctx.closePath(); ctx.fill();
        if (!flat) {
          ctx.fillStyle = 'rgba(90,40,30,0.25)'; ctx.beginPath(); ctx.arc(0.5, 1.8, 4.6, 0.1, 2.4); ctx.fill();
          ctx.fillStyle = '#10142a'; ctx.fillRect(2.6, -1.4, 3.2, 1.9);
          ctx.fillStyle = S.glow; ctx.fillRect(3.4, -1.1, 2.3, 1.2);
          K.FX.glow(ctx, 4.5, -0.6, 7, S.glow, 0.8);
        }
        break;
      }
      case 'nyra': {
        ctx.fillStyle = S.hair;
        ctx.beginPath(); ctx.moveTo(-4, -4); ctx.bezierCurveTo(-14, -6, -16, 6, -11, 15); ctx.bezierCurveTo(-10, 8, -9, 2, -3, 2); ctx.closePath(); ol(); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fillStyle = S.skin; ol(); ctx.fill();
        ctx.fillStyle = S.hair;
        ctx.beginPath(); ctx.arc(-0.5, -1.2, 6.2, Math.PI * 1.02, Math.PI * 1.95); ctx.lineTo(4, -2); ctx.quadraticCurveTo(0, -3.5, -6, 0); ctx.fill();
        ctx.fillStyle = S.trim; ctx.fillRect(-5.5, -4.6, 11, 1.6);
        if (!flat) { ctx.fillStyle = S.glow; ctx.fillRect(2.4, -0.8, 2.6, 1.3); K.FX.glow(ctx, 4, -0.2, 5, S.glow, 0.6); }
        break;
      }
      case 'hood': {
        ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.fillStyle = S.hood; ol(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-6, 3); ctx.lineTo(-11, 9); ctx.lineTo(-3, 6.5); ctx.fill();
        ctx.beginPath(); ctx.ellipse(2.5, 0.8, 4, 4.6, 0, 0, Math.PI * 2); ctx.fillStyle = flat ? S.hood : '#1a120c'; ctx.fill();
        if (!flat) { ctx.fillStyle = S.glow; ctx.fillRect(3, -0.5, 2, 1.2); }
        break;
      }
      case 'soldier': {
        const g = flat ? S.armor : ctx.createLinearGradient(0, -7, 0, 7);
        if (!flat) { g.addColorStop(0, K.shade(S.armor, 0.25)); g.addColorStop(1, K.shade(S.armor, -0.35)); }
        ctx.beginPath(); ctx.moveTo(-6.5, 5); ctx.lineTo(-7, -2); ctx.quadraticCurveTo(-6, -8, 0, -8); ctx.quadraticCurveTo(7, -8, 7.2, -1); ctx.lineTo(6.5, 5.5); ctx.closePath();
        ctx.fillStyle = g; ol(); ctx.fill();
        ctx.strokeStyle = flat ? S.armor : '#5d6570'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-7.5, -11); ctx.stroke();
        ctx.fillStyle = flat ? S.armor : '#1b0608'; ctx.fillRect(0, -3.2, 7.4, 3.8);
        if (!flat) { ctx.fillStyle = S.glow; ctx.fillRect(0.8, -2.4, 6.4, 1.7); K.FX.glow(ctx, 4, -1.5, 9, S.glow, 0.8); }
        break;
      }
      case 'heavy': {
        const g = flat ? S.armor : ctx.createLinearGradient(0, -9, 0, 7);
        if (!flat) { g.addColorStop(0, K.shade(S.armor, 0.3)); g.addColorStop(1, K.shade(S.armor, -0.45)); }
        ctx.fillStyle = flat ? S.armor : S.trim;
        ctx.beginPath(); ctx.moveTo(-6, -7); ctx.lineTo(-2, -13); ctx.lineTo(0, -8); ctx.lineTo(3, -12.5); ctx.lineTo(4, -7); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-7.5, 6); ctx.lineTo(-8, -3); ctx.quadraticCurveTo(-7, -9, 0, -9); ctx.quadraticCurveTo(8, -9, 8, -1); ctx.lineTo(7.5, 6.5); ctx.closePath();
        ctx.fillStyle = g; ol(); ctx.fill();
        ctx.fillStyle = flat ? S.armor : '#1a0d04'; ctx.fillRect(1, -3.5, 7, 3.5); ctx.fillRect(3.4, -3.5, 2.4, 8);
        if (!flat) { ctx.fillStyle = S.glow; ctx.fillRect(1.6, -2.8, 6, 1.8); ctx.fillRect(4, -1.5, 1.2, 5); K.FX.glow(ctx, 5, -1.5, 11, S.glow, 0.8); }
        break;
      }
      case 'vexor': {
        // casco negro con aletas plateadas, rostro con visor rojo y cicatriz
        ctx.fillStyle = flat ? S.armor : S.armor;
        ctx.beginPath(); ctx.moveTo(-2, -6); ctx.lineTo(-15, -11); ctx.lineTo(-6, -2); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(-14, -3); ctx.lineTo(-6, 1.5); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fillStyle = flat ? S.skin : '#121219'; ol(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0.5, -1.5); ctx.lineTo(7.2, -1.5); ctx.lineTo(6.5, 5.5); ctx.quadraticCurveTo(2, 7.5, 0.5, 4); ctx.closePath();
        ctx.fillStyle = S.skin; ctx.fill();
        ctx.fillStyle = flat ? S.armor : '#b9bdca'; ctx.fillRect(-1, -7.4, 6, 1.6);
        if (!flat) {
          ctx.fillStyle = '#2a0408'; ctx.fillRect(0.5, -3.8, 7, 3);
          ctx.fillStyle = S.glow; ctx.fillRect(1.2, -3.1, 6.2, 1.6);
          K.FX.glow(ctx, 4.5, -2.4, 11, S.glow, 0.9);
          ctx.strokeStyle = '#f2b0a8'; ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.moveTo(4.6, -6.2); ctx.lineTo(5.3, -2.6); ctx.moveTo(5.5, -0.8); ctx.lineTo(6.3, 3.2); ctx.stroke();
        }
        break;
      }
    }
    ctx.restore();
  }

  function drawTorso(ctx, hx, hy, sx, sy, lean, S) {
    const b = S.bulk || 1, flat = S.flat;
    const nx = Math.cos(lean), ny = Math.sin(lean);
    const wh = 5.2 * b, ws = 7.8 * b;
    ctx.beginPath();
    ctx.moveTo(hx + nx * wh, hy + ny * wh);
    ctx.lineTo(sx + nx * ws, sy + ny * ws);
    ctx.quadraticCurveTo(sx + Math.sin(lean) * 3, sy - Math.cos(lean) * 3, sx - nx * ws, sy - ny * ws);
    ctx.lineTo(hx - nx * wh, hy - ny * wh);
    ctx.closePath();
    if (!flat) { ctx.strokeStyle = OUT; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.stroke(); }
    if (flat) ctx.fillStyle = S.suit;
    else {
      const g = ctx.createLinearGradient(sx + nx * ws, sy + ny * ws, sx - nx * ws, sy - ny * ws);
      g.addColorStop(0, S.suit2); g.addColorStop(1, S.suit);
      ctx.fillStyle = g;
    }
    ctx.fill();
    // placa pectoral
    const mx = K.lerp(hx, sx, 0.45), my = K.lerp(hy, sy, 0.45);
    ctx.beginPath();
    ctx.moveTo(mx + nx * ws * 0.8, my + ny * ws * 0.8);
    ctx.lineTo(sx + nx * ws * 0.92, sy + ny * ws * 0.92);
    ctx.lineTo(sx - nx * ws * 0.55, sy - ny * ws * 0.55);
    ctx.lineTo(mx - nx * ws * 0.3, my - ny * ws * 0.3);
    ctx.closePath();
    if (flat) ctx.fillStyle = S.armor;
    else {
      const g2 = ctx.createLinearGradient(sx, sy, mx, my);
      g2.addColorStop(0, K.shade(S.armor, 0.1)); g2.addColorStop(1, K.shade(S.armor, -0.4));
      ctx.fillStyle = g2;
    }
    ctx.fill();
    // cinturón
    ctx.strokeStyle = S.trim; ctx.lineWidth = 2.4; ctx.lineCap = 'butt';
    const bx = K.lerp(hx, sx, 0.08), by = K.lerp(hy, sy, 0.08);
    ctx.beginPath(); ctx.moveTo(bx + nx * wh * 1.02, by + ny * wh * 1.02); ctx.lineTo(bx - nx * wh * 1.02, by - ny * wh * 1.02); ctx.stroke();
    // emblema luminoso
    if (S.emblem && !flat) {
      const ex = K.lerp(hx, sx, 0.68) + nx * 2.4, ey = K.lerp(hy, sy, 0.68) + ny * 2.4;
      ctx.fillStyle = S.glow;
      ctx.beginPath(); ctx.moveTo(ex, ey - 2.6); ctx.lineTo(ex + 2, ey); ctx.lineTo(ex, ey + 2.6); ctx.lineTo(ex - 2, ey); ctx.closePath(); ctx.fill();
      K.FX.glow(ctx, ex, ey, 9, S.glow, 0.8);
    }
  }

  // x,y = pies (centro inferior) en coordenadas del mundo.
  R.draw = function (ctx, x, y, facing, Pz, S, t = 0) {
    const s = S.scale || 1, b = S.bulk || 1;
    const L1 = 12, L2 = 12, A1 = 10, A2 = 10;
    const lean = Pz.lean || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing * s, s);
    // compensación de suelo: el pie más bajo toca y=0
    let hipY = -24 + (Pz.bob || 0);
    const hl = (Pz.hipL || 0) - lean, hr = (Pz.hipR || 0) - lean;
    if (Pz.ground) {
      const fL = Math.cos(hl) * L1 + Math.cos(hl - (Pz.kneeL || 0)) * L2;
      const fR = Math.cos(hr) * L1 + Math.cos(hr - (Pz.kneeR || 0)) * L2;
      hipY = -Math.max(fL, fR) + (Pz.bob || 0) * 0.5;
    }
    if (Pz.drop) hipY += Pz.drop;
    const hx = 0, hy = hipY;
    const TL = 18;
    const sdx = Math.sin(lean), sdy = -Math.cos(lean);
    const sx = hx + sdx * TL, sy = hy + sdy * TL;
    const headX = hx + sdx * (TL + 8.5), headY = hy + sdy * (TL + 8.5);
    const lw = 6 * Math.sqrt(b), aw = 5 * Math.sqrt(b);
    const nx = Math.cos(lean), ny = Math.sin(lean);
    const dk = c => (S.flat ? c : K.shade(c, -0.32));

    // brazo trasero
    limb(ctx, sx - nx * 1.5, sy - ny * 1.5, (Pz.shL || 0) - lean, A1, (Pz.shL || 0) + (Pz.elL || 0) - lean, A2, aw, dk(S.suit2), dk(S.glove), S.flat);
    // pierna trasera
    limb(ctx, hx - nx * 1.2, hy - ny * 1.2, hl, L1, hl - (Pz.kneeL || 0), L2, lw, dk(S.suit), dk(S.boot), S.flat);
    drawTorso(ctx, hx, hy, sx, sy, lean, S);
    // pierna delantera
    limb(ctx, hx + nx * 1.2, hy + ny * 1.2, hr, L1, hr - (Pz.kneeR || 0), L2, lw, S.suit, S.boot, S.flat);
    drawHead(ctx, headX, headY, lean + (Pz.head || 0), S, t);
    // brazo delantero
    const fa = (Pz.shR || 0) - lean, fe = (Pz.shR || 0) + (Pz.elR || 0) - lean;
    const arm = limb(ctx, sx + nx * 1.5, sy + ny * 1.5, fa, A1, fe, A2, aw, S.suit2, S.glove, S.flat);
    // arma (bastón de energía)
    if (S.weapon && !S.flat) {
      const ex = arm.fx + Math.sin(fe) * 15, ey = arm.fy + Math.cos(fe) * 15;
      ctx.strokeStyle = '#2a2e36'; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(arm.fx, arm.fy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = S.weapon; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(K.lerp(arm.fx, ex, 0.3), K.lerp(arm.fy, ey, 0.3)); ctx.lineTo(ex, ey); ctx.stroke();
      K.FX.glow(ctx, ex, ey, 7, S.weapon, 0.7);
    }
    // hombrera
    ctx.beginPath(); ctx.arc(sx + nx * 2, sy + ny * 2 + 1, 4.2 * b, 0, Math.PI * 2);
    if (!S.flat) { ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.fillStyle = S.armor; ctx.fill();
    if (!S.flat) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(sx + nx * 2.6, sy + ny * 2 - 0.4, 1.6 * b, 0, Math.PI * 2); ctx.fill(); }
    // puño cargado
    if (Pz.glow > 0 && !S.flat) {
      K.FX.glow(ctx, arm.fx, arm.fy, 8 + Pz.glow * 22, S.glow, 0.5 + Pz.glow * 0.5);
      K.FX.glow(ctx, arm.fx, arm.fy, 4 + Pz.glow * 6, '#ffffff', Pz.glow);
    }
    ctx.restore();
    // devolver puntos útiles en coordenadas del mundo
    return {
      hand: { x: x + arm.fx * facing * s, y: y + arm.fy * s },
      head: { x: x + headX * facing * s, y: y + headY * s },
      shoulder: { x: x + (sx - nx * 3) * facing * s, y: y + (sy - ny * 3 + 1) * s },
    };
  };

  // ---------- Capa con física de verlet ----------
  K.Cape = class {
    constructor(n = 7, seg = 6, w0 = 4.5, w1 = 9) { this.n = n; this.seg = seg; this.w0 = w0; this.w1 = w1; this.p = []; this.ready = false; }
    reset(x, y) {
      this.p = [];
      for (let i = 0; i < this.n; i++) this.p.push({ x, y: y + i * this.seg, px: x, py: y + i * this.seg });
      this.ready = true;
    }
    update(ax, ay, dt, facing, wind = 0, t = 0) {
      if (!this.ready) this.reset(ax, ay);
      const p = this.p, p0 = p[0];
      p0.x = ax; p0.y = ay; p0.px = ax; p0.py = ay;
      const dt2 = dt * dt;
      for (let i = 1; i < this.n; i++) {
        const q = p[i];
        const vx = (q.x - q.px) * 0.94, vy = (q.y - q.py) * 0.94;
        q.px = q.x; q.py = q.y;
        const flutter = wind ? Math.sin(t * 13 + i * 1.3) * wind * 0.35 : 0;
        q.x += vx + (wind - facing * 90) * dt2 * (i / this.n);
        q.y += vy + (760 + flutter) * dt2;
      }
      for (let it = 0; it < 4; it++) {
        for (let i = 1; i < this.n; i++) {
          const a = p[i - 1], b = p[i];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.001;
          const diff = (d - this.seg) / d;
          if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
          else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
        }
      }
    }
    draw(ctx, outer, inner, flat) {
      const p = this.p, n = this.n;
      if (!this.ready) return;
      const L = [], Rr = [];
      for (let i = 0; i < n; i++) {
        const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)];
        let tx = b.x - a.x, ty = b.y - a.y;
        const d = Math.hypot(tx, ty) || 1; tx /= d; ty /= d;
        const w = K.lerp(this.w0, this.w1, i / (n - 1));
        L.push([p[i].x - ty * w, p[i].y + tx * w]);
        Rr.push([p[i].x + ty * w, p[i].y - tx * w]);
      }
      ctx.beginPath();
      ctx.moveTo(L[0][0], L[0][1]);
      for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
      // borde inferior en picos
      const last = p[n - 1];
      ctx.lineTo(last.x + (Rr[n - 1][0] - L[n - 1][0]) * 0.25, last.y + 4);
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(Rr[i][0], Rr[i][1]);
      ctx.closePath();
      if (!flat) { ctx.strokeStyle = OUT; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke(); }
      if (flat) ctx.fillStyle = outer;
      else {
        const g = ctx.createLinearGradient(p[0].x, p[0].y, last.x, last.y);
        g.addColorStop(0, K.shade(outer, 0.15)); g.addColorStop(1, K.shade(outer, -0.35));
        ctx.fillStyle = g;
      }
      ctx.fill();
      if (!flat) {
        ctx.strokeStyle = K.rgba(inner, 0.75); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(Rr[0][0], Rr[0][1]);
        for (let i = 1; i < n; i++) ctx.lineTo(Rr[i][0], Rr[i][1]);
        ctx.stroke();
      }
    }
  };

  // Retrato (primer plano) para los cuadros de diálogo.
  R.portrait = function (canvas, who, t = 0) {
    const c = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, W, H);
    const S = K.Styles[who] || K.Styles.kriss;
    const bgc = { kriss: '#5ff3ff', vexor: '#ff2a3a', korr: '#ff8a2a', nyra: '#ffb85a', explorer: '#ffd27a', soldier: '#ff3b3b' }[who] || '#5ff3ff';
    const g = c.createRadialGradient(W * 0.55, H * 0.4, 4, W * 0.5, H * 0.5, W * 0.75);
    g.addColorStop(0, K.rgba(bgc, 0.35)); g.addColorStop(1, 'rgba(4,4,12,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const sc = 4.4 / (S.scale || 1);
    c.save();
    c.translate(W * 0.46, H * 1.95);
    c.scale(sc, sc);
    if (S.cape) {
      c.fillStyle = S.cape[0];
      c.beginPath(); c.moveTo(-10, -42); c.lineTo(-17, -10); c.lineTo(6, -10); c.lineTo(2, -42); c.closePath(); c.fill();
    }
    R.draw(c, 0, 0, 1, P.talk(t), S, t);
    c.restore();
  };
})(window.K);
