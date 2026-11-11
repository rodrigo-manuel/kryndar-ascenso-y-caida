'use strict';
// ============================================================================
//  Pantallas HTML/CSS (menú, niveles, controles, pausa, decisión, final) y el
//  sistema de diálogos con efecto máquina de escribir y retratos animados.
// ============================================================================
(function (K) {
  const $ = id => document.getElementById(id);
  const UI = K.UI = { current: null, sel: 0 };

  UI.init = function (game) {
    UI.game = game;
    document.querySelectorAll('#ui [data-act]').forEach(b => UI.bindButton(b));
    window.addEventListener('keydown', UI.onKey);
    $('dialog').addEventListener('mousedown', () => K.Dialog.advance());
  };
  UI.bindButton = function (b) {
    // los botones nunca toman el foco del navegador: así Enter/Espacio no los activan dos veces
    b.tabIndex = -1;
    b.addEventListener('mousedown', e => e.preventDefault());
    b.addEventListener('click', () => { K.Audio.init(); K.Audio.sfx('confirm'); UI.game.onUIAction(b.dataset.act, b); });
    b.addEventListener('mouseenter', () => {
      const list = UI.navItems();
      const i = list.indexOf(b);
      if (i >= 0 && i !== UI.sel) { UI.sel = i; UI.paintSel(); K.Audio.sfx('select'); }
    });
  };
  UI.show = function (id) {
    document.querySelectorAll('#ui .screen').forEach(s => s.classList.toggle('on', s.id === id));
    UI.current = id; UI.sel = 0;
    UI.paintSel();
  };
  UI.hideAll = function () { document.querySelectorAll('#ui .screen').forEach(s => s.classList.remove('on')); UI.current = null; };
  UI.navItems = function () {
    if (!UI.current) return [];
    const scr = $(UI.current);
    return Array.from(scr.querySelectorAll('[data-nav] [data-act], .row [data-act], .story [data-act]')).filter(b => !b.disabled && b.offsetParent !== null);
  };
  UI.paintSel = function () {
    const items = UI.navItems();
    document.querySelectorAll('#ui .sel').forEach(e => e.classList.remove('sel'));
    if (items.length) { UI.sel = K.clamp(UI.sel, 0, items.length - 1); items[UI.sel].classList.add('sel'); }
  };
  UI.onKey = function (e) {
    if (!UI.current) return;
    const items = UI.navItems();
    if (!items.length) return;
    const k = e.code;
    const prev = ['ArrowUp', 'KeyW', 'ArrowLeft', 'KeyA'], next = ['ArrowDown', 'KeyS', 'ArrowRight', 'KeyD'];
    let handled = true;
    if (UI.current === 'choice' && (k === 'KeyA' || k === 'KeyB')) { UI.game.onUIAction(k === 'KeyA' ? 'endA' : 'endB'); }
    else if (prev.includes(k)) { UI.sel = (UI.sel - 1 + items.length) % items.length; UI.paintSel(); K.Audio.sfx('select'); }
    else if (next.includes(k)) { UI.sel = (UI.sel + 1) % items.length; UI.paintSel(); K.Audio.sfx('select'); }
    else if ((k === 'Enter' || k === 'Space' || k === 'NumpadEnter') && !e.repeat) { items[UI.sel].click(); }
    else if (k === 'Escape' && UI.current !== 'pause' && UI.current !== 'menu') { UI.game.onUIAction('back'); }
    else handled = false;
    if (handled) { e.preventDefault(); delete K.Input.pressed[k]; }
  };

  UI.buildLevels = function (reached) {
    const grid = $('level-grid');
    grid.innerHTML = '';
    K.LEVELS.forEach((L, i) => {
      const b = document.createElement('button');
      b.className = 'btn lvl';
      b.dataset.act = 'level:' + i;
      b.disabled = i > reached;
      b.innerHTML = `<span class="n">${L.num}</span><span class="t">${L.short}</span><span class="d">${L.desc}</span><span class="f">${i < 5 ? 'Fragmento ' + (i + 1) + '/5' : 'Decisión final'}</span>`;
      UI.bindButton(b);
      grid.appendChild(b);
    });
  };
  UI.levelCard = function (L) {
    $('lc-num').textContent = L.num; $('lc-name').textContent = L.name; $('lc-obj').textContent = L.obj;
    const c = $('levelcard'); c.classList.remove('on'); void c.offsetWidth; c.classList.add('on');
  };
  UI.fade = function (on) { $('fade').classList.toggle('on', on); };
  UI.setMuteLabel = function (m) { $('btn-mute').textContent = 'Sonido: ' + (m ? 'No' : 'Sí'); };
  UI.setEnding = function (E) { $('end-kicker').textContent = E.kicker; $('end-title').textContent = E.title; $('end-text').textContent = E.text; };

  // ============================== DIÁLOGOS ==============================
  const D = K.Dialog = { active: false, lines: [], idx: 0, chars: 0, t: 0, onEnd: null };
  D.start = function (lines, onEnd) {
    D.active = true; D.lines = lines; D.idx = 0; D.onEnd = onEnd; D.chars = 0; D.t = 0;
    $('dialog').classList.add('on');
    D.render(true);
  };
  D.render = function (newLine) {
    const L = D.lines[D.idx];
    $('dialog-name').textContent = (K.NAMES[L.who] || L.who) + (L.radio ? ' · TRANSMISIÓN' : '');
    $('dialog').classList.toggle('radio', !!L.radio);
    $('dialog-text').textContent = L.text.slice(0, Math.floor(D.chars));
    if (newLine) D.who = L.who;
  };
  D.update = function (dt) {
    if (!D.active) return;
    D.t += dt;
    const L = D.lines[D.idx];
    const before = Math.floor(D.chars);
    D.chars = Math.min(L.text.length, D.chars + dt * 48);
    if (Math.floor(D.chars) !== before) { if (before % 3 === 0 && L.text[before] !== ' ') K.Audio.sfx('talk', 0.02); D.render(); }
    K.Rig.portrait($('portrait'), L.who, D.t);
    const I = K.Input;
    if (I.wasPressed('interact') || I.wasPressed('confirm') || I.mousePressed) D.advance();
  };
  D.advance = function () {
    if (!D.active) return;
    const L = D.lines[D.idx];
    if (D.chars < L.text.length) { D.chars = L.text.length; D.render(); return; }
    D.idx++;
    K.Audio.sfx('select');
    if (D.idx >= D.lines.length) {
      D.active = false;
      $('dialog').classList.remove('on');
      K.Input.clear();
      const cb = D.onEnd; D.onEnd = null;
      if (cb) cb();
      return;
    }
    D.chars = 0; D.render(true);
  };
})(window.K);
