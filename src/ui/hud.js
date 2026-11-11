'use strict';
// ============================================================================
//  HUD dibujado en el canvas: barra de energía dinámica (verde/amarillo/rojo),
//  contador de detecciones / Alerta Máxima, fragmentos, habilidades, barra de
//  jefe, avisos ("toasts") e indicaciones de interacción.
// ============================================================================
(function (K) {
  const H = K.HUD = {};

  function panel(ctx, x, y, w, h, a = 0.62) {
    ctx.fillStyle = `rgba(6,8,20,${a})`;
    ctx.beginPath(); ctx.moveTo(x + 8, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - 8); ctx.lineTo(x + w - 8, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(95,243,255,0.22)'; ctx.lineWidth = 1; ctx.stroke();
  }
  function energyColor(pct) { return pct > 0.5 ? ['#3dff9a', '#14b86a'] : pct > 0.25 ? ['#ffe14a', '#d69a12'] : ['#ff4a5a', '#b0122a']; }

  H.draw = function (ctx, g) {
    const p = g.player, t = g.time;
    ctx.save();
    ctx.textBaseline = 'middle';
    // ---------- Energía ----------
    const x = 18, y = 16, w = 270;
    panel(ctx, x, y, w + 24, 50);
    ctx.font = K.font(11, 700, 'Orbitron'); ctx.fillStyle = '#9fb3d9'; ctx.textAlign = 'left';
    ctx.fillText('ENERGÍA', x + 12, y + 13);
    const pct = K.clamp(p.energy / p.maxE, 0, 1);
    H.shown = H.shown === undefined ? pct : K.approach(H.shown, pct, 0.006 + Math.abs(H.shown - pct) * 0.06);
    const [c1, c2] = energyColor(pct);
    const bx = x + 12, by = y + 23, bw = w, bh = 14;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, by, bw, bh);
    if (H.shown > pct) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(bx, by, bw * H.shown, bh); }
    const gr = ctx.createLinearGradient(0, by, 0, by + bh); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    ctx.fillStyle = gr; ctx.fillRect(bx, by, bw * pct, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(bx, by, bw * pct, 3);
    for (let i = 1; i < 10; i++) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(bx + bw * i / 10, by, 1, bh); }
    if (pct <= 0.25 && pct > 0) { ctx.strokeStyle = `rgba(255,74,90,${0.5 + Math.sin(t * 10) * 0.5})`; ctx.lineWidth = 2; ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4); }
    if (p.flying) K.FX.glow(ctx, bx + bw * pct, by + bh / 2, 16, c1, 0.8);
    ctx.font = K.font(13, 700); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'right';
    ctx.fillText(Math.ceil(p.energy) + ' / ' + p.maxE, x + w + 12, y + 13);

    // ---------- Detecciones / Alerta ----------
    let yy = y + 58;
    if (g.level.stealth) {
      panel(ctx, x, yy, 200, 28);
      ctx.textAlign = 'left';
      if (g.alertMax) {
        ctx.font = K.font(12, 900, 'Orbitron');
        ctx.fillStyle = Math.floor(t * 4) % 2 ? '#ff4258' : '#ffb0b8';
        ctx.fillText('⚠ ALERTA MÁXIMA', x + 12, yy + 14);
      } else {
        ctx.font = K.font(11, 700, 'Orbitron'); ctx.fillStyle = '#9fb3d9';
        ctx.fillText('DETECCIONES', x + 12, yy + 14);
        for (let i = 0; i < 3; i++) {
          const ex = x + 128 + i * 22, ey = yy + 14, on = i < g.detections;
          ctx.strokeStyle = on ? '#ff4258' : 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.ellipse(ex, ey, 8, 5, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = on ? '#ff4258' : 'rgba(255,255,255,0.25)';
          ctx.beginPath(); ctx.arc(ex, ey, 2.6, 0, Math.PI * 2); ctx.fill();
          if (on) K.FX.glow(ctx, ex, ey, 12, '#ff4258', 0.6);
        }
      }
      yy += 36;
    }

    // ---------- Fragmentos ----------
    const n = g.fragmentCount();
    const fx = K.W - 18 - 220;
    panel(ctx, fx, y, 220, 50);
    ctx.font = K.font(11, 700, 'Orbitron'); ctx.fillStyle = '#9fb3d9'; ctx.textAlign = 'left';
    ctx.fillText('FRAGMENTOS', fx + 12, y + 13);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffcf6b'; ctx.fillText(n + ' / 5', fx + 208, y + 13);
    for (let i = 0; i < 5; i++) {
      const cx = fx + 28 + i * 40, cy = y + 33, on = i < n;
      ctx.save(); ctx.translate(cx, cy);
      ctx.fillStyle = on ? '#ffcf6b' : 'rgba(255,255,255,0.08)'; ctx.strokeStyle = on ? '#fff3cf' : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, -2); ctx.lineTo(3, 8); ctx.lineTo(-4, 7); ctx.lineTo(-6, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
      if (on) K.FX.glow(ctx, cx, cy, 16, '#c48aff', 0.6 + Math.sin(t * 3 + i) * 0.2);
    }

    // ---------- Habilidades ----------
    const ab = g.abilities;
    const skills = [
      { k: 'ESPACIO', n: 'Vuelo', on: true },
      { k: 'CLIC', n: 'Golpe', on: true },
      { k: 'MANTÉN', n: 'Cargado', on: ab.charge },
      { k: 'SHIFT', n: 'Dash', on: ab.dash, cd: p.dashCD / 0.62 },
      { k: 'E', n: 'Usar', on: ab.interact },
      { k: 'Q', n: 'Grito', on: ab.shout, cd: p.resistCD / 1.4 },
    ].filter(s => s.on);
    let sx = 18; const sy = K.H - 48;
    for (const s of skills) {
      ctx.font = K.font(10, 700, 'Orbitron');
      const kw = Math.max(26, ctx.measureText(s.k).width + 12);
      ctx.font = K.font(13, 600);
      const nw = ctx.measureText(s.n).width;
      const w2 = kw + nw + 16;
      panel(ctx, sx, sy, w2, 30, 0.5);
      ctx.fillStyle = 'rgba(95,243,255,0.14)'; ctx.fillRect(sx + 5, sy + 6, kw, 18);
      if (s.cd > 0) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(sx + 5, sy + 6, kw * K.clamp(s.cd, 0, 1), 18); }
      ctx.font = K.font(10, 700, 'Orbitron'); ctx.fillStyle = s.cd > 0 ? '#667' : '#5ff3ff'; ctx.textAlign = 'center';
      ctx.fillText(s.k, sx + 5 + kw / 2, sy + 15.5);
      ctx.font = K.font(13, 600); ctx.fillStyle = '#d8e4ff'; ctx.textAlign = 'left';
      ctx.fillText(s.n, sx + kw + 11, sy + 15.5);
      sx += w2 + 6;
    }

    // ---------- Barra del jefe ----------
    const boss = g.bossBar;
    if (boss && !boss.dead && boss.state !== 'wait' && boss.state !== 'intro') {
      const bw2 = 440, bx2 = (K.W - bw2) / 2, by2 = K.H - 92;
      panel(ctx, bx2 - 14, by2 - 22, bw2 + 28, 44, 0.7);
      ctx.font = K.font(12, 900, 'Orbitron'); ctx.fillStyle = '#ffb0b8'; ctx.textAlign = 'center';
      ctx.fillText(boss.name, K.W / 2, by2 - 9);
      const bp = K.clamp(boss.hp / boss.maxHp, 0, 1);
      H.bossShown = H.bossShown === undefined ? bp : K.approach(H.bossShown, bp, 0.004);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx2, by2 + 2, bw2, 10);
      ctx.fillStyle = 'rgba(255,220,220,0.6)'; ctx.fillRect(bx2, by2 + 2, bw2 * H.bossShown, 10);
      const bg = ctx.createLinearGradient(0, by2, 0, by2 + 12); bg.addColorStop(0, '#ff5a6a'); bg.addColorStop(1, '#a0102a');
      ctx.fillStyle = bg; ctx.fillRect(bx2, by2 + 2, bw2 * bp, 10);
      if (boss.vulnerable) { ctx.strokeStyle = `rgba(95,243,255,${0.6 + Math.sin(t * 12) * 0.4})`; ctx.lineWidth = 2; ctx.strokeRect(bx2 - 2, by2, bw2 + 4, 14); }
    }

    // ---------- Avisos ----------
    let ty = 118;
    for (const tt of g.toasts) {
      if (tt.delay > 0) continue;
      const a = K.clamp(Math.min(tt.life, tt.max - tt.life) * 4, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = K.font(tt.big ? 22 : 17, 700, tt.big ? 'Orbitron' : 'Rajdhani');
      const tw = ctx.measureText(tt.text).width + 40, th = tt.big ? 40 : 32;
      const tx = (K.W - tw) / 2;
      ctx.fillStyle = 'rgba(6,8,20,0.78)'; ctx.fillRect(tx, ty, tw, th);
      ctx.fillStyle = tt.color; ctx.fillRect(tx, ty, 3, th); ctx.fillRect(tx + tw - 3, ty, 3, th);
      ctx.textAlign = 'center'; ctx.fillStyle = tt.color;
      ctx.fillText(tt.text, K.W / 2, ty + th / 2 + 1);
      ty += th + 8;
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };

  // Indicación [E] sobre objetos interactivos (en coordenadas del mundo).
  H.prompt = function (ctx, x, y, text, t) {
    ctx.save();
    const by = y + Math.sin(t * 4) * 2;
    ctx.font = K.font(13, 700);
    const w = ctx.measureText(text).width + 36;
    ctx.fillStyle = 'rgba(6,8,20,0.82)'; ctx.fillRect(x - w / 2, by - 12, w, 24);
    ctx.strokeStyle = 'rgba(95,243,255,0.6)'; ctx.strokeRect(x - w / 2 + 0.5, by - 11.5, w - 1, 23);
    ctx.fillStyle = '#5ff3ff'; ctx.fillRect(x - w / 2 + 4, by - 8, 18, 16);
    ctx.fillStyle = '#04121a'; ctx.font = K.font(11, 900, 'Orbitron'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('E', x - w / 2 + 13, by + 0.5);
    ctx.fillStyle = '#e8f6ff'; ctx.font = K.font(13, 700); ctx.textAlign = 'left';
    ctx.fillText(text, x - w / 2 + 28, by + 1);
    ctx.restore();
  };
})(window.K);
