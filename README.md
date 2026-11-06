# NIEBLA

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
