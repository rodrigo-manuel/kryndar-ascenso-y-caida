'use strict';
// ============================================================================
//  KRYNDAR: Ascenso y Caída — bucle principal y máquina de estados del juego.
//  Estados: menu · story · play · dialog · pause · choice · ending
// ============================================================================
(function (K) {
  const TS = K.TS;
  const G = K.Game = {
    state: 'boot', time: 0, cam: { x: 0, y: 0 },
    enemies: [], props: [], doors: [], breakables: [], zones: [], waves: [], gwaves: [], toasts: [],
    fragments: [false, false, false, false, false],
    abilities: {}, lightning: 0, zoom: 1.25,
  };
  let canvas, ctx, viewScale = 1, last = 0;
  const SAVE = 'kryndar.save.v1';

  // ---------------------------------------------------------------- arranque
  G.init = function () {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    window.addEventListener('resize', resize);
    resize();
    G.progress = load();
    K.UI.init(G);
    G.menuCape = new K.Cape(7, 6.2, 4.5, 9.5);
    G.toMenu();
    requestAnimationFrame(loop);
  };
  function resize() {
    const s = Math.min(window.innerWidth / K.W, window.innerHeight / K.H);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = K.W * s + 'px'; canvas.style.height = K.H * s + 'px';
    canvas.width = Math.round(K.W * s * dpr); canvas.height = Math.round(K.H * s * dpr);
    viewScale = canvas.width / K.W;
    const ui = document.getElementById('ui');
    ui.style.width = K.W * s + 'px'; ui.style.height = K.H * s + 'px'; ui.style.fontSize = 16 * s + 'px';
  }
  function load() { try { return Object.assign({ reached: 0, endings: {} }, JSON.parse(localStorage.getItem(SAVE) || '{}')); } catch (e) { return { reached: 0, endings: {} }; } }
  function save() { try { localStorage.setItem(SAVE, JSON.stringify(G.progress)); } catch (e) { /* sin almacenamiento */ } }
  const prerenderScale = () => K.clamp(Math.round(viewScale * G.zoom * 2) / 2, 1, 2);

  // ---------------------------------------------------------------- menús
  G.toMenu = function () {
    G.state = 'menu'; G.level = null;
    K.Dialog.active = false; document.getElementById('dialog').classList.remove('on');
    K.FX.clear(); K.Audio.alert = false; K.Audio.setFly(0);
    K.UI.fade(false);
    document.getElementById('btn-continue').disabled = !G.progress.started;
    K.UI.show('menu');
    K.Audio.music('menu');
  };
  G.onUIAction = function (act) {
    if (act.startsWith('level:')) { G.startLevel(+act.split(':')[1]); return; }
    switch (act) {
      case 'new': G.state = 'story'; K.UI.show('story'); break;
      case 'begin': G.startLevel(0); break;
      case 'continue': G.startLevel(Math.min(G.progress.last !== undefined ? G.progress.last : G.progress.reached, K.LEVELS.length - 1)); break;
      case 'levels': K.UI.buildLevels(G.progress.unlockAll ? 99 : G.progress.reached); K.UI.show('levels'); break;
      case 'unlock': G.progress.unlockAll = true; save(); K.UI.buildLevels(99); K.UI.show('levels'); break;
      case 'controls': G.uiReturn = G.state === 'pause' ? 'pause' : 'menu'; K.UI.show('controls'); break;
      case 'credits': K.UI.show('credits'); break;
      case 'back': if (G.state === 'pause') K.UI.show('pause'); else K.UI.show('menu'); break;
      case 'resume': G.resume(); break;
      case 'restart': G.loadLevel(G.levelIdx); break;
      case 'mute': K.UI.setMuteLabel(K.Audio.toggleMute()); break;
      case 'quit': G.toMenu(); break;
      case 'endA': G.showEnding('A'); break;
      case 'endB': G.showEnding('B'); break;
      case 'otherEnd': G.showEnding(G.endingKey === 'A' ? 'B' : 'A'); break;
    }
  };
  G.pause = function () { G.state = 'pause'; K.Audio.setFly(0); K.UI.show('pause'); };
  G.resume = function () { K.UI.hideAll(); G.state = 'play'; K.Input.clear(); };

  // ---------------------------------------------------------------- niveles
  G.startLevel = function (i) {
    for (let k = 0; k < 5; k++) G.fragments[k] = k < i;
    G.loadLevel(i);
  };
  G.loadLevel = function (i) {
    const L = K.LEVELS[i];
    G.level = L; G.levelIdx = i; G.theme = K.Themes[L.theme];
    const map = G.map = new K.Tilemap(L.build());
    G.enemies = []; G.props = []; G.doors = []; G.breakables = []; G.zones = []; G.waves = []; G.gwaves = []; G.toasts = [];
    K.FX.clear(); K.Dialog.active = false; document.getElementById('dialog').classList.remove('on');
    G.time = 0; G.detections = 0; G.alertMax = false; K.Audio.alert = false; G.lastDetect = -99;
    G.fragmentTaken = false; G.bossBar = null; G.arena = null; G.arenaLock = false; G.korr = null; G.vexor = null;
    G.lightning = 0; G.bossZone = null; G.respawnT = 0; G.transitioning = false; G.endT = 0;
    G.vexHintQ = 0; G.vexHintArmor = 0; G.vexHintStun = false; G.breakHintT = 0; G.korrHintT = 0;
    G.abilities = Object.assign({}, L.abilities);
    const levers = {}; let hi = 0, ti = 0, start = { x: 64, y: 64 };
    const keep = '#-^qwertabBghyz';
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const ch = map.ch[y][x];
      const px = x * TS + TS / 2, py = (y + 1) * TS;
      switch (ch) {
        case 'P': start = { x: px, y: py }; break;
        case 'C': G.props.push(new K.Checkpoint(px, py)); break;
        case 'F': G.props.push(new K.Fragment(px, y * TS + TS / 2)); break;
        case 'E': G.props.push(new K.Orb(px, y * TS + TS / 2)); break;
        case 'S': G.enemies.push(new K.Soldier(px - 11, py - 46)); break;
        case 'K': G.korr = new K.Korr(px - 17, py - 64); G.korr.spawnX = px - 17; G.enemies.push(G.korr); break;
        case 'V': G.vexor = new K.Vexor(px - 15, py - 64); G.enemies.push(G.vexor); break;
        case 'N': G.props.push(new K.NPC(px, py, L.npc.who, K.DIALOGS[L.npc.dialog], L.npc.needE)); break;
        case '?': G.props.push(new K.Trigger(x * TS, py, L.triggers[ti++])); break;
        case 'i': G.props.push(new K.Hint(px, py, L.hints[hi++] || '')); break;
        case 'X': G.props.push(new K.Exit(px, py)); break;
        case '1': case '2': case '3': case '4': case '5': {
          const lv = new K.Lever(px, py, ch, (L.levers || {})[ch]); levers[ch] = lv; G.props.push(lv); break;
        }
      }
      if (ch !== ' ' && !keep.includes(ch)) map.ch[y][x] = ' ';
    }
    // compuertas y barreras
    for (const grp of map.groups((x, y) => ('qwertab'.includes(map.ch[y][x]) ? map.ch[y][x] : 0))) {
      const d = new K.Door(grp, map, grp.key !== 'a');
      G.doors.push(d);
      const li = 'qwert'.indexOf(grp.key);
      if (li >= 0 && levers[String(li + 1)]) levers[String(li + 1)].doors.push(d);
      if (grp.key === 'a') G.doorA = d;
      if (grp.key === 'b') G.doorB = d;
    }
    for (const grp of map.groups((x, y) => (map.ch[y][x] === 'B' ? 'B' : 0))) G.breakables.push(new K.Breakable(grp, map));
    for (const grp of map.groups((x, y) => map.grav[y * map.w + x] || 0)) G.zones.push(new K.GravZone(grp));
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) if ('qwertabBghyz'.includes(map.ch[y][x])) map.ch[y][x] = ' ';
    for (const e of G.enemies) if (e instanceof K.Soldier) e.setupPatrol(map);
    if (G.doorA && G.doorB) G.arena = { x0: G.doorA.x - TS * 0.5, x1: G.doorB.x + G.doorB.w + TS * 0.5 };
    if (G.vexor) {
      let ty = Math.floor(G.vexor.bottom / TS);
      while (ty < map.h && !map.isSolid(Math.floor(G.vexor.cx / TS), ty)) ty++;
      G.bossGround = ty * TS;
    }
    // pre-render
    G.PR = prerenderScale();
    const pre = K.Themes.prerender(map, G.theme, G.PR);
    G.tiles = pre.canvas; G.tileLights = pre.lights;
    K.Themes.getLayers(G.theme, G.PR);
    // jugador
    G.player = new K.Player(start.x - 10, start.y - 46);
    G.checkpoint = { x: start.x, y: start.y }; G.checkpointObj = null;
    G.snapCamera();
    K.Audio.music(G.theme.music);
    G.state = 'play';
    K.UI.hideAll(); K.UI.fade(false);
    K.UI.levelCard(L);
    if (L.unlock) G.toast(L.unlock, '#5ff3ff', 4, true, 2.6);
    if (i > G.progress.reached) G.progress.reached = i;
    G.progress.started = true; G.progress.last = i; save();
    K.Input.clear();
  };

  // ---------------------------------------------------------------- eventos de juego
  G.toast = function (text, color = '#ffffff', life = 2.2, big = false, delay = 0) {
    if (G.toasts.some(t => t.text === text && t.life > 0.4)) return;
    G.toasts.push({ text, color, life, max: life, big, delay });
    if (G.toasts.length > 4) G.toasts.shift();
  };
  G.fragmentCount = () => G.fragments.filter(Boolean).length;
  G.spawnOrb = function (x, y) { G.props.push(new K.Orb(x, y, true)); };

  G.gravityActiveAt = function (px, py) { return G.zoneState(G.map.gravAt(px, py)) === 'on'; };
  G.zoneState = function (code) {
    if (code === 1) return 'on';
    if (code === 2) { const t = G.time % 6; return t < 3 ? 'on' : t > 5 ? 'warn' : 'off'; }
    if ((code === 3 || code === 4) && G.bossZone) {
      const s = G.bossZone.seq[G.bossZone.i][0];
      const side = code === 3 ? 'L' : 'R';
      if (s === side + 'on') return 'on';
      if (s === side + 'warn') return 'warn';
    }
    return 'off';
  };

  G.onDetected = function (soldier) {
    if (!G.level.stealth) return;
    if (G.time - G.lastDetect < 1.6) return;
    G.lastDetect = G.time;
    G.detections++;
    K.Audio.sfx('alert');
    K.FX.flash('#ff2040', 0.12);
    if (G.detections >= 3 && !G.alertMax) {
      G.alertMax = true; K.Audio.alert = true;
      K.Audio.sfx('alarm');
      G.toast('⚠ ALERTA MÁXIMA · soldados más rápidos y letales', '#ff4258', 3.5, true);
      for (const e of G.enemies) if (e instanceof K.Soldier && !e.dead && Math.abs(e.cx - G.player.cx) < 700) e.becomeAlert(G, true);
    } else if (!G.alertMax) G.toast(`¡DETECTADO! ${G.detections}/3`, '#ff8a5a', 1.8);
  };
  G.setCheckpoint = function (cp) {
    if (G.checkpointObj === cp) return;
    cp.activate();
    G.checkpointObj = cp; G.checkpoint = { x: cp.x, y: cp.y };
    G.toast('Punto de control activado', '#5ff3ff', 1.6);
  };
  G.collectFragment = function (f) {
    G.fragmentTaken = true;
    G.fragments[G.levelIdx] = true;
    const n = G.fragmentCount();
    K.Audio.sfx('fragment');
    K.FX.flash('#ffe6a8', 0.5); K.FX.slow(0.3, 0.7); K.FX.shake(5, 0.4);
    K.FX.ring(f.x, f.y, 10, 160, 0.8, '#ffcf6b', 5);
    K.FX.ring(f.x, f.y, 10, 110, 0.6, '#c48aff', 3);
    K.FX.burst(f.x, f.y, 50, { color: ['#ffcf6b', '#c48aff', '#ffffff'], speed: [80, 420], life: [0.5, 1.3], size: [2, 4], type: 'glow', add: true, drag: 0.95 });
    G.player.energy = G.player.maxE;
    G.toast(`FRAGMENTO OBTENIDO · ${n}/5`, '#ffcf6b', 3.4, true);
    G.toast(n < 5 ? `${n}/5 fragmentos para avanzar a la zona final · la salida se ha activado` : '¡5/5! La zona final se ha abierto · ve a la salida', '#ffe4a8', 3.6);
  };
  G.completeLevel = function () {
    if (G.transitioning) return;
    G.transitioning = true;
    K.Audio.sfx('portal'); K.FX.flash('#c48aff', 0.6);
    G.player.control = false;
    if (G.level.stealth && G.levelIdx === 1) G.toast(G.detections === 0 ? 'Sigilo perfecto: 0 detecciones' : `Detecciones: ${G.detections}/3`, '#5ff3ff', 2);
    setTimeout(() => K.UI.fade(true), 500);
    setTimeout(() => {
      const next = G.levelIdx + 1;
      if (next < K.LEVELS.length) G.loadLevel(next); else G.toMenu();
    }, 1150);
  };
  G.playerFell = function () {
    const p = G.player;
    if (!p.alive) return;
    p.energy -= 25;
    K.Audio.sfx('hurt'); K.FX.flash('#ff2040', 0.35);
    if (p.energy <= 0) { p.energy = 0; p.die(G); return; }
    const e = p.energy;
    p.respawn(G.checkpoint.x, G.checkpoint.y); p.energy = e;
    G.toast('Caíste al vacío · −25 energía', '#ff6070', 1.8);
    G.snapCamera();
  };
  G.onPlayerDeath = function () { G.respawnT = 1.9; };
  G.doRespawn = function () {
    const p = G.player;
    p.respawn(G.checkpoint.x, G.checkpoint.y);
    for (const e of G.enemies) if (e instanceof K.Soldier) e.reset();
    G.waves.length = 0; G.gwaves.length = 0;
    if (G.korr && G.korrFight && !G.korr.dead) {
      G.korrFight = false; G.arenaLock = false; G.bossBar = null;
      G.doorA.setOpen(true);
      G.korr.state = 'wait'; G.korr.x = G.korr.spawnX; G.korr.vx = 0; G.korr.guard = false;
      const tr = G.props.find(pp => pp.kind === 'trigger' && pp.def.action === 'startKorr');
      if (tr) { tr.fired = false; tr.def = { action: 'startKorr' }; }
      K.Audio.music('fortress');
    }
    if (G.vexor && G.vexor.state !== 'intro' && G.vexor.state !== 'defeated') { G.vexor.set('rise', 0.6); G.vexor.immuneT = 2; G.vexor.x = G.map.pw - 200; }
    K.FX.ring(p.cx, p.cy, 6, 80, 0.6, '#5ff3ff', 4);
    K.FX.burst(p.cx, p.cy, 24, { color: ['#5ff3ff', '#ffffff'], speed: [60, 200], life: [0.3, 0.7], size: [2, 4], type: 'glow', add: true });
    G.toast('Kriss se levanta de nuevo', '#5ff3ff', 1.6);
    G.snapCamera();
  };
  G.startDialog = function (lines, onEnd) {
    if (typeof lines === 'string') lines = K.DIALOGS[lines];
    G.state = 'dialog';
    G.player.vx = 0; K.Audio.setFly(0); G.player.charging = false;
    K.Dialog.start(lines, () => { G.state = 'play'; if (onEnd) onEnd(); });
  };
  G.runTrigger = function (def) {
    const act = () => { if (def.action && G[def.action]) G[def.action](); };
    if (def.dialog) G.startDialog(def.dialog, act); else act();
  };
  G.startKorr = function () {
    G.korrFight = true; G.arenaLock = true;
    G.doorA.setOpen(false);
    G.korr.state = 'approach'; G.korr.decT = 1.0;
    G.bossBar = G.korr;
    K.Audio.music('boss');
    G.toast('¡TENIENTE KORR!', '#ff8a2a', 2.2, true);
  };
  G.onKorrDefeated = function (k) {
    G.korrFight = false;
    setTimeout(() => {
      if (G.korr !== k) return;
      G.arenaLock = false; G.bossBar = null;
      G.doorA.setOpen(true); G.doorB.setOpen(true);
      G.props.push(new K.Fragment(k.cx, k.y + 10));
      K.Audio.music('fortress');
      G.toast('Korr ha caído · el fragmento 4 está libre', '#ffcf6b', 2.6);
    }, 1400);
  };
  G.startBoss = function () {
    G.vexor.set('hover'); G.vexor.nextT = 1.6;
    G.bossBar = G.vexor;
    G.bossZone = { i: 0, t: 0, seq: [['off', 3], ['Lwarn', 1.3], ['Lon', 5], ['off', 1.6], ['Rwarn', 1.3], ['Ron', 5]] };
    G.toast('Atrae a Vexor a las zonas de GRAVEDAD EXTREMA', '#c48aff', 3.2);
  };
  G.onCounter = function (wave) {
    const p = G.player;
    K.Audio.sfx('counter');
    K.FX.flash('#5ff3ff', 0.45); K.FX.slow(0.3, 0.55); K.FX.shake(10, 0.4); K.FX.stop(0.1);
    K.FX.ring(p.cx, p.cy, 20, 260, 0.6, '#ffffff', 6);
    K.FX.burst(p.cx, p.cy, 40, { color: ['#5ff3ff', '#ff5a8a', '#ffffff'], speed: [150, 500], life: [0.3, 0.8], size: [2, 4], type: 'shard', spin: 12, drag: 0.95 });
    K.FX.text(p.cx, p.y - 24, '¡CONTRAATAQUE!', '#5ff3ff', 22);
    if (G.vexor) G.vexor.countered(G);
  };
  G.onVexorDefeated = function () {
    G.bossZone = null; G.waves.length = 0; G.gwaves.length = 0;
    setTimeout(() => {
      if (G.state !== 'play') return;
      K.Audio.music('endA');
      G.startDialog('vexorEnd', () => { G.state = 'choice'; K.UI.show('choice'); K.Audio.setFly(0); });
    }, 2000);
  };
  G.showEnding = function (k) {
    G.endingKey = k; G.state = 'ending'; G.endT = 0;
    const E = K.ENDINGS[k];
    K.UI.setEnding(E); K.UI.show('ending');
    K.Audio.music(E.music);
    K.FX.clear();
    G.progress.endings[k] = true; G.progress.reached = K.LEVELS.length - 1; save();
  };

  // ---------------------------------------------------------------- cámara
  G.camTarget = function () {
    const p = G.player, m = G.map;
    const VW = K.W / G.zoom, VH = K.H / G.zoom;
    let tx = p.cx - VW / 2 + p.facing * 50 + p.vx * 0.13;
    let ty = G.level.vertical ? p.cy - VH * 0.52 : p.cy - VH * 0.6;
    let x0 = 0, x1 = m.pw - VW;
    if (G.arenaLock && G.arena) { x0 = G.arena.x0; x1 = Math.max(x0, G.arena.x1 - VW); }
    return { x: K.clamp(tx, x0, x1), y: K.clamp(ty, 0, Math.max(0, m.ph - VH)) };
  };
  G.snapCamera = function () { const t = G.camTarget(); G.cam.x = t.x; G.cam.y = t.y; };
  function updateCamera(dt) {
    const t = G.camTarget();
    G.cam.x += (t.x - G.cam.x) * Math.min(1, dt * 6);
    G.cam.y += (t.y - G.cam.y) * Math.min(1, dt * (G.level.vertical ? 6 : 4));
  }

  // ---------------------------------------------------------------- actualización
  function updateWorld(dt) {
    G.time += dt;
    G.lightning = Math.max(0, G.lightning - dt * 3);
    if (G.bossZone) {
      const z = G.bossZone; z.t += dt;
      if (z.t >= z.seq[z.i][1]) { z.t = 0; z.i = (z.i + 1) % z.seq.length; if (z.seq[z.i][0].endsWith('on')) K.Audio.sfx('door'); }
    }
    const p = G.player;
    p.update(dt, G);
    for (const e of G.enemies) e.update(dt, G);
    G.enemies = G.enemies.filter(e => !e.remove);
    blockPlayer(p);
    for (const o of G.props) if (o.update) o.update(dt, G);
    G.props = G.props.filter(o => !(o.kind === 'orb' && o.taken));
    for (const d of G.doors) d.update(dt, G);
    for (const w of G.waves) w.update(dt, G);
    for (const w of G.gwaves) w.update(dt, G);
    G.waves = G.waves.filter(w => !w.dead); G.gwaves = G.gwaves.filter(w => !w.dead);
    G.theme.ambient(G, dt);
    K.FX.update(dt);
    // interacción
    G.interact = null;
    if (p.alive && G.state === 'play') {
      let best = 56;
      for (const o of G.props) {
        if (!o.interactable || !o.interactable(G)) continue;
        const d = K.dist(p.cx, p.cy, o.x, o.y - 20);
        if (d < best) { best = d; G.interact = o; }
      }
      if (G.interact && K.Input.wasPressed('interact')) { const o = G.interact; G.interact = null; o.interact(G); }
    }
    if (!p.alive && G.respawnT > 0) { G.respawnT -= dt; if (G.respawnT <= 0) G.doRespawn(); }
    updateCamera(dt);
  }
  // Los enemigos en el suelo bloquean el paso: hay que pelear, saltarlos/volar o atravesarlos con DASH.
  function blockPlayer(p) {
    if (!p.alive || p.dashT > 0) return;
    for (const e of G.enemies) {
      if (e.dead || e instanceof K.Vexor || e.state === 'wait') continue;
      const hb = { x: e.x + 3, y: e.y + 6, w: e.w - 6, h: e.h - 6 };
      const pb = { x: p.x, y: p.y, w: p.w, h: p.h };
      if (!K.overlap(pb, hb)) continue;
      if (p.bottom - hb.y < 14 && p.vy >= 0) continue; // encima de su cabeza
      const dir = p.cx < e.cx ? -1 : 1;
      const nx = dir < 0 ? hb.x - p.w : hb.x + hb.w;
      const tx = Math.floor((dir < 0 ? nx : nx + p.w - 0.01) / TS);
      const free = [Math.floor(p.y / TS), Math.floor((p.y + p.h - 0.01) / TS)].every(ty => !G.map.isSolid(tx, ty));
      if (free) { p.x = nx; if (Math.sign(p.vx) === -dir) p.vx = 0; }
      else e.x += (dir < 0 ? 1 : -1) * Math.min(6, Math.abs(nx - p.x));
    }
  }
  function updateToasts(dt) {
    for (const t of G.toasts) { if (t.delay > 0) t.delay -= dt; else t.life -= dt; }
    G.toasts = G.toasts.filter(t => t.life > 0);
  }

  G.frame = function (rdt) {
    const I = K.Input;
    if (I.wasPressed('mute')) K.UI.setMuteLabel(K.Audio.toggleMute());
    K.FX.updateTimers(rdt);
    switch (G.state) {
      case 'play':
        if (I.wasPressed('pause') && !G.transitioning) { G.pause(); break; }
        if (K.FX.hitstop > 0) K.FX.hitstop -= rdt;
        else updateWorld(rdt * K.FX.timeScale);
        updateToasts(rdt);
        break;
      case 'dialog':
        K.Dialog.update(rdt);
        K.FX.update(rdt * 0.5);
        G.player.cape.update(G.player.cx - G.player.facing * 3, G.player.y + 8, rdt, G.player.facing, 0, G.time);
        updateCamera(rdt);
        break;
      case 'pause':
        if (I.wasPressed('pause') && K.UI.current === 'pause') G.resume();
        break;
      case 'choice':
        K.FX.update(rdt);
        break;
      case 'ending':
        G.endT += rdt; updateScene(rdt, true);
        break;
      default:
        updateScene(rdt, false);
    }
    render();
  };
  function loop(now) {
    const rdt = Math.min(0.05, (now - last) / 1000) || 0.016;
    last = now;
    try { G.frame(rdt); } catch (err) { console.error(err); }
    K.Input.endFrame();
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------- dibujo
  function render() {
    ctx.setTransform(viewScale, 0, 0, viewScale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    if (G.state === 'menu' || G.state === 'story' || G.state === 'boot') drawMenuScene();
    else if (G.state === 'ending') drawEndingScene();
    else if (G.level) { drawWorld(); K.HUD.draw(ctx, G); }
  }

  function drawWorld() {
    const th = G.theme, map = G.map, p = G.player;
    const sh = K.FX.shakeOffset();
    const q = viewScale * G.zoom;
    const cam = { x: Math.round((G.cam.x + sh.x) * q) / q, y: Math.round((G.cam.y + sh.y) * q) / q };
    G.view = cam;
    K.Themes.drawBackground(ctx, th, cam, G.time, G.PR, map, G);
    const Z = G.zoom;

    ctx.save();
    ctx.scale(Z, Z);
    ctx.translate(-cam.x, -cam.y);
    for (const z of G.zones) z.draw(ctx, G);
    // baldosas (solo la parte visible)
    const sx = K.clamp(cam.x, 0, map.pw - 1), sy = K.clamp(cam.y, 0, map.ph - 1);
    const sw = Math.min(K.W / Z + 2, map.pw - sx), shh = Math.min(K.H / Z + 2, map.ph - sy);
    if (sw > 0 && shh > 0) ctx.drawImage(G.tiles, sx * G.PR, sy * G.PR, sw * G.PR, shh * G.PR, sx, sy, sw, shh);
    for (const d of G.doors) d.draw(ctx, G);
    for (const b of G.breakables) b.draw(ctx, G);
    for (const o of G.props) if (o.kind !== 'fragment' && o.kind !== 'orb' && o.kind !== 'npc') o.draw(ctx, G);
    for (const e of G.enemies) if (e.drawCone) e.drawCone(ctx, G);
    for (const o of G.props) if (o.kind === 'npc') o.draw(ctx, G);
    for (const e of G.enemies) e.draw(ctx, G);
    p.draw(ctx, G);
    for (const o of G.props) if (o.kind === 'fragment' || o.kind === 'orb') o.draw(ctx, G);
    for (const w of G.waves) w.draw(ctx);
    for (const w of G.gwaves) w.draw(ctx);
    K.FX.draw(ctx, cam);
    for (const o of G.props) if (o.kind === 'hint') o.drawPanel(ctx, G);
    if (G.interact && G.state === 'play') K.HUD.prompt(ctx, G.interact.x, G.interact.y - 64, G.interact.prompt(), G.time);
    K.FX.drawTexts(ctx);
    ctx.restore();

    // iluminación
    if (th.darkness > 0) {
      const lights = [];
      const add = (L) => { if (L) lights.push({ x: (L.x - cam.x) * Z, y: (L.y - cam.y) * Z, r: L.r * Z, color: L.color, a: L.a }); };
      if (p.alive) add({ x: p.cx, y: p.cy - 6, r: th.name === 'caves' ? 330 : 320, color: '#5ff3ff', a: 1 });
      for (const L of G.tileLights) add(L);
      for (const o of G.props) if (o.light) add(o.light(G));
      for (const d of G.doors) add(d.light());
      for (const b of G.breakables) add(b.light());
      for (const e of G.enemies) if (!e.dead) add({ x: e.cx, y: e.y + 12, r: e instanceof K.Soldier ? 70 : 140, color: '#ff3b3b', a: 0.8 });
      for (const pp of K.FX.parts) if (pp.add && pp.type === 'glow' && pp.size > 5 && lights.length < 80) add({ x: pp.x, y: pp.y, r: pp.size * 3, a: 0.5 });
      K.Themes.drawDarkness(ctx, th, lights, viewScale);
    }
    // tinte de alerta y energía baja
    if (G.alertMax) { ctx.fillStyle = `rgba(255,20,40,${0.06 + Math.sin(G.time * 5) * 0.04})`; ctx.fillRect(0, 0, K.W, K.H); }
    K.Themes.drawVignette(ctx);
    if (p.alive && p.energy / p.maxE <= 0.25) {
      const a = 0.18 + Math.sin(G.time * 6) * 0.08;
      const gr = ctx.createRadialGradient(K.W / 2, K.H / 2, K.H * 0.35, K.W / 2, K.H / 2, K.W * 0.62);
      gr.addColorStop(0, 'rgba(255,0,30,0)'); gr.addColorStop(1, `rgba(255,0,30,${a})`);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, K.W, K.H);
    }
    if (K.FX.flashA > 0) { ctx.fillStyle = K.rgba(K.FX.flashColor, K.FX.flashA); ctx.fillRect(0, 0, K.W, K.H); }
  }

  // ---------------------------------------------------------------- escenas de menú y final
  G.sceneT = 0;
  function updateScene(dt, ending) {
    G.sceneT += dt;
    K.FX.update(dt);
    const th = ending ? (G.endingKey === 'A' ? K.Themes.fortress : K.Themes.ruins) : K.Themes.ruins;
    const fake = { cam: { x: G.sceneT * 14, y: 0 } };
    if (!ending) th.ambient(fake, dt);
    else if (G.endingKey === 'B' && Math.random() < dt * 30) K.FX.spawn({ x: fake.cam.x + Math.random() * K.W, y: fake.cam.y + K.H + 10, vx: K.rand(-15, 15), vy: -K.rand(30, 90), life: K.rand(3, 6), size: K.rand(2, 5), color: K.pick(['#ffcf6b', '#5ff3ff', '#ffffff']), type: 'glow', add: true });
    else if (G.endingKey === 'A' && Math.random() < dt * 14) K.FX.spawn({ x: fake.cam.x + Math.random() * K.W, y: fake.cam.y + K.H + 10, vx: K.rand(-10, 10), vy: -K.rand(30, 70), life: 5, size: K.rand(1, 2), color: '#ff7a4a', add: true });
    G.sceneCam = fake.cam;
    G.menuCape.update(700 + 3, 352 + 8 - 46, dt, -1, 140 + Math.sin(G.sceneT * 1.7) * 90, G.sceneT);
  }
  function drawCliff(c, x, y, w, color) {
    c.fillStyle = color;
    c.beginPath(); c.moveTo(x - w * 0.55, K.H); c.lineTo(x - w * 0.5, y + 30); c.lineTo(x - w * 0.32, y + 4); c.lineTo(x - w * 0.1, y);
    c.lineTo(x + w * 0.2, y + 2); c.lineTo(x + w * 0.38, y + 18); c.lineTo(x + w * 0.5, y + 60); c.lineTo(x + w * 0.62, K.H); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,170,110,0.25)'; c.fillRect(x - w * 0.32, y, w * 0.5, 2);
  }
  function drawMenuScene() {
    const th = K.Themes.ruins;
    const cam = G.sceneCam || { x: 0, y: 0 };
    K.Themes.drawBackground(ctx, th, cam, G.sceneT, prerenderScale(), null, G);
    ctx.save(); ctx.translate(-cam.x, -cam.y); K.FX.draw(ctx, cam); ctx.restore();
    drawCliff(ctx, 700, 352, 360, '#12070f');
    const S = K.Styles.kriss;
    ctx.save();
    ctx.translate(700, 353); ctx.scale(2.1, 2.1); ctx.translate(-700, -353);
    K.FX.glow(ctx, 700, 328, 50, '#5ff3ff', 0.22);
    G.menuCape.draw(ctx, S.cape[0], S.cape[1]);
    const pose = K.Poses.idle(G.sceneT); pose.head = -0.12; pose.shR = 0.2; pose.elR = 0.4;
    K.Rig.draw(ctx, 700, 353, -1, pose, S, G.sceneT);
    ctx.restore();
    K.Themes.drawVignette(ctx);
  }
  function drawEndingScene() {
    const A = G.endingKey === 'A';
    const th = A ? K.Themes.fortress : K.Themes.ruins;
    const cam = G.sceneCam || { x: 0, y: 0 };
    K.Themes.drawBackground(ctx, th, cam, G.sceneT, prerenderScale(), null, G);
    if (A) {
      // el Núcleo encadenado por el Dominio
      const cx = 480, cy = 170, R = 70 + Math.sin(G.sceneT * 2) * 3;
      K.FX.glow(ctx, cx, cy, 220, '#ff2a3a', 0.4);
      const g = ctx.createRadialGradient(cx - 12, cy - 12, 5, cx, cy, R);
      g.addColorStop(0, '#ffd0c0'); g.addColorStop(0.5, '#d0303a'); g.addColorStop(1, '#3a0610');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6a6e7a'; ctx.lineWidth = 4;
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a) * 420, cy + Math.sin(a) * 420); ctx.stroke(); }
    } else {
      const g = ctx.createLinearGradient(0, 200, 0, 540);
      g.addColorStop(0, 'rgba(255,220,160,0)'); g.addColorStop(1, 'rgba(255,220,160,0.35)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, K.W, K.H);
      K.FX.glow(ctx, 480, 430, 380, '#ffd27a', 0.5);
    }
    ctx.save(); ctx.translate(-cam.x, -cam.y); K.FX.draw(ctx, cam); ctx.restore();
    drawCliff(ctx, 480, 236, 380, A ? '#0e0306' : '#140a10');
    ctx.save(); ctx.translate(480, 237); ctx.scale(1.7, 1.7); ctx.translate(-480, -237);
    if (A) {
      for (const bx of [400, 545]) { ctx.fillStyle = '#5a0c14'; ctx.fillRect(bx, 175, 16, 60); ctx.fillStyle = '#ff4258'; ctx.fillRect(bx + 6, 186, 4, 4); ctx.fillStyle = '#2a2a33'; ctx.fillRect(bx - 3, 172, 22, 4); }
      const pose = K.Poses.idle(G.sceneT); pose.head = 0.3; pose.lean = 0.12;
      K.Rig.draw(ctx, 480, 237, 1, pose, K.Styles.kriss, G.sceneT);
    } else {
      const p1 = K.Poses.idle(G.sceneT); p1.head = -0.25;
      const p2 = K.Poses.idle(G.sceneT + 1); p2.head = -0.2; p2.shL = 0.5;
      K.Rig.draw(ctx, 462, 237, 1, p1, K.Styles.kriss, G.sceneT);
      K.Rig.draw(ctx, 498, 237, -1, p2, K.Styles.nyra, G.sceneT);
    }
    ctx.restore();
    K.Themes.drawVignette(ctx);
  }

  window.addEventListener('load', () => {
    const go = () => G.init();
    if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]).then(go);
    else go();
  });
})(window.K);
