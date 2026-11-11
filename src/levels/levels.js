'use strict';
// ============================================================================
//  Diseño de niveles. Cada nivel se "dibuja" con MapBuilder y se convierte en
//  texto (una fila por línea). Ver la leyenda de caracteres en tilemap.js.
// ============================================================================
(function (K) {
  const B = K.MapBuilder;
  const NONE = { charge: false, dash: false, interact: false, shout: false };

  K.LEVELS = [
    // ------------------------------------------------------------------ NIVEL 1
    {
      num: 'NIVEL 1', name: 'RUINAS EXTERIORES', short: 'Ruinas Exteriores', theme: 'ruins', stealth: true,
      obj: 'Aprende a moverte y volar · Recoge el Fragmento 1/5',
      desc: 'Tutorial: movimiento, vuelo y combate básico.',
      abilities: Object.assign({}, NONE),
      hints: [
        'Muévete con A / D o las flechas ← →',
        'ESPACIO para saltar\nMantén ESPACIO en el aire para VOLAR',
        'Mantén ESPACIO para cruzar el abismo volando\nVolar gasta ENERGÍA · se recupera en el suelo',
        'CLIC IZQUIERDO (o J) para golpear\nCuidado con los conos de visión de los soldados',
        'Vuela para superar los muros altos\nEl fragmento está en lo alto de las ruinas',
      ],
      npc: { who: 'explorer', dialog: 'explorer', needE: false },
      build() {
        const m = B(124, 18);
        m.ground(0, 29, 14);
        m.set(3, 13, 'P'); m.set(6, 13, 'i');
        m.set(11, 13, 'i');
        m.fill(14, 12, 3, 2); m.fill(18, 10, 3, 4);
        m.set(26, 13, 'i');
        m.plat(35, 10, 4);
        m.ground(44, 75, 14);
        m.set(46, 13, 'C');
        m.set(52, 13, 'N');
        m.set(57, 13, 'i');
        m.set(61, 11, 'E');
        m.set(65, 13, 'S');
        m.fill(71, 12, 1, 2);
        m.set(73, 13, 'i');
        m.fill(76, 5, 4, 9);
        m.ground(80, 95, 9);
        m.set(84, 8, 'S');
        m.fill(87, 4, 5, 1); m.set(89, 3, 'F');
        m.ground(96, 123, 14);
        m.set(98, 13, 'C');
        m.plat(101, 11, 4); m.set(103, 10, 'E');
        m.set(108, 13, 'S');
        m.set(118, 13, 'X');
        return m.rows();
      },
    },
    // ------------------------------------------------------------------ NIVEL 2
    {
      num: 'NIVEL 2', name: 'DISTRITO INDUSTRIAL', short: 'Distrito Industrial', theme: 'industrial', stealth: true,
      obj: 'Cruza sin activar la Alerta Máxima · Recoge el Fragmento 2/5',
      desc: 'Sigilo: evita los conos de visión. Nuevo: Golpe Cargado.',
      abilities: Object.assign({}, NONE, { charge: true }),
      unlock: 'NUEVA HABILIDAD · GOLPE CARGADO (mantén clic o J)',
      hints: [
        'NUEVO: GOLPE CARGADO\nMantén CLIC (o J) y suelta',
        'Evita los conos de visión\n3 detecciones = ALERTA MÁXIMA',
        'Pasa por encima de las patrullas\no neutralízalas por la ESPALDA con un golpe cargado',
      ],
      triggers: [{ dialog: 'radio' }],
      build() {
        const m = B(150, 18);
        m.ground(0, 61, 14); m.ground(67, 149, 14);
        m.fill(62, 16, 5, 2); m.fill(62, 15, 5, 1, '^');
        m.set(2, 13, 'P'); m.set(5, 13, 'i'); m.set(9, 13, 'i'); m.set(12, 13, '?');
        m.set(15, 13, 'i');
        m.plat(17, 9, 13); m.set(23, 13, 'S');
        m.fill(31, 12, 2, 2);
        m.plat(36, 5, 24);
        m.set(40, 13, 'S');
        m.fill(45, 10, 10, 1); m.set(50, 9, 'S');
        m.fill(56, 12, 2, 2);
        m.set(59, 13, 'C');
        m.plat(70, 8, 18); m.set(78, 7, 'E');
        m.set(73, 13, 'S'); m.set(83, 13, 'S');
        m.fill(88, 12, 1, 2);
        m.fill(91, 8, 3, 6);
        m.plat(96, 9, 10); m.set(100, 13, 'S');
        m.fill(106, 12, 2, 2);
        m.set(109, 13, 'C');
        m.plat(112, 10, 4);
        m.fill(118, 7, 7, 1); m.set(121, 6, 'F');
        m.set(116, 13, 'S'); m.set(127, 13, 'S');
        m.fill(132, 12, 1, 2);
        m.set(145, 13, 'X');
        return m.rows();
      },
    },
    // ------------------------------------------------------------------ NIVEL 3
    {
      num: 'NIVEL 3', name: 'CAVERNAS DE KRYNDAR', short: 'Cavernas de Kryndar', theme: 'caves', stealth: true,
      obj: 'Resuelve los mecanismos · Encuentra a Nyra · Fragmento 3/5',
      desc: 'Puzles con palancas y compuertas. Nuevo: Dash e Interacción.',
      abilities: Object.assign({}, NONE, { charge: true, dash: true, interact: true }),
      unlock: 'NUEVAS HABILIDADES · DASH (Shift) e INTERACTUAR (E)',
      hints: [
        'NUEVO: DASH con SHIFT (o K)\nUn impulso rápido e invulnerable',
        'NUEVO: pulsa E para usar palancas y hablar',
        'Algunas compuertas se cierran rápido\n¡Corre y encadena el DASH!',
        'Las paredes agrietadas se rompen\ncon el GOLPE CARGADO',
        'Vuela hasta la palanca elevada',
      ],
      npc: { who: 'nyra', dialog: 'nyra', needE: true },
      levers: { 2: 1.45, 4: 1.55 },
      build() {
        const m = B(132, 20);
        m.fill(0, 0, 132, 2);
        m.ground(0, 57, 16);
        m.set(2, 15, 'P'); m.set(5, 15, 'i'); m.set(10, 15, 'i');
        m.set(14, 15, '1'); m.col(20, 2, 15, 'q');
        m.set(23, 15, 'i');
        m.set(26, 15, '2'); m.col(40, 2, 15, 'w');
        m.set(42, 15, 'C');
        m.set(45, 15, 'i');
        m.fill(49, 2, 2, 10); m.fill(49, 12, 2, 4, 'B');
        m.fill(58, 18, 6, 2); m.fill(58, 17, 6, 1, '^');
        m.ground(64, 131, 16);
        m.set(66, 15, 'i');
        m.fill(68, 10, 4, 1); m.set(69, 9, '3'); m.col(78, 2, 15, 'e');
        m.set(80, 15, 'E');
        m.set(83, 15, 'N');
        m.set(95, 15, 'S');
        m.set(98, 15, 'C');
        m.set(101, 15, '4'); m.col(113, 2, 15, 'r');
        m.set(117, 14, 'F');
        m.set(127, 15, 'X');
        return m.rows();
      },
    },
    // ------------------------------------------------------------------ NIVEL 4
    {
      num: 'NIVEL 4', name: 'FORTALEZA DEL DOMINIO', short: 'Fortaleza del Dominio', theme: 'fortress', stealth: false,
      obj: 'Ábrete paso · Derrota al Teniente Korr · Fragmento 4/5',
      desc: 'Combate intenso contra patrullas y el minijefe Korr.',
      abilities: Object.assign({}, NONE, { charge: true, dash: true, interact: true }),
      hints: [
        'FORTALEZA EN ALERTA: aquí no hay sigilo\nCombina GOLPE CARGADO + DASH',
      ],
      triggers: [{ dialog: 'korr', action: 'startKorr' }],
      build() {
        const m = B(144, 18);
        m.fill(0, 0, 144, 2);
        m.ground(0, 143, 14);
        m.set(2, 13, 'P'); m.set(6, 13, 'i');
        m.set(15, 13, 'S'); m.set(21, 13, 'S');
        m.plat(25, 10, 8); m.set(29, 9, 'S');
        m.set(37, 13, 'C');
        m.fill(44, 2, 2, 8); m.fill(44, 10, 2, 4, 'B');
        m.set(52, 13, 'S'); m.set(58, 13, 'S'); m.set(64, 13, 'S');
        m.plat(54, 10, 6); m.set(56, 9, 'E');
        m.fill(68, 12, 1, 2);
        m.set(73, 13, 'C');
        m.col(80, 2, 13, 'a');
        m.set(84, 13, '?');
        m.plat(86, 10, 4); m.plat(104, 10, 4);
        m.set(88, 9, 'E'); m.set(106, 9, 'E');
        m.set(100, 13, 'K');
        m.col(112, 2, 13, 'b');
        m.set(117, 13, 'C');
        m.set(136, 13, 'X');
        return m.rows();
      },
    },
    // ------------------------------------------------------------------ NIVEL 5
    {
      num: 'NIVEL 5', name: 'TORRE CENTRAL', short: 'Torre Central', theme: 'tower', stealth: false,
      obj: 'Escala hasta la cima · Recoge el Fragmento 5/5',
      desc: 'Plataformas verticales con gravedad dinámica.',
      abilities: Object.assign({}, NONE, { charge: true, dash: true, interact: true }),
      hints: [
        // los carteles se asignan en orden de lectura (de arriba hacia abajo)
        'En la gravedad extrema no puedes volar:\nsube saltando por los escalones',
        'Las zonas intermitentes parpadean antes de activarse\nCrúzalas volando cuando estén apagadas',
        'TORRE CENTRAL: escala hasta la cima\nZonas violetas = GRAVEDAD EXTREMA (no puedes volar)',
      ],
      vertical: true,
      build() {
        const m = B(40, 112);
        m.fill(0, 0, 2, 112); m.fill(38, 0, 2, 112);
        m.fill(2, 108, 36, 4);
        m.set(6, 107, 'P'); m.set(11, 107, 'i');
        m.fill(14, 102, 6, 1); m.fill(26, 97, 7, 1); m.fill(10, 92, 8, 1); m.fill(24, 87, 9, 1);
        m.set(26, 86, 'C'); m.set(30, 86, 'i');
        m.fill(2, 78, 36, 5, 'h');
        m.fill(4, 77, 12, 1);
        m.set(8, 76, 'C');
        m.fill(20, 71, 6, 1); m.fill(30, 66, 6, 1); m.fill(33, 65, 2, 1, '^');
        // banda de gravedad fija con escalera interior
        m.fill(2, 50, 36, 10, 'g');
        m.plat(2, 61, 36);
        for (let k = 0; k <= 10; k++) m.fill(30 - k * 2, 60 - k, 3, 1);
        m.set(35, 60, 'i');
        m.set(11, 49, 'C');
        m.fill(20, 44, 6, 1); m.fill(28, 39, 7, 1); m.set(31, 38, 'E');
        m.fill(2, 30, 36, 5, 'h');
        m.fill(6, 28, 10, 1);
        m.fill(22, 23, 6, 1); m.fill(24, 22, 2, 1, '^'); m.fill(30, 18, 6, 1);
        m.fill(8, 12, 24, 1);
        m.set(10, 11, 'C'); m.set(20, 10, 'F'); m.set(28, 11, 'X');
        return m.rows();
      },
    },
    // ------------------------------------------------------------------ JEFE
    {
      num: 'ZONA FINAL', name: 'CIMA DE LA TORRE', short: 'Jefe: General Vexor', theme: 'boss', stealth: false, boss: true,
      obj: 'Derrota al General Vexor',
      desc: 'Combate final. Nuevo: Grito de Resistencia (Q).',
      abilities: { charge: true, dash: true, interact: true, shout: true },
      unlock: 'NUEVA HABILIDAD · GRITO DE RESISTENCIA (Q)',
      triggers: [{ dialog: 'vexorIntro', action: 'startBoss' }],
      build() {
        const m = B(40, 18);
        m.ground(0, 39, 14);
        m.fill(1, 3, 10, 11, 'y'); m.fill(29, 3, 10, 11, 'z');
        m.plat(14, 10, 4); m.plat(22, 10, 4);
        m.set(15, 13, 'P'); m.set(17, 13, '?');
        m.set(25, 9, 'V');
        return m.rows();
      },
    },
  ];
})(window.K);
