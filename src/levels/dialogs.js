'use strict';
// ============================================================================
//  Guion de diálogos (basado en el documento de diseño).
// ============================================================================
(function (K) {
  K.NAMES = {
    kriss: 'KRISS', explorer: 'EXPLORADOR REBELDE', vexor: 'GENERAL VEXOR',
    nyra: 'NYRA', korr: 'TENIENTE KORR',
  };
  K.DIALOGS = {
    explorer: [
      { who: 'explorer', text: 'Kriss... llegaste. Escúchame bien: no todo es lo que el Dominio te contó.' },
      { who: 'explorer', text: 'Están drenando el planeta. Busca la verdad en las cavernas, si te atreves.' },
      { who: 'kriss', text: '¿Drenando Kryndar? Resiste. Te prometo que llegaré al fondo de esto.' },
      { who: 'explorer', text: 'Un fragmento del Núcleo cayó en estas ruinas... sobre los muros altos. Llévatelo antes que ellos.' },
    ],
    radio: [
      { who: 'vexor', radio: true, text: 'Atención a todas las unidades. Se ha detectado una intrusión en el sector industrial.' },
      { who: 'vexor', radio: true, text: 'Cualquier traidor que interfiera con el Núcleo de Solthar será eliminado, sin excepciones.' },
      { who: 'kriss', text: 'Esa voz... Vexor. Mi maestro. Tendré que pasar sin que me vean.' },
    ],
    nyra: [
      { who: 'nyra', text: '¿Kriss? Así que el último guerrero de Kryndar sí volvió.' },
      { who: 'nyra', text: 'Creías que el Dominio protegía el Núcleo de Solthar, ¿verdad? Es mentira.' },
      { who: 'nyra', text: 'Lo están sobrecalentando para usarlo como arma. Si no extraemos los fragmentos ahora, la explosión partirá Kryndar en dos.' },
      { who: 'kriss', text: 'Entonces no hay tiempo. ¿Dónde está el siguiente fragmento?' },
      { who: 'nyra', text: 'Tras la última compuerta de estas cavernas. Su palanca se cierra rápido: corre y usa tu impulso.' },
    ],
    korr: [
      { who: 'korr', text: 'El General Vexor me advirtió que vendrías, Kriss.' },
      { who: 'korr', text: 'No darás un paso más hacia la Torre Central. ¡Por el orden del Dominio!' },
    ],
    vexorIntro: [
      { who: 'vexor', text: 'Cinco fragmentos... Siempre fuiste mi mejor alumno, Kriss.' },
      { who: 'kriss', text: 'Ibas a partir Kryndar en dos. ¿Todo eso por tu "orden"?' },
      { who: 'vexor', text: 'El orden exige sacrificios. Muéstrame si aprendiste algo de mí.' },
    ],
    vexorEnd: [
      { who: 'vexor', text: '¿Crees que la libertad no tiene precio? Sin el Dominio, Kryndar caerá en el caos.' },
      { who: 'vexor', text: 'Yo elegí el orden. ¿Tú qué eliges?' },
    ],
  };
  K.ENDINGS = {
    A: {
      kicker: 'FINAL A', title: 'Restaurar el Dominio', music: 'endA',
      text: 'Kriss estabiliza el Núcleo de Solthar bajo el control del imperio. El orden regresa a Kryndar y la paz —una paz forzada— cubre las ciudades. Pero los leales de Vexor capturan a Nyra, y Kriss la pierde para siempre. Kryndar sobrevive. Su voz, no.',
    },
    B: {
      kicker: 'FINAL B', title: 'Liberar Kryndar', music: 'endB',
      text: 'Kriss destruye el sistema de control del Dominio. Las cadenas del Núcleo se rompen y su luz se dispersa por todo el planeta. Junto a Nyra, Kriss contempla el primer amanecer de un Kryndar libre: un futuro incierto, pero lleno de esperanza.',
    },
  };
})(window.K);
