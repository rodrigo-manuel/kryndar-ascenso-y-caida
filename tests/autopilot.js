'use strict';
// ============================================================================
//  Piloto automático de pruebas (solo para QA). Se carga desde la consola o
//  con tests/playtest.html. Recorre un nivel siguiendo puntos de paso (en
//  baldosas) usando las MISMAS entradas que un jugador (teclas simuladas).
//  Uso:  await KTest.run(nivel, { god: false })
// ============================================================================
(function (K) {
  const T = window.KTest = {};
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const I = () => K.Input;
  function release() { const i = I(); for (const k of ['KeyA', 'KeyD', 'Space', 'KeyS', 'KeyJ', 'ShiftLeft', 'KeyE', 'KeyQ']) i.down[k] = false; i.mouseDown = false; }
  function press(code) { I().pressed[code] = true; I().down[code] = true; setTimeout(() => { I().down[code] = false; }, 60); }

  // Rutas por nivel: {x, y} en baldosas = posición de los pies a alcanzar.
  // Opciones: e (pulsar E al llegar), dash (dash al pasar), hit/charge (golpear), wait (s)
  T.ROUTES = {
    0: [{ x: 12, y: 14 }, { x: 19, y: 10 }, { x: 28, y: 14 }, { x: 47, y: 14, fly: 1 }, { x: 54, y: 14 }, { x: 72, y: 14 }, { x: 78, y: 5, fly: 1 }, { x: 89, y: 4, fly: 1 }, { x: 94, y: 9 }, { x: 118, y: 14 }],
    1: [{ x: 16, y: 14 }, { x: 22, y: 9, fly: 1 }, { x: 29, y: 9 }, { x: 40, y: 5, fly: 1 }, { x: 58, y: 5 }, { x: 59, y: 14 }, { x: 69, y: 14, fly: 1 }, { x: 75, y: 8, fly: 1 }, { x: 87, y: 8 }, { x: 92, y: 8, fly: 1 }, { x: 100, y: 9 }, { x: 109, y: 14 }, { x: 113, y: 10, fly: 1 }, { x: 121, y: 7, fly: 1 }, { x: 145, y: 14 }],
    2: [{ x: 14, y: 16, e: 1 }, { x: 26, y: 16, e: 1 }, { x: 43, y: 16, rush: 1 }, { x: 47, y: 16, charge: 1 }, { x: 55, y: 16 }, { x: 65, y: 16, fly: 1 }, { x: 69, y: 10, fly: 1, e: 1 }, { x: 74, y: 16 }, { x: 82, y: 16, e: 1 }, { x: 98, y: 16 }, { x: 101, y: 16, e: 1 }, { x: 117, y: 16, rush: 1 }, { x: 127, y: 16 }],
    3: [{ x: 37, y: 14 }, { x: 43, y: 14, charge: 1 }, { x: 72, y: 14 }, { x: 84, y: 14 }, { x: 100, y: 14, wait: 0.3 }, { x: 0, y: 0, frag: 1, fly: 1 }, { x: 117, y: 14 }, { x: 136, y: 14 }],
    4: [{ x: 16, y: 102, fly: 1 }, { x: 28, y: 97, fly: 1 }, { x: 13, y: 92, fly: 1 }, { x: 27, y: 87, fly: 1 }, { x: 27, y: 87, waitOff: 1 }, { x: 10, y: 77, fly: 1 }, { x: 22, y: 71, fly: 1 }, { x: 31, y: 66, fly: 1 }, { x: 34, y: 61, fly: 1 }, { x: 11, y: 50, stairs: 1 }, { x: 22, y: 44, fly: 1 }, { x: 30, y: 39, fly: 1 }, { x: 30, y: 39, waitOff: 1 }, { x: 10, y: 28, fly: 1 }, { x: 24, y: 23, fly: 1 }, { x: 33, y: 18, fly: 1 }, { x: 34, y: 11, fly: 1 }, { x: 20, y: 12 }, { x: 28, y: 12 }],
  };

  T.log = [];
  T.run = async function (lvl, opt = {}) {
    const G = K.Game;
    G.startLevel(lvl);
    const p = () => G.player;
    const route = T.ROUTES[lvl];
    const out = { lvl, reached: 0, total: route.length, deaths: 0, detections: 0, stuck: null, time: 0, done: false, errors: [] };
    let deadSeen = false;
    const t0 = performance.now();
    for (let wi = 0; wi < route.length; wi++) {
      const w = route[wi];
      let tx = w.x * 32 + 16, ty = w.y * 32;
      let best = 1e9, lastBest = performance.now();
      while (true) {
        await wait(16);
        if (G.levelIdx !== lvl) { out.done = true; break; }
        if (G.state === 'dialog') { K.Dialog.advance(); continue; }
        if (opt.god) { p().invT = 1; p().energy = Math.max(p().energy, 40); }
        if (!p().alive) { if (!deadSeen) { out.deaths++; deadSeen = true; } release(); continue; }
        deadSeen = false;
        const pl = p();
        if (w.frag) { const f = G.props.find(o => o.kind === 'fragment' && !o.taken); if (!f) { if (G.fragmentTaken) break; continue; } tx = f.x; ty = f.y + 20; }
        const dx = tx - pl.cx, dy = ty - pl.bottom;
        const i = I();
        if (w.waitOff && G.zoneState(2) !== 'off') { release(); if (G.time % 6 > 5.95 || G.zoneState(2) === 'on') { } continue; }
        if (w.waitOff && G.zoneState(2) === 'off') { break; }
        i.down.KeyD = dx > 6; i.down.KeyA = dx < -6;
        if (pl.hitWall && Math.abs(dx) > 20) T.climb = performance.now() + 450;
        const needUp = dy < -8 || performance.now() < (T.climb || 0);
        if (w.stairs) {
          // escalera: saltar cada vez que choca con un escalón
          if (pl.onGround && (pl.hitWall || Math.abs(pl.vx) < 20) && needUp) press('Space');
        } else if (needUp || (w.fly && Math.abs(dx) > 40 && pl.bottom > ty - 40)) {
          if (pl.onGround) press('Space');
          i.down.Space = true;
        } else i.down.Space = false;
        if (dy > 40 && Math.abs(dx) < 40 && pl.onGround && !T.dropT) { press('KeyS'); T.dropT = 1; setTimeout(() => T.dropT = 0, 400); }
        if (w.rush && Math.abs(dx) > 60 && pl.dashCD <= 0) press('ShiftLeft');
        // pelear contra enemigos cercanos que nos bloquean
        const foe = G.enemies.find(e => !e.dead && e.state !== 'wait' && e.state !== 'intro' && Math.abs(e.cx - pl.cx) < 60 && Math.abs(e.cy - pl.cy) < 50);
        const boss = G.korrFight && G.korr && !G.korr.dead ? G.korr : null;
        if (boss) {
          // pelea real: golpe cargado (rompe la guardia), dash para esquivar la embestida
          const k = boss; i.down.KeyD = i.down.KeyA = false; i.down.Space = false;
          const kd = k.cx - pl.cx;
          if (k.state === 'chargeWind' || k.state === 'charge') { if (pl.dashCD <= 0 && Math.abs(kd) < 220) { pl.facing = -K.sign(kd); i.down[kd > 0 ? 'KeyA' : 'KeyD'] = true; press('ShiftLeft'); } else { i.down.Space = true; if (pl.onGround) press('Space'); } }
          else if (Math.abs(kd) > 70) i.down[kd > 0 ? 'KeyD' : 'KeyA'] = true;
          else if (!pl.charging && pl.atkT <= 0) { pl.facing = K.sign(kd); i.pressed.KeyJ = true; i.down.KeyJ = true; setTimeout(() => { I().down.KeyJ = false; }, 520); }
          lastBest = performance.now();
          continue;
        }
        if (foe && opt.fight !== false) { pl.facing = K.sign(foe.cx - pl.cx); if (Math.random() < 0.25) { i.mousePressed = true; } }
        const d = Math.hypot(dx, dy * 0.6);
        if (d < best - 4) { best = d; lastBest = performance.now(); }
        if (Math.abs(dx) < 14 && Math.abs(dy) < 20 && pl.onGround || (Math.abs(dx) < 14 && Math.abs(dy) < 34 && w.fly && !route[wi + 1])) {
          if (w.e) { release(); await wait(120); press('KeyE'); await wait(150); }
          if (w.charge) { release(); pl.facing = 1; i.down.KeyJ = true; i.pressed.KeyJ = true; await wait(650); i.down.KeyJ = false; await wait(400); }
          if (w.wait) await wait(w.wait * 1000);
          break;
        }
        if (Math.abs(dx) < 14 && Math.abs(dy) < 20 && w.fly) break;
        if (performance.now() - lastBest > 7000) { out.stuck = { wp: wi, w, at: [Math.round(pl.cx / 32), Math.round(pl.bottom / 32)], state: G.state }; break; }
      }
      if (out.stuck || out.done) break;
      out.reached = wi + 1;
    }
    release();
    // esperar transición de salida
    for (let k = 0; k < 120 && G.levelIdx === lvl; k++) { await wait(25); if (G.state === 'dialog') K.Dialog.advance(); }
    out.done = G.levelIdx !== lvl;
    out.detections = G.detections || 0;
    out.time = ((performance.now() - t0) / 1000).toFixed(1);
    out.energy = Math.round(p().energy);
    return out;
  };
})(window.K);
