'use strict';
// ============================================================================
//  Audio: efectos y música sintetizados en tiempo real con Web Audio API.
//  No se usan archivos: cada sonido se construye con osciladores y ruido.
// ============================================================================
(function (K) {
  const A = K.Audio = {};
  let ctx = null, master, comp, sfxG, musG, musBus, noiseBuf;
  let flyGain, flyFilter;
  let muted = false;
  let track = null, trackName = null, pending = null, step = 0, nextTime = 0;
  A.alert = false;

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  A.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.85;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4;
    comp.connect(master); master.connect(ctx.destination);
    sfxG = ctx.createGain(); sfxG.gain.value = 0.75; sfxG.connect(comp);
    musG = ctx.createGain(); musG.gain.value = 0; musG.connect(comp);
    // Bus de música con eco (delay con realimentación) para dar profundidad.
    musBus = ctx.createGain(); musBus.connect(musG);
    const dl = ctx.createDelay(); dl.delayTime.value = 0.33;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    musBus.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(musG);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // Bucle de vuelo (ruido filtrado cuya ganancia se controla en tiempo real).
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    flyFilter = ctx.createBiquadFilter(); flyFilter.type = 'bandpass'; flyFilter.frequency.value = 420; flyFilter.Q.value = 0.7;
    flyGain = ctx.createGain(); flyGain.gain.value = 0;
    src.connect(flyFilter); flyFilter.connect(flyGain); flyGain.connect(sfxG); src.start();

    setInterval(schedule, 25);
    if (pending) { const p = pending; pending = null; trackName = null; A.music(p); }
  };

  A.isMuted = () => muted;
  A.toggleMute = function () {
    muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.85, ctx.currentTime, 0.05);
    return muted;
  };

  // ---------- Primitivas ----------
  function tone(o) {
    const t = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const atk = o.attack || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(atk + 0.01, o.dur));
    let node = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter(); f.type = o.ftype || 'lowpass'; f.frequency.value = o.filter; f.Q.value = o.q || 0.8;
      osc.connect(f); node = f;
    }
    node.connect(g); g.connect(o.dest || sfxG);
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }
  function noise(o) {
    const t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.ftype || 'lowpass'; f.Q.value = o.q || 0.9;
    f.frequency.setValueAtTime(o.filter || 2000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxG);
    src.start(t, Math.random() * 1.5); src.stop(t + o.dur + 0.05);
  }

  // ---------- Efectos ----------
  const last = {};
  const S = {
    jump() { tone({ f: 260, f2: 520, dur: 0.12, type: 'triangle', vol: 0.12 }); noise({ dur: 0.08, vol: 0.08, filter: 1500 }); },
    land() { noise({ dur: 0.1, vol: 0.18, filter: 400 }); },
    step() { noise({ dur: 0.035, vol: 0.05, filter: 700 }); },
    whoosh() { noise({ dur: 0.14, vol: 0.22, filter: 700, f2: 3200, ftype: 'bandpass' }); },
    hit() { noise({ dur: 0.12, vol: 0.45, filter: 2200, f2: 300 }); tone({ f: 170, f2: 55, dur: 0.13, type: 'square', vol: 0.12, filter: 900 }); },
    charged() {
      noise({ dur: 0.4, vol: 0.7, filter: 3500, f2: 120 });
      tone({ f: 130, f2: 35, dur: 0.4, type: 'sawtooth', vol: 0.28, filter: 1200 });
      tone({ f: 60, f2: 30, dur: 0.5, type: 'sine', vol: 0.4 });
    },
    chargeReady() { tone({ f: 990, f2: 1480, dur: 0.16, type: 'sine', vol: 0.12 }); tone({ f: 1480, dur: 0.2, type: 'triangle', vol: 0.06, delay: 0.06 }); },
    dash() { noise({ dur: 0.24, vol: 0.38, filter: 500, f2: 5000, ftype: 'bandpass', q: 1.5 }); tone({ f: 320, f2: 1100, dur: 0.16, type: 'sine', vol: 0.08 }); },
    hurt() { tone({ f: 320, f2: 80, dur: 0.28, type: 'sawtooth', vol: 0.24, filter: 1400 }); noise({ dur: 0.18, vol: 0.3, filter: 1200 }); },
    block() { tone({ f: 1250, dur: 0.12, type: 'square', vol: 0.08, filter: 4000 }); tone({ f: 1870, dur: 0.18, type: 'triangle', vol: 0.08 }); noise({ dur: 0.08, vol: 0.25, filter: 6000, ftype: 'highpass' }); },
    alert() { tone({ f: 880, dur: 0.11, type: 'square', vol: 0.14, filter: 3000 }); tone({ f: 1320, dur: 0.24, type: 'square', vol: 0.14, filter: 3000, delay: 0.11 }); },
    alarm() { for (let i = 0; i < 4; i++) tone({ f: 520, f2: 1150, dur: 0.38, type: 'sawtooth', vol: 0.13, filter: 2200, delay: i * 0.42 }); },
    pickup() { [523, 659, 784, 1046].forEach((f, i) => tone({ f, dur: 0.22, type: 'triangle', vol: 0.12, delay: i * 0.06 })); },
    orb() { tone({ f: 700, f2: 1400, dur: 0.18, type: 'sine', vol: 0.12 }); tone({ f: 1050, dur: 0.2, type: 'triangle', vol: 0.05, delay: 0.05 }); },
    fragment() {
      [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone({ f, dur: 0.9, type: 'triangle', vol: 0.09, delay: i * 0.07, attack: 0.02 }));
      tone({ f: 65, f2: 40, dur: 1.2, type: 'sine', vol: 0.4 });
      noise({ dur: 1.0, vol: 0.16, filter: 6000, f2: 800, ftype: 'highpass' });
    },
    checkpoint() { [392, 523, 659].forEach((f, i) => tone({ f, dur: 0.4, type: 'sine', vol: 0.1, delay: i * 0.09 })); },
    lever() { tone({ f: 210, dur: 0.07, type: 'square', vol: 0.12, filter: 1600 }); noise({ dur: 0.09, vol: 0.18, filter: 3000 }); },
    door() { noise({ dur: 0.7, vol: 0.22, filter: 380, f2: 120 }); tone({ f: 72, f2: 60, dur: 0.7, type: 'sawtooth', vol: 0.1, filter: 300 }); },
    tick() { tone({ f: 1500, dur: 0.03, type: 'square', vol: 0.04, filter: 5000 }); },
    break() { noise({ dur: 0.6, vol: 0.6, filter: 1600, f2: 90 }); tone({ f: 95, f2: 30, dur: 0.45, type: 'square', vol: 0.18, filter: 600 }); },
    boom() { noise({ dur: 0.9, vol: 0.75, filter: 900, f2: 50 }); tone({ f: 85, f2: 24, dur: 0.8, type: 'sine', vol: 0.5 }); },
    shoutCharge() { tone({ f: 90, f2: 700, dur: 1.05, type: 'sawtooth', vol: 0.12, filter: 1400, attack: 0.9 }); noise({ dur: 1.05, vol: 0.12, filter: 300, f2: 3000, ftype: 'bandpass', attack: 0.9 }); },
    sonic() { tone({ f: 980, f2: 160, dur: 0.9, type: 'sawtooth', vol: 0.24, filter: 3200 }); tone({ f: 1470, f2: 240, dur: 0.9, type: 'square', vol: 0.06, filter: 3000 }); noise({ dur: 0.7, vol: 0.3, filter: 2500, f2: 300, ftype: 'bandpass' }); },
    resist() { tone({ f: 220, f2: 1300, dur: 0.32, type: 'square', vol: 0.15, filter: 2600 }); tone({ f: 330, f2: 1700, dur: 0.32, type: 'sawtooth', vol: 0.08, filter: 2600 }); noise({ dur: 0.3, vol: 0.25, filter: 900, f2: 5000, ftype: 'bandpass' }); },
    counter() { S.boom(); [523, 784, 1046].forEach((f, i) => tone({ f, dur: 0.5, type: 'triangle', vol: 0.12, delay: 0.05 + i * 0.05 })); },
    death() { tone({ f: 440, f2: 55, dur: 1.1, type: 'sawtooth', vol: 0.2, filter: 1500 }); noise({ dur: 1.0, vol: 0.4, filter: 2000, f2: 100 }); },
    enemyDie() { noise({ dur: 0.35, vol: 0.35, filter: 1800, f2: 200 }); tone({ f: 300, f2: 70, dur: 0.3, type: 'square', vol: 0.1, filter: 1200 }); },
    talk() { tone({ f: K.rand(360, 470), dur: 0.035, type: 'square', vol: 0.025, filter: 2400 }); },
    select() { tone({ f: 620, dur: 0.05, type: 'triangle', vol: 0.09 }); },
    confirm() { tone({ f: 520, f2: 1040, dur: 0.14, type: 'triangle', vol: 0.12 }); },
    deny() { tone({ f: 180, dur: 0.14, type: 'square', vol: 0.08, filter: 900 }); },
    portal() { tone({ f: 200, f2: 1600, dur: 0.9, type: 'sine', vol: 0.15, attack: 0.3 }); noise({ dur: 0.9, vol: 0.15, filter: 400, f2: 6000, ftype: 'bandpass', attack: 0.3 }); },
    thunder() { noise({ dur: 1.8, vol: 0.35, filter: 600, f2: 60, attack: 0.02 }); },
  };
  A.sfx = function (name, minGap = 0.03) {
    if (!ctx || muted || !S[name]) return;
    const now = ctx.currentTime;
    if (last[name] && now - last[name] < minGap) return;
    last[name] = now;
    S[name]();
  };
  A.setFly = function (amount) {
    if (!ctx) return;
    flyGain.gain.setTargetAtTime(amount * 0.22, ctx.currentTime, 0.06);
    flyFilter.frequency.setTargetAtTime(380 + amount * 520, ctx.currentTime, 0.1);
  };

  // ---------- Música procedural ----------
  const MIN = [0, 2, 3, 5, 7, 8, 10], DOR = [0, 2, 3, 5, 7, 9, 10], PHR = [0, 1, 3, 5, 7, 8, 10];
  const HMIN = [0, 2, 3, 5, 7, 8, 11], MAJ = [0, 2, 4, 5, 7, 9, 11];
  const TRACKS = {
    menu: { bpm: 68, root: 45, scale: MIN, prog: [0, 5, 3, 4], pad: 0.05, bass: 'x...............', arp: 'x...x...x...x...', arpVol: 0.03, arpOct: 2 },
    ruins: { bpm: 86, root: 45, scale: DOR, prog: [0, 3, 5, 4], pad: 0.04, bass: 'x.....x.x.......', arp: 'x.x.xx.x.x.xx.x.', arpVol: 0.026, arpOct: 1, kick: 'x.......x.......', hat: '....x.......x...', hatVol: 0.03 },
    industrial: { bpm: 98, root: 43, scale: PHR, prog: [0, 1, 0, 6], pad: 0.03, bass: 'x..x..x...x..x..', arp: 'x...x...x..xx...', arpType: 'square', arpVol: 0.016, arpOct: 1, kick: 'x.......x.......', hat: '..x...x...x...x.', hatVol: 0.035, snare: '............x...' },
    caves: { bpm: 64, root: 50, scale: DOR, prog: [0, 4, 3, 0], pad: 0.05, bass: 'x...............', arp: 'x..x..x...x..x..', arpVol: 0.028, arpOct: 2 },
    fortress: { bpm: 126, root: 40, scale: MIN, prog: [0, 5, 6, 4], pad: 0.028, bass: 'x.xx.x.xx.xx.x.x', arp: 'x.x.x.x.x.x.x.x.', arpType: 'sawtooth', arpVol: 0.014, arpOct: 1, kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', hatVol: 0.04 },
    tower: { bpm: 136, root: 47, scale: HMIN, prog: [0, 5, 3, 4], pad: 0.03, bass: 'x..x..x.x..x..x.', arp: 'xxxxxxxxxxxxxxxx', arpType: 'triangle', arpVol: 0.022, arpOct: 1, kick: 'x...x...x...x...', snare: '....x.......x..x', hat: 'x.x.x.x.x.x.x.x.', hatVol: 0.03 },
    boss: { bpm: 150, root: 38, scale: PHR, prog: [0, 1, 5, 4], pad: 0.03, bass: 'x.xxx.xxx.xxx.xx', arp: 'x.xxx.xxx.xxx.xx', arpType: 'sawtooth', arpVol: 0.015, arpOct: 1, kick: 'x..xx...x..xx...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', hatVol: 0.025 },
    endA: { bpm: 58, root: 45, scale: MIN, prog: [0, 5, 3, 4], pad: 0.055, bass: 'x...............', arp: 'x.......x.......', arpVol: 0.03, arpOct: 2 },
    endB: { bpm: 74, root: 48, scale: MAJ, prog: [0, 4, 5, 3], pad: 0.05, bass: 'x.......x.......', arp: 'x..x..x.x..x..x.', arpVol: 0.03, arpOct: 2, kick: 'x...............', hatVol: 0.02 },
  };

  A.music = function (name) {
    if (!ctx) { pending = name; return; }
    if (name === trackName) return;
    trackName = name;
    const t = ctx.currentTime;
    musG.gain.cancelScheduledValues(t);
    musG.gain.setTargetAtTime(0, t, 0.15);
    setTimeout(() => {
      if (trackName !== name) return;
      track = TRACKS[name] || null;
      step = 0; nextTime = ctx.currentTime + 0.05;
      musG.gain.setTargetAtTime(name ? 0.6 : 0, ctx.currentTime, 0.4);
    }, 450);
  };
  A.stopMusic = function () { A.music(null); };

  function noteMidi(T, deg, oct) {
    const L = T.scale.length;
    const o = Math.floor(deg / L);
    const d = ((deg % L) + L) % L;
    return T.root + 12 * (o + oct) + T.scale[d];
  }
  function voice(kind, f, t, dur, vol, type) {
    if (kind === 'pad') {
      [-7, 7].forEach(det => {
        const o = ctx.createOscillator(); o.type = type || 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 700;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(fl); fl.connect(g); g.connect(musBus); o.start(t); o.stop(t + dur + 0.05);
      });
    } else if (kind === 'bass') {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const s = ctx.createOscillator(); s.type = 'sine'; s.frequency.value = f / 2;
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(600, t); fl.frequency.exponentialRampToValueAtTime(140, t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(fl); s.connect(g); fl.connect(g); g.connect(musG);
      o.start(t); s.start(t); o.stop(t + dur + 0.05); s.stop(t + dur + 0.05);
    } else {
      const o = ctx.createOscillator(); o.type = type || 'triangle'; o.frequency.value = f;
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2600;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(fl); fl.connect(g); g.connect(musBus); o.start(t); o.stop(t + dur + 0.05);
    }
  }
  function drum(kind, t, vol) {
    if (kind === 'kick') {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(musG); o.start(t); o.stop(t + 0.35);
    } else {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
      const g = ctx.createGain(); const d = kind === 'hat' ? 0.05 : 0.18;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(f); f.connect(g); g.connect(musG); src.start(t, Math.random()); src.stop(t + d + 0.05);
    }
  }
  function playStep(s16, t) {
    const T = track;
    const spb = 60 / T.bpm;
    const bar = Math.floor(s16 / 16), s = s16 % 16;
    const deg = T.prog[bar % T.prog.length];
    if (s === 0 && T.pad) [0, 2, 4].forEach(o => voice('pad', mtof(noteMidi(T, deg + o, 0)), t, spb * 4.1, T.pad, T.padType));
    if (T.bass && T.bass[s] === 'x') voice('bass', mtof(noteMidi(T, deg, -1)), t, spb * 0.45, 0.16);
    if (T.arp && T.arp[s] === 'x') {
      const tones = [0, 2, 4, 7, 4, 2];
      const k = tones[(s + bar * 3) % tones.length];
      voice('arp', mtof(noteMidi(T, deg + k, T.arpOct || 1)), t, spb * 0.35, T.arpVol || 0.03, T.arpType);
    }
    if (T.kick && T.kick[s] === 'x') drum('kick', t, 0.38);
    if (T.snare && T.snare[s] === 'x') drum('snare', t, 0.12);
    if (T.hat && T.hat[s] === 'x') drum('hat', t, T.hatVol || 0.03);
    if (A.alert && s === 0 && bar % 2 === 0) {
      tone({ f: 480, f2: 960, dur: spb * 2, type: 'sawtooth', vol: 0.045, filter: 1800, dest: musG, delay: Math.max(0, t - ctx.currentTime) });
    }
  }
  function schedule() {
    if (!ctx || !track) return;
    while (nextTime < ctx.currentTime + 0.14) {
      playStep(step, nextTime);
      nextTime += 60 / track.bpm / 4;
      step++;
    }
  }
})(window.K);
