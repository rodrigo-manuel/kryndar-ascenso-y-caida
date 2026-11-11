'use strict';
// ============================================================================
//  Ambientación visual de cada zona: cielo, capas de paralaje generadas por
//  código, baldosas pre-renderizadas, partículas ambientales e iluminación.
// ============================================================================
(function (K) {
  const TS = K.TS;
  const T = K.Themes = {};

  function mk(w, h, PR, fn) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * PR); c.height = Math.ceil(h * PR);
    const g = c.getContext('2d'); g.scale(PR, PR);
    fn(g, w, h);
    return { canvas: c, w, h };
  }
  function skyGrad(ctx, stops, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
    return g;
  }
  function haze(g, w, y0, y1, color, a) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, K.rgba(color, 0)); gr.addColorStop(1, K.rgba(color, a));
    g.fillStyle = gr; g.fillRect(0, y0, w, y1 - y0);
  }
  function ridge(g, w, h, base, amp, step, color, rnd, flat) {
    g.fillStyle = color;
    g.beginPath(); g.moveTo(0, h);
    let y = base;
    for (let x = 0; x <= w + step; x += step) {
      y = K.clamp(y + (rnd() - 0.5) * amp, base - amp * 1.4, base + amp * 0.6);
      if (flat && rnd() < 0.4) { g.lineTo(x, y); g.lineTo(x + step * 0.8, y); }
      else g.lineTo(x, y);
    }
    // cerrar en bucle con la altura inicial para que se pueda repetir
    g.lineTo(w, base); g.lineTo(w, h); g.closePath(); g.fill();
  }

  // ============================== CIELOS DINÁMICOS ==============================
  const stars = []; { const r = K.seeded(77); for (let i = 0; i < 140; i++) stars.push({ x: r() * K.W, y: r() * K.H * 0.6, s: r() * 1.4 + 0.3, p: r() * 6 }); }
  function drawStars(ctx, t, a) {
    ctx.fillStyle = '#ffffff';
    for (const s of stars) {
      ctx.globalAlpha = a * (0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + s.p)));
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  // ============================== TEMAS ==============================
  T.ruins = {
    name: 'ruins', music: 'ruins', darkness: 0,
    sky: ['#120a2a', '#341650', '#8a3a5e', '#e98450', '#f7b46a'],
    tile: { base: '#4a2e3e', dark: '#24141f', top: '#d48a5e', accent: '#5fe0b4', style: 'ruins' },
    fog: '#f08a4b',
    layers(PR) {
      const r = K.seeded(11);
      return [
        Object.assign(mk(1600, 540, PR, (g, w, h) => {
          ridge(g, w, h, 330, 70, 50, '#5c2c58', r, true);
          haze(g, w, 250, 540, '#e98450', 0.35);
        }), { f: 0.06 }),
        Object.assign(mk(1800, 540, PR, (g, w, h) => {
          for (let x = 20; x < w - 60; x += K.rand(70, 160)) {
            const tw = 30 + r() * 46, th = 110 + r() * 170, tx = x, ty = 420 - th;
            g.fillStyle = '#3a1a45';
            g.beginPath(); g.moveTo(tx, 540); g.lineTo(tx, ty + 12);
            for (let k = 0; k <= 4; k++) g.lineTo(tx + tw * k / 4, ty + r() * 22);
            g.lineTo(tx + tw, 540); g.closePath(); g.fill();
            g.fillStyle = 'rgba(255,170,110,0.18)';
            for (let wy = ty + 30; wy < 400; wy += 26) if (r() < 0.6) g.fillRect(tx + tw * 0.35, wy, tw * 0.3, 10);
          }
          g.fillStyle = '#3a1a45'; g.fillRect(0, 418, w, 122);
          haze(g, w, 300, 540, '#c45a5a', 0.3);
        }), { f: 0.2 }),
        Object.assign(mk(2000, 540, PR, (g, w, h) => {
          g.fillStyle = '#1f0c26';
          for (let x = 0; x < w; x += 260 + r() * 200) {
            const aw = 120 + r() * 80, ah = 150 + r() * 90, base = 470;
            g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - ah); g.lineTo(x + aw, base - ah - r() * 20); g.lineTo(x + aw, base);
            g.lineTo(x + aw - 22, base); g.lineTo(x + aw - 22, base - ah + 60);
            g.arc(x + aw / 2, base - ah + 60, aw / 2 - 22, 0, Math.PI, true);
            g.lineTo(x + 22, base); g.closePath(); g.fill();
            g.fillRect(x + aw + 40 + r() * 40, base - 90 - r() * 60, 16, 200);
          }
          g.fillRect(0, 466, w, 80);
        }), { f: 0.42 }),
      ];
    },
    dynamic(ctx, cam, t) {
      drawStars(ctx, t, 0.6);
      // planeta anillado
      const px = 700 - cam.x * 0.015, py = 150;
      const pg = ctx.createRadialGradient(px - 30, py - 30, 10, px, py, 95);
      pg.addColorStop(0, '#ffd9a8'); pg.addColorStop(0.5, '#d9785c'); pg.addColorStop(1, '#5a2244');
      ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, 90, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,214,170,0.5)'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(px, py, 160, 26, -0.25, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,214,170,0.22)'; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.ellipse(px, py, 185, 32, -0.25, 0, Math.PI * 2); ctx.stroke();
      K.FX.glow(ctx, px, py, 220, '#ff9a6a', 0.25);
      // luna pequeña
      ctx.fillStyle = '#e8e2ff'; ctx.beginPath(); ctx.arc(210 - cam.x * 0.01, 92, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#341650'; ctx.beginPath(); ctx.arc(218 - cam.x * 0.01, 86, 16, 0, Math.PI * 2); ctx.fill();
    },
    ambient(g, dt) {
      if (Math.random() < dt * 14) K.FX.spawn({ x: g.cam.x + Math.random() * K.W * 1.2, y: g.cam.y + Math.random() * K.H, vx: K.rand(20, 60), vy: K.rand(-10, 10), life: K.rand(2, 4), size: K.rand(1, 2.2), color: K.pick(['#ffc89a', '#ff9a6a', '#ffe8c8']), add: true });
    },
  };

  T.industrial = {
    name: 'industrial', music: 'industrial', darkness: 0.42, darkColor: '#020608',
    sky: ['#03060c', '#06121a', '#0b2228', '#16403a', '#2a6a4e'],
    tile: { base: '#27333b', dark: '#10171c', top: '#7f98a4', accent: '#e8b440', style: 'metal' },
    fog: '#2a6a4e',
    layers(PR) {
      const r = K.seeded(22);
      return [
        Object.assign(mk(1600, 540, PR, (g, w, h) => {
          for (let x = 0; x < w; x += 30 + r() * 50) {
            const bw = 40 + r() * 70, bh = 120 + r() * 200;
            g.fillStyle = '#0b1a22'; g.fillRect(x, 420 - bh, bw, bh + 120);
            for (let wy = 430 - bh; wy < 410; wy += 9) for (let wx = x + 4; wx < x + bw - 4; wx += 8) if (r() < 0.18) {
              g.fillStyle = r() < 0.6 ? 'rgba(255,200,100,0.5)' : 'rgba(110,230,255,0.45)'; g.fillRect(wx, wy, 3, 3);
            }
          }
          haze(g, w, 260, 540, '#2a6a4e', 0.45);
        }), { f: 0.07 }),
        Object.assign(mk(1800, 540, PR, (g, w, h) => {
          for (let x = 40; x < w; x += 140 + r() * 160) {
            const sw = 26 + r() * 14, sh = 200 + r() * 150;
            g.fillStyle = '#08121a'; g.fillRect(x, 460 - sh, sw, sh + 80);
            g.fillStyle = '#0e1c24'; for (let k = 0; k < 4; k++) g.fillRect(x - 3, 470 - sh + k * 40, sw + 6, 6);
            g.fillStyle = '#ff3b3b'; g.fillRect(x + sw / 2 - 2, 456 - sh, 4, 4);
            const tx = x + 60 + r() * 30, tr = 40 + r() * 30;
            g.fillStyle = '#0a161e'; g.beginPath(); g.arc(tx, 460 - tr, tr, Math.PI, 0); g.fill(); g.fillRect(tx - tr, 460 - tr, tr * 2, tr + 80);
          }
          g.fillStyle = '#08121a'; g.fillRect(0, 440, w, 100);
          g.fillStyle = '#0e1c24'; g.fillRect(0, 360, w, 8); g.fillRect(0, 380, w, 4);
          haze(g, w, 330, 540, '#1d4a40', 0.35);
        }), { f: 0.22 }),
        Object.assign(mk(2000, 540, PR, (g, w, h) => {
          g.strokeStyle = '#03070a'; g.fillStyle = '#03070a'; g.lineWidth = 6;
          for (let x = 0; x < w; x += 300 + r() * 200) {
            const top = 200 + r() * 120;
            g.fillRect(x, top, 14, 540); g.fillRect(x + 90, top, 14, 540);
            for (let y = top; y < 540; y += 60) { g.beginPath(); g.moveTo(x + 7, y); g.lineTo(x + 97, y + 60); g.moveTo(x + 97, y); g.lineTo(x + 7, y + 60); g.stroke(); }
          }
          g.fillRect(0, 480, w, 60);
        }), { f: 0.45 }),
      ];
    },
    dynamic(ctx, cam, t) {
      // reflectores que barren el cielo
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 2; i++) {
        const bx = 250 + i * 480 - ((cam.x * 0.1) % 960), a = -Math.PI / 2 + Math.sin(t * 0.4 + i * 2) * 0.55;
        const len = 650, sp = 0.09;
        const g = ctx.createLinearGradient(bx, 540, bx + Math.cos(a) * len, 540 + Math.sin(a) * len);
        g.addColorStop(0, 'rgba(160,240,255,0.16)'); g.addColorStop(1, 'rgba(160,240,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(bx, 540);
        ctx.lineTo(bx + Math.cos(a - sp) * len, 540 + Math.sin(a - sp) * len);
        ctx.lineTo(bx + Math.cos(a + sp) * len, 540 + Math.sin(a + sp) * len); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    },
    ambient(g, dt) {
      if (Math.random() < dt * 10) K.FX.spawn({ x: g.cam.x + Math.random() * K.W, y: g.cam.y - 10, vx: K.rand(-8, 8), vy: K.rand(20, 45), life: 6, size: K.rand(0.8, 1.8), color: '#9aa8b0' });
      if (Math.random() < dt * 1.5) K.FX.spawn({ x: g.cam.x + Math.random() * K.W, y: g.cam.y + K.H * 0.6 + Math.random() * 200, vx: K.rand(-10, 10), vy: -K.rand(15, 30), life: 4, size: K.rand(16, 30), grow: 2, color: '#3a4a50', type: 'smoke' });
    },
  };

  T.caves = {
    name: 'caves', music: 'caves', darkness: 0.8, darkColor: '#01030a',
    sky: ['#010207', '#030a14', '#06141f', '#0a1f2c'],
    tile: { base: '#1c2b3c', dark: '#0a121c', top: '#45678a', accent: '#5ff0ff', accent2: '#d06cff', style: 'cave' },
    fog: '#0a2a3a',
    layers(PR) {
      const r = K.seeded(33);
      const stal = (g, w, color, y0, y1, n, up) => {
        g.fillStyle = color;
        for (let i = 0; i < n; i++) {
          const x = r() * w, bw = 10 + r() * 40, len = 30 + r() * (y1 - y0);
          g.beginPath();
          if (!up) { g.moveTo(x - bw / 2, y0); g.lineTo(x, y0 + len); g.lineTo(x + bw / 2, y0); }
          else { g.moveTo(x - bw / 2, y1); g.lineTo(x, y1 - len); g.lineTo(x + bw / 2, y1); }
          g.fill();
        }
      };
      return [
        Object.assign(mk(1600, 540, PR, (g, w, h) => {
          g.fillStyle = '#06101a'; g.fillRect(0, 0, w, 60); g.fillRect(0, 470, w, 70);
          stal(g, w, '#06101a', 50, 200, 50, false); stal(g, w, '#06101a', 300, 480, 40, true);
          haze(g, w, 200, 540, '#0a3a4a', 0.3);
        }), { f: 0.08 }),
        Object.assign(mk(1800, 540, PR, (g, w, h) => {
          for (let i = 0; i < 14; i++) {
            const x = r() * w, y = 380 + r() * 120, c = r() < 0.6 ? '#5ff0ff' : '#d06cff';
            const gr = g.createRadialGradient(x, y - 20, 0, x, y - 20, 90);
            gr.addColorStop(0, K.rgba(c, 0.22)); gr.addColorStop(1, K.rgba(c, 0)); g.fillStyle = gr; g.fillRect(x - 90, y - 110, 180, 180);
            for (let k = 0; k < 5; k++) {
              const cx = x + (r() - 0.5) * 30, ch = 18 + r() * 40, cw = 5 + r() * 8, a = (r() - 0.5) * 0.7;
              g.save(); g.translate(cx, y); g.rotate(a);
              g.fillStyle = K.rgba(c, 0.55); g.beginPath(); g.moveTo(-cw, 0); g.lineTo(0, -ch); g.lineTo(cw, 0); g.closePath(); g.fill();
              g.restore();
            }
          }
          g.fillStyle = '#040b12'; g.fillRect(0, 0, w, 40); stal(g, w, '#040b12', 30, 160, 30, false);
          g.fillRect(0, 495, w, 45);
        }), { f: 0.22 }),
        Object.assign(mk(2000, 540, PR, (g, w, h) => {
          g.fillStyle = '#020509'; stal(g, w, '#020509', -10, 220, 18, false);
        }), { f: 0.45 }),
      ];
    },
    dynamic(ctx, cam, t) {},
    ambient(g, dt) {
      if (Math.random() < dt * 8) K.FX.spawn({ x: g.cam.x + Math.random() * K.W, y: g.cam.y + Math.random() * K.H, vx: K.rand(-10, 10), vy: K.rand(-12, -4), life: K.rand(2.5, 5), size: K.rand(3, 7), color: K.pick(['#5ff0ff', '#d06cff']), type: 'glow', add: true });
      if (Math.random() < dt * 3) K.FX.spawn({ x: g.cam.x + Math.random() * K.W, y: g.cam.y + 40, vy: 60, grav: 500, life: 1.6, size: 1.6, color: '#8fd8ff' });
    },
  };

  T.fortress = {
    name: 'fortress', music: 'fortress', darkness: 0.32, darkColor: '#080102',
    sky: ['#0a0206', '#22050e', '#4a0f14', '#7a2214', '#b0441a'],
    tile: { base: '#2e2228', dark: '#150e12', top: '#7a5658', accent: '#d0303a', style: 'brick' },
    fog: '#8a2a14',
    layers(PR) {
      const r = K.seeded(44);
      return [
        Object.assign(mk(1600, 540, PR, (g, w, h) => { ridge(g, w, h, 340, 90, 40, '#2a0a12', r); haze(g, w, 240, 540, '#b0441a', 0.35); }), { f: 0.06 }),
        Object.assign(mk(1800, 540, PR, (g, w, h) => {
          for (let x = 30; x < w; x += 120 + r() * 140) {
            const tw = 40 + r() * 40, th = 160 + r() * 180, ty = 440 - th;
            g.fillStyle = '#17060c'; g.fillRect(x, ty, tw, th + 100);
            g.beginPath(); g.moveTo(x - 6, ty); g.lineTo(x + tw / 2, ty - 50 - r() * 40); g.lineTo(x + tw + 6, ty); g.fill();
            for (let k = 0; k < 4; k++) if (r() < 0.7) { g.fillStyle = 'rgba(255,90,60,0.6)'; g.fillRect(x + tw / 2 - 3, ty + 20 + k * 34, 6, 12); }
            if (r() < 0.6) { g.fillStyle = '#5a0c14'; g.fillRect(x + tw + 4, ty + 30, 18, 70); g.fillStyle = '#17060c'; g.beginPath(); g.moveTo(x + tw + 4, ty + 100); g.lineTo(x + tw + 13, ty + 88); g.lineTo(x + tw + 22, ty + 100); g.fill(); }
          }
          g.fillStyle = '#17060c'; g.fillRect(0, 430, w, 110);
          for (let x = 0; x < w; x += 24) g.fillRect(x, 420, 14, 12);
          haze(g, w, 320, 540, '#7a2214', 0.3);
        }), { f: 0.22 }),
        Object.assign(mk(2000, 540, PR, (g, w, h) => {
          g.strokeStyle = '#070103'; g.lineWidth = 4; g.fillStyle = '#070103';
          for (let x = 0; x < w; x += 340 + r() * 220) {
            g.fillRect(x, 140 + r() * 100, 30, 500);
            g.beginPath(); for (let y = 0; y < 220; y += 12) { g.moveTo(x + 120, y); g.arc(x + 120, y + 6, 6, -Math.PI / 2, Math.PI * 1.5); } g.stroke();
          }
        }), { f: 0.45 }),
      ];
    },
    dynamic(ctx, cam, t) { K.FX.glow(ctx, 480, 640, 520, '#ff5a2a', 0.18 + Math.sin(t * 1.3) * 0.04); },
    ambient(g, dt) {
      if (Math.random() < dt * 16) K.FX.spawn({ x: g.cam.x + Math.random() * K.W, y: g.cam.y + K.H + 10, vx: K.rand(-20, 20), vy: -K.rand(30, 80), life: K.rand(3, 6), size: K.rand(1, 2.4), color: K.pick(['#ff8a3a', '#ffb050', '#ff5a2a']), add: true });
    },
  };

  T.tower = {
    name: 'tower', music: 'tower', darkness: 0,
    sky: ['#06041a', '#170c3e', '#3a1a6e', '#7a3aa8', '#d07ad8'],
    tile: { base: '#2a2442', dark: '#130f24', top: '#9a88d0', accent: '#b26cff', style: 'tech' },
    fog: '#7a3aa8',
    layers(PR) {
      const r = K.seeded(55);
      return [
        Object.assign(mk(1600, 1000, PR, (g, w, h) => {
          for (let i = 0; i < 26; i++) {
            const x = r() * w, y = r() * h, rw = 120 + r() * 220, rh = 30 + r() * 40;
            const gr = g.createRadialGradient(x, y, 0, x, y, rw);
            gr.addColorStop(0, 'rgba(230,200,255,0.16)'); gr.addColorStop(1, 'rgba(230,200,255,0)');
            g.fillStyle = gr; g.save(); g.translate(x, y); g.scale(1, rh / rw); g.beginPath(); g.arc(0, 0, rw, 0, 6.3); g.fill(); g.restore();
          }
        }), { f: 0.05, fy: 0.06, repeatY: true }),
        Object.assign(mk(1800, 1200, PR, (g, w, h) => {
          for (let i = 0; i < 9; i++) {
            const x = r() * w, y = r() * h, s = 30 + r() * 60;
            g.fillStyle = '#1a0f36';
            g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y - s * 0.1); g.lineTo(x + s * 0.4, y + s * 0.9); g.lineTo(x - s * 0.2, y + s * 1.3); g.closePath(); g.fill();
            g.fillStyle = 'rgba(178,108,255,0.35)'; g.fillRect(x - s * 0.6, y - 2, s * 1.2, 2);
          }
        }), { f: 0.14, fy: 0.15, repeatY: true }),
      ];
    },
    dynamic(ctx, cam, t) {
      drawStars(ctx, t, 0.8);
      // columna de energía del Núcleo
      const x = 480 - (cam.x - 0) * 0.2;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(x - 80, 0, x + 80, 0);
      g.addColorStop(0, 'rgba(178,108,255,0)'); g.addColorStop(0.5, `rgba(210,150,255,${0.22 + Math.sin(t * 2) * 0.05})`); g.addColorStop(1, 'rgba(178,108,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 80, 0, 160, K.H);
      ctx.fillStyle = 'rgba(255,230,255,0.25)'; ctx.fillRect(x - 3, 0, 6, K.H);
      for (let i = 0; i < 5; i++) {
        const y = K.H - ((t * 160 + i * 130 + cam.y * 0.3) % (K.H + 60));
        ctx.strokeStyle = 'rgba(220,180,255,0.35)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(x, y, 60, 10, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    },
    ambient(g, dt) {
      if (Math.random() < dt * 12) K.FX.spawn({ x: g.cam.x + Math.random() * K.W, y: g.cam.y + K.H + 10, vx: K.rand(-10, 10), vy: -K.rand(60, 140), life: K.rand(2, 4), size: K.rand(1, 2.2), color: K.pick(['#d0a0ff', '#b26cff', '#ffffff']), add: true });
    },
  };

  T.boss = {
    name: 'boss', music: 'boss', darkness: 0,
    sky: ['#030208', '#0d0618', '#1e0c2c', '#3a1028', '#5a1a24'],
    tile: { base: '#241e34', dark: '#100c1a', top: '#8c80b0', accent: '#ff3a5a', style: 'tech' },
    fog: '#5a1a24',
    layers(PR) {
      const r = K.seeded(66);
      return [
        Object.assign(mk(1600, 540, PR, (g, w, h) => {
          for (let i = 0; i < 30; i++) {
            const x = r() * w, y = r() * 260, rw = 160 + r() * 200;
            const gr = g.createRadialGradient(x, y, 0, x, y, rw);
            gr.addColorStop(0, 'rgba(10,5,18,0.85)'); gr.addColorStop(1, 'rgba(10,5,18,0)');
            g.fillStyle = gr; g.fillRect(x - rw, y - rw, rw * 2, rw * 2);
          }
        }), { f: 0.04 }),
        Object.assign(mk(1800, 540, PR, (g, w, h) => {
          for (let x = 0; x < w; x += 90 + r() * 120) {
            const tw = 20 + r() * 30, th = 60 + r() * 120;
            g.fillStyle = '#0a0612'; g.fillRect(x, 470 - th, tw, th + 80);
            g.fillStyle = 'rgba(255,58,90,0.5)'; g.fillRect(x + tw / 2 - 1, 470 - th + 6, 2, 2);
          }
          g.fillStyle = '#0a0612'; g.fillRect(0, 466, w, 80);
        }), { f: 0.15 }),
      ];
    },
    dynamic() {},
    front(ctx, cam, t, g) {
      // el Núcleo de Solthar, gigantesco, latiendo sobre la arena (delante de las nubes)
      const cx = 480 - cam.x * 0.05, cy = 150, R = 105 + Math.sin(t * 2.2) * 4;
      K.FX.glow(ctx, cx, cy, R * 3.2, '#ff5a3a', 0.35);
      const gr = ctx.createRadialGradient(cx - 20, cy - 25, 8, cx, cy, R);
      gr.addColorStop(0, '#fff2d0'); gr.addColorStop(0.3, '#ffb060'); gr.addColorStop(0.7, '#d0306a'); gr.addColorStop(1, '#4a0c3a');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(cx, cy);
      ctx.strokeStyle = 'rgba(255,230,200,0.7)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) {
        const a = i * 0.9 + t * 0.1;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20);
        ctx.lineTo(Math.cos(a + 0.2) * 60, Math.sin(a + 0.2) * 60); ctx.lineTo(Math.cos(a) * (R - 4), Math.sin(a) * (R - 4)); ctx.stroke();
      }
      ctx.rotate(t * 0.3);
      ctx.strokeStyle = 'rgba(255,90,120,0.5)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, R * 1.55, R * 0.32, 0.3, 0, Math.PI * 2); ctx.stroke();
      ctx.rotate(-t * 0.7);
      ctx.strokeStyle = 'rgba(200,120,255,0.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, R * 1.35, R * 0.22, -0.6, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      // relámpagos
      if (g && g.lightning > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(220,200,255,${g.lightning})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); let x = g.boltX, y = 0; ctx.moveTo(x, y);
        const rr = K.seeded(g.boltSeed);
        while (y < 380) { x += (rr() - 0.5) * 60; y += 20 + rr() * 30; ctx.lineTo(x, y); }
        ctx.stroke(); ctx.restore();
        ctx.fillStyle = `rgba(200,180,255,${g.lightning * 0.25})`; ctx.fillRect(0, 0, K.W, K.H);
      }
    },
    ambient(g, dt) {
      for (let i = 0; i < 2; i++) if (Math.random() < dt * 40) K.FX.spawn({ x: g.cam.x + Math.random() * (K.W + 200), y: g.cam.y - 20, vx: -160, vy: 700, life: 0.9, size: 1, len: 0.03, color: 'rgba(170,160,220,0.6)', type: 'spark' });
      if (Math.random() < dt * 0.25 && g.lightning <= 0) { g.lightning = 1; g.boltX = K.rand(80, 880); g.boltSeed = K.randi(1, 9999); K.Audio.sfx('thunder'); }
    },
  };

  // ============================== CIELO + PARALAJE ==============================
  const layerCache = {};
  T.getLayers = function (theme, PR) {
    const key = theme.name + '@' + PR;
    if (!layerCache[key]) layerCache[key] = theme.layers(PR);
    return layerCache[key];
  };
  T.drawBackground = function (ctx, theme, cam, t, PR, map, g) {
    ctx.fillStyle = skyGrad(ctx, theme.sky, K.H);
    ctx.fillRect(0, 0, K.W, K.H);
    theme.dynamic(ctx, cam, t, g);
    const refY = map ? map.ph - K.H : 0;
    for (const L of T.getLayers(theme, PR)) {
      let ox = -((cam.x * L.f) % L.w); if (ox > 0) ox -= L.w;
      if (L.repeatY) {
        let oy = -((cam.y * L.fy) % L.h); if (oy > 0) oy -= L.h;
        for (let y = oy; y < K.H; y += L.h) for (let x = ox; x < K.W; x += L.w) ctx.drawImage(L.canvas, x, y, L.w, L.h);
      } else {
        const oy = -(cam.y - refY) * (L.fy || L.f * 0.5);
        for (let x = ox; x < K.W; x += L.w) ctx.drawImage(L.canvas, x, oy, L.w, L.h);
        }
      if (L === T.getLayers(theme, PR)[0] && theme.front) theme.front(ctx, cam, t, g);
    }
  };

  // ============================== BALDOSAS ==============================
  function isRock(map, x, y) {
    if (x < 0 || x >= map.w) return true;
    if (y < 0 || y >= map.h) return y >= map.h ? true : false;
    return map.ch[y][x] === '#';
  }
  T.prerender = function (map, theme, PR) {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(map.pw * PR); cv.height = Math.ceil(map.ph * PR);
    const c = cv.getContext('2d'); c.scale(PR, PR);
    const P = theme.tile, st = P.style;
    const rnd = K.seeded(map.w * 31 + map.h);
    const lights = [];
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const ch = map.ch[y][x];
      const X = x * TS, Y = y * TS;
      if (ch === '#') {
        const up = !isRock(map, x, y - 1), dn = !isRock(map, x, y + 1), lf = !isRock(map, x - 1, y), rt = !isRock(map, x + 1, y);
        let depth = 0;
        if (!up && !dn && !lf && !rt) {
          depth = 1;
          if (isRock(map, x, y - 2) && isRock(map, x - 2, y) && isRock(map, x + 2, y) && isRock(map, x, y + 2)) depth = 2;
        }
        const base = depth === 0 ? P.base : depth === 1 ? K.mix(P.base, P.dark, 0.55) : P.dark;
        c.fillStyle = base; c.fillRect(X - 0.3, Y - 0.3, TS + 0.6, TS + 0.6);
        // textura según estilo
        if (st === 'ruins') {
          c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 1;
          for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(X, Y + k * 8 + 0.5); c.lineTo(X + TS, Y + k * 8 + 0.5); c.stroke(); const off = ((y * 4 + k) % 2) * 12 + 4; c.beginPath(); c.moveTo(X + off + 0.5, Y + k * 8); c.lineTo(X + off + 0.5, Y + k * 8 + 8); c.moveTo(X + off + 16.5, Y + k * 8); c.lineTo(X + off + 16.5, Y + k * 8 + 8); c.stroke(); }
        } else if (st === 'metal' || st === 'tech') {
          c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1; c.strokeRect(X + 1.5, Y + 1.5, TS - 3, TS - 3);
          c.strokeStyle = 'rgba(255,255,255,0.05)'; c.beginPath(); c.moveTo(X + 2, Y + 2.5); c.lineTo(X + TS - 2, Y + 2.5); c.stroke();
          if (st === 'metal' && depth < 2) { c.fillStyle = 'rgba(255,255,255,0.12)'; [[4, 4], [TS - 6, 4], [4, TS - 6], [TS - 6, TS - 6]].forEach(([a, b]) => c.fillRect(X + a, Y + b, 2, 2)); }
          if (st === 'tech' && rnd() < 0.22) { c.fillStyle = K.rgba(P.accent, 0.55); if (rnd() < 0.5) c.fillRect(X + 4, Y + 15, TS - 8, 1.5); else c.fillRect(X + 15, Y + 4, 1.5, TS - 8); }
        } else if (st === 'brick') {
          c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1;
          for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(X, Y + k * 8 + 0.5); c.lineTo(X + TS, Y + k * 8 + 0.5); c.stroke(); const off = (k % 2) * 8; for (let q = off; q < TS; q += 16) { c.beginPath(); c.moveTo(X + q + 0.5, Y + k * 8); c.lineTo(X + q + 0.5, Y + k * 8 + 8); c.stroke(); } }
        } else if (st === 'cave') {
          c.fillStyle = 'rgba(255,255,255,0.03)';
          for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(X + rnd() * TS, Y + rnd() * TS, 3 + rnd() * 6, 0, 6.3); c.fill(); }
        }
        for (let k = 0; k < 3; k++) { c.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.04)'; c.fillRect(X + rnd() * 28, Y + rnd() * 28, 2 + rnd() * 3, 2 + rnd() * 2); }
        // bordes
        if (lf) { c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(X, Y, 2, TS); }
        if (rt) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(X + TS - 3, Y, 3, TS); }
        if (dn) {
          c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(X, Y + TS - 4, TS, 4);
          if (st === 'cave' && rnd() < 0.5) { c.fillStyle = base; c.beginPath(); const sx = X + 6 + rnd() * 20; c.moveTo(sx - 5, Y + TS); c.lineTo(sx, Y + TS + 8 + rnd() * 10); c.lineTo(sx + 5, Y + TS); c.fill(); }
        }
        if (up) {
          const gr = c.createLinearGradient(0, Y, 0, Y + 9);
          gr.addColorStop(0, P.top); gr.addColorStop(1, K.rgba(P.top, 0));
          c.fillStyle = gr; c.fillRect(X, Y, TS, 9);
          c.fillStyle = K.shade(P.top, 0.25); c.fillRect(X, Y, TS, 2);
          if (st === 'ruins') {
            c.strokeStyle = P.accent; c.lineWidth = 1.3; c.lineCap = 'round';
            for (let k = 0; k < 6; k++) { const gx = X + rnd() * TS, gh = 3 + rnd() * 6; c.beginPath(); c.moveTo(gx, Y + 1); c.quadraticCurveTo(gx + 1, Y - gh * 0.5, gx + (rnd() - 0.3) * 4, Y - gh); c.stroke(); }
          } else if (st === 'metal') {
            if ((x + y) % 5 === 0) { c.fillStyle = P.accent; for (let q = 0; q < TS; q += 8) { c.beginPath(); c.moveTo(X + q, Y + 4); c.lineTo(X + q + 4, Y + 2); c.lineTo(X + q + 8, Y + 2); c.lineTo(X + q + 4, Y + 4); c.fill(); } }
          } else if (st === 'cave') {
            if (rnd() < 0.2) {
              const col = rnd() < 0.65 ? P.accent : P.accent2, cx = X + 6 + rnd() * 20;
              for (let k = 0; k < 3; k++) {
                const h = 7 + rnd() * 12, w = 2.5 + rnd() * 2.5, a = (k - 1) * 0.35 + (rnd() - 0.5) * 0.2;
                c.save(); c.translate(cx + (k - 1) * 3, Y + 1); c.rotate(a);
                const cg = c.createLinearGradient(0, 0, 0, -h); cg.addColorStop(0, K.rgba(col, 0.5)); cg.addColorStop(1, K.shade(col, 0.6));
                c.fillStyle = cg; c.beginPath(); c.moveTo(-w, 0); c.lineTo(0, -h); c.lineTo(w, 0); c.closePath(); c.fill();
                c.restore();
              }
              lights.push({ x: cx, y: Y - 6, r: 90, color: col });
            } else if (rnd() < 0.3) {
              c.fillStyle = '#2a5a4a'; for (let k = 0; k < 4; k++) c.fillRect(X + rnd() * TS, Y - 2, 2, 3);
            }
          } else if (st === 'brick') {
            if (x % 2 === 0) { c.fillStyle = K.shade(P.top, -0.2); c.fillRect(X + 4, Y - 6, 12, 6); c.fillStyle = K.shade(P.top, 0.2); c.fillRect(X + 4, Y - 6, 12, 1.5); }
          } else if (st === 'tech') {
            c.fillStyle = K.rgba(P.accent, 0.8); c.fillRect(X, Y + 3, TS, 1);
          }
        }
      } else if (ch === '-') {
        const lf = map.ch[y][x - 1] !== '-', rt = map.ch[y][x + 1] !== '-';
        const gr = c.createLinearGradient(0, Y, 0, Y + 10);
        gr.addColorStop(0, K.shade(P.top, 0.1)); gr.addColorStop(1, K.shade(P.base, -0.3));
        c.fillStyle = gr; c.fillRect(X, Y, TS, 9);
        c.fillStyle = K.shade(P.top, 0.35); c.fillRect(X, Y, TS, 2);
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(X, Y + 8, TS, 2);
        if (st === 'metal' || st === 'tech') { c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 1; for (let q = 4; q < TS; q += 6) { c.beginPath(); c.moveTo(X + q, Y + 3); c.lineTo(X + q, Y + 8); c.stroke(); } }
        if (lf || rt) { c.fillStyle = K.shade(P.base, -0.2); const bx = lf ? X + 2 : X + TS - 6; c.beginPath(); c.moveTo(bx, Y + 9); c.lineTo(bx + 4, Y + 9); c.lineTo(lf ? bx + 1 : bx + 3, Y + 18); c.fill(); }
      } else if (ch === '^') {
        for (let k = 0; k < 4; k++) {
          const sx = X + k * 8;
          const gr = c.createLinearGradient(sx, Y + TS, sx + 4, Y + 12);
          gr.addColorStop(0, '#3a3f4a'); gr.addColorStop(0.7, '#b8c0cc'); gr.addColorStop(1, '#ffd0d0');
          c.fillStyle = gr; c.beginPath(); c.moveTo(sx, Y + TS); c.lineTo(sx + 4, Y + 13 + (k % 2) * 3); c.lineTo(sx + 8, Y + TS); c.closePath(); c.fill();
        }
        c.fillStyle = '#20232a'; c.fillRect(X, Y + TS - 4, TS, 4);
      }
    }
    return { canvas: cv, lights };
  };

  // ============================== ILUMINACIÓN ==============================
  let darkCv = null;
  T.drawDarkness = function (ctx, theme, lights, viewScale, extra = 0) {
    const a = K.clamp(theme.darkness + extra, 0, 0.96);
    if (a <= 0.01) return;
    const pw = ctx.canvas.width, ph = ctx.canvas.height;
    if (!darkCv) darkCv = document.createElement('canvas');
    if (darkCv.width !== pw || darkCv.height !== ph) { darkCv.width = pw; darkCv.height = ph; }
    const d = darkCv.getContext('2d');
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, pw, ph);
    d.fillStyle = K.rgba(theme.darkColor || '#000000', a);
    d.fillRect(0, 0, pw, ph);
    d.setTransform(viewScale, 0, 0, viewScale, 0, 0);
    d.globalCompositeOperation = 'destination-out';
    const hole = K.FX.glowSprite('#ffffff');
    for (const L of lights) {
      if (L.x < -L.r || L.x > K.W + L.r || L.y < -L.r || L.y > K.H + L.r) continue;
      d.globalAlpha = L.a === undefined ? 1 : L.a;
      d.drawImage(hole, L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    d.globalAlpha = 1;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(darkCv, 0, 0); ctx.restore();
    // tinte de color de las luces
    for (const L of lights) if (L.color && L.tint !== false) K.FX.glow(ctx, L.x, L.y, L.r * 0.7, L.color, 0.18);
  };

  let vignette = null;
  T.drawVignette = function (ctx) {
    if (!vignette) {
      vignette = document.createElement('canvas'); vignette.width = 480; vignette.height = 270;
      const g = vignette.getContext('2d');
      const gr = g.createRadialGradient(240, 135, 90, 240, 135, 300);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.62)');
      g.fillStyle = gr; g.fillRect(0, 0, 480, 270);
    }
    ctx.drawImage(vignette, 0, 0, K.W, K.H);
  };
})(window.K);
