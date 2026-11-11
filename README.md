# KRYNDAR: Ascenso y Caída

Juego 2D de acción, sigilo y plataformas (side‑scroller) hecho con **HTML5 Canvas, CSS y JavaScript puro** en Visual Studio Code.
Concepto y diseño: **Rodrigo Alfaro** — Programación Orientada a Entornos Multimediales.

### ▶ [Jugar ahora en el navegador](https://rodrigo-manuel.github.io/kryndar-ascenso-y-caida/)

Todo el arte, la animación, las partículas, la iluminación, la música y los efectos de sonido se **generan por código**: no hay archivos de imagen ni de audio.

## Cómo ejecutarlo

Opción 0 — en línea: https://rodrigo-manuel.github.io/kryndar-ascenso-y-caida/

Opción 1 — doble clic en `index.html` (funciona en Chrome/Edge/Firefox).

Opción 2 — servidor local (recomendado; desde la carpeta del proyecto):

```bash
python -m http.server 8765
```

y abrir `http://localhost:8765`. En VS Code también sirve la extensión *Live Server*.

## Controles

| Acción | Tecla | Desbloqueo |
|---|---|---|
| Moverse | A / D o ← → | Nivel 1 |
| Saltar / **Volar** (mantener, gasta energía) | ESPACIO | Nivel 1 |
| Golpe básico | Clic izquierdo o J | Nivel 1 |
| Golpe cargado (mantener y soltar) | Clic / J | Nivel 2 |
| Dash / esquive (invulnerable) | SHIFT o K | Nivel 3 |
| Interactuar (palancas, diálogos) | E | Nivel 3 |
| Grito de Resistencia | Q | Jefe final |
| Bajar de plataformas finas | S / ↓ | Siempre |
| Pausa | ESC o P | Siempre |
| Silenciar | M | Siempre |

## Contenido

- **Nivel 1 – Ruinas Exteriores** (tutorial): movimiento, vuelo, combate, explorador rebelde.
- **Nivel 2 – Distrito Industrial** (sigilo): conos de visión, 3 detecciones = Alerta Máxima, transmisión de Vexor, golpe cargado (por la espalda neutraliza).
- **Nivel 3 – Cavernas de Kryndar** (puzles): palancas, compuertas temporizadas (dash), muros agrietados, Nyra.
- **Nivel 4 – Fortaleza del Dominio** (combate): oleadas y el **Teniente Korr** (escudo, combo, embestida).
- **Nivel 5 – Torre Central** (plataformas): ascenso vertical con gravedad extrema fija e intermitente.
- **Jefe – General Vexor**: embestidas, Grito de Frecuencia (contraataque con Q o esquivar con dash), zonas de gravedad que lo derriban. Decisión final con **dos finales**.

Reglas: la barra de **energía** es salud y combustible de vuelo (verde > 50 %, amarillo > 25 %, rojo); se recupera en el suelo. Si llega a 0 reapareces en el último punto de control. Hay que reunir los **5 fragmentos** para llegar a la zona final. El progreso se guarda en el navegador; en *Seleccionar nivel* hay un botón para desbloquear todo (útil para presentar).

## Estructura

```
index.html            ventana, menús y pantallas (HTML)
css/style.css         estilo de la interfaz (CSS)
src/core/             engine.js (utilidades y entrada), audio.js (Web Audio), fx.js (partículas), tilemap.js (mapas y física)
src/render/           rig.js (esqueleto animado de personajes y capa), themes.js (fondos, baldosas, iluminación)
src/entities/         player.js, soldier.js (IA y conos), korr.js, vexor.js, props.js (objetos del escenario)
src/levels/           levels.js (mapas en texto), dialogs.js (guion)
src/ui/               hud.js (HUD en canvas), screens.js (pantallas y diálogos)
src/main.js           bucle principal y máquina de estados
```

Los niveles se describen como **texto** (un carácter por baldosa); la leyenda está al inicio de `src/core/tilemap.js`.

## Pruebas (QA)

`tests/autopilot.js` es un piloto automático que juega cada nivel con entradas de teclado simuladas (no se carga en el juego normal).
Para usarlo, abre el juego con el servidor local y en la consola del navegador (F12) ejecuta:

```js
const s = document.createElement('script'); s.src = 'tests/autopilot.js'; document.body.appendChild(s);
// luego, por ejemplo:
await KTest.run(0)   // nivel 1 → { done: true, deaths, detections, ... }
```

Verificado: los 5 niveles se completan en secuencia sin errores de consola, el jefe se vence con la estrategia del juego
(gravedad + Q + dash), ambos finales, menús, pausa, guardado, reaparición, cambio de tamaño de ventana y apertura por doble clic.
