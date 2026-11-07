# NIEBLA

Hay dos versiones:

- **1-bit** (raíz del proyecto): aventura de texto con ilustraciones de dos colores.
- **PS1** (`ps1/`): point & click en 3D low-poly al estilo PlayStation. Es una demo con tres lugares (claro, puente y cabaña) y un final.

Juego narrativo de decisiones para móvil, con estética 1-bit (verde y morado).
Lía despierta perdida en un bosque fantasmagórico cubierto de niebla.

## Jugar en local

No hace falta instalar nada. Desde esta carpeta:

```bash
python3 -m http.server 8000
```

y abre `http://localhost:8000` (en el móvil, usa la IP del ordenador en la misma red Wi-Fi).
Se puede instalar como app con «Añadir a pantalla de inicio».

## Estructura

| Archivo | Qué hace |
|---|---|
| `js/story.js` | **La historia**: escenas, textos, opciones y finales. Aquí se escribe. |
| `js/render.js` | Ilustraciones 1-bit (128×96 px) y la niebla animada con tramado. |
| `js/engine.js` | Motor: máquina de escrituras, decisiones, banderas, guardado. |
| `style.css` | Paleta (`--bg`, `--fg`) y la interfaz. |
| `sw.js`, `manifest.webmanifest` | Para instalarlo y jugar sin conexión. |

## Añadir una escena

```js
mi_escena: {
  art: "bosque",       // claro, bosque, fuegos, puente, lago, cabana, oscuro, luz, niebla
  fog: 0.5,            // 0 = sin niebla, 1 = niebla total
  text: ["Párrafo uno.", "Párrafo dos."],
  choices: [
    { text: "Una opción", to: "otra_escena", set: { llave: true } },
    { text: "Solo si tiene la llave", to: "puerta", if: "llave" },
  ],
},
```

Para un final, quita `choices` y añade `ending: "NOMBRE DEL FINAL"`.

## Versión PS1 (`ps1/`)

| Archivo | Qué hace |
|---|---|
| `ps1/js/ps1.js` | Efecto PS1: 320×240, vértices que tiemblan, texturas deformadas, color con tramado, niebla. Texturas generadas. |
| `ps1/js/models.js` | Modelos low-poly: Lía, rana, candil, roca, pinos, cabaña, puente, niebla, mosquitos. |
| `ps1/js/game.js` | Lugares, objetos con los que interactuar, diálogos y cámara. |
| `ps1/lib/three.min.js` | Three.js r128 (licencia MIT, ver `THREE-LICENSE`). |

Se juega tocando el suelo para caminar y tocando los objetos para ver las acciones.
