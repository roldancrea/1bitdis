/*
 * HISTORIA
 * Cada escena tiene:
 *   art:     qué ilustración dibujar (ver js/render.js)
 *   fog:     densidad de la niebla, de 0 a 1
 *   text:    lista de párrafos
 *   choices: opciones. Cada opción puede tener:
 *              to:  escena destino
 *              set: banderas que se activan, ej. { candil: true }
 *              if:  condición, ej. "candil" o "!candil"
 *   ending:  si existe, la escena es un final (título del final)
 */
const STORY = {
  start: "inicio",

  scenes: {
    inicio: {
      art: "claro", fog: 0.55,
      text: [
        "Lía despierta sobre musgo húmedo. No recuerda haberse dormido.",
        "La niebla lo cubre todo. A lo lejos suena una campana, lenta, como si contara algo.",
        "A su lado, sobre una roca cubierta de musgo, hay un candil apagado. Una rana lo vigila sin parpadear.",
      ],
      choices: [
        { text: "Coger el candil", to: "candil", set: { candil: true } },
        { text: "Seguir el sonido de la campana", to: "campana" },
      ],
    },

    candil: {
      art: "candil", fog: 0.3,
      text: [
        "Lía se acerca a la roca. La rana no se mueve; solo la mira.",
        "El metal está frío. En cuanto lo roza, una llama verde se enciende sola. La rana croa una vez, como si diera permiso.",
        "La niebla retrocede un paso, como un animal que respeta el fuego.",
        "Aparece un sendero. Y, entre los árboles, pequeñas luces que flotan.",
      ],
      choices: [
        { text: "Seguir el sendero", to: "sendero" },
        { text: "Seguir las luces", to: "luces" },
      ],
    },

    campana: {
      art: "bosque", fog: 0.65,
      text: [
        "Los árboles se cierran a su paso. La campana ya no suena delante: suena en todas partes.",
        "Entonces, muy cerca de su oído, alguien susurra su nombre.",
        "«Lía...»",
      ],
      choices: [
        { text: "Responder", to: "voz", set: { respondio: true } },
        { text: "Taparse los oídos y correr", to: "corre" },
      ],
    },

    luces: {
      art: "fuegos", fog: 0.5,
      text: [
        "Las luces giran a su alrededor. Son fuegos fatuos, y están jugando.",
        "Por un momento forman la silueta de una niña de su edad. Luego se alejan hacia el agua, como invitándola.",
      ],
      choices: [
        { text: "Ir con ellas", to: "lago" },
        { text: "Apagar el candil y esconderse", to: "oscuridad", if: "candil", set: { candil: false } },
      ],
    },

    sendero: {
      art: "puente", fog: 0.35,
      text: [
        "El sendero termina en un puente de cuerdas sobre un barranco sin fondo.",
        "Al otro lado, una cabaña con una ventana encendida.",
        "Las tablas crujen solo de mirarlas.",
      ],
      choices: [
        { text: "Cruzar el puente", to: "cabana" },
        { text: "Volver y seguir las luces", to: "luces" },
      ],
    },

    voz: {
      art: "bosque", fog: 0.75,
      text: [
        "—¿Quién eres? —pregunta Lía.",
        "«Soy lo que dejaste aquí», dice la voz. Suena a su abuela, pero más lejana.",
        "Algo cae a sus pies: una cinta roja, aunque aquí todo es verde. La recuerda. La recuerda de verdad.",
      ],
      choices: [
        { text: "Preguntar cómo salir", to: "consejo", set: { recuerdo: true } },
        { text: "Desconfiar y huir", to: "corre", set: { recuerdo: true } },
      ],
    },

    consejo: {
      art: "bosque", fog: 0.6,
      text: [
        "«El lago no miente», susurra la voz. «Lo que ves en él es lo que eres. Di mi nombre allí, y te llevaré a casa.»",
        "La niebla se abre lo justo para mostrar el brillo del agua.",
      ],
      choices: [
        { text: "Ir al lago", to: "lago" },
      ],
    },

    corre: {
      art: "bosque", fog: 0.8,
      text: [
        "Corre hasta que le arden los pulmones. Las ramas le arañan los brazos.",
        "Tropieza. Cae. Cuando levanta la cabeza, el bosque ha cambiado de sitio.",
        "Delante hay una cabaña. A su izquierda, el brillo quieto de un lago.",
      ],
      choices: [
        { text: "Entrar en la cabaña", to: "cabana" },
        { text: "Acercarse al lago", to: "lago" },
      ],
    },

    oscuridad: {
      art: "oscuro", fog: 0.3,
      text: [
        "Oscuridad total. Las luces pasan de largo, buscándola.",
        "En el silencio, Lía oye algo que no pertenece a este lugar: un rumor lejano de coches. Una sirena.",
      ],
      choices: [
        { text: "Caminar a ciegas hacia ese sonido", to: "final_casa" },
        { text: "Volver a encender el candil", to: "lago", set: { candil: true } },
      ],
    },

    lago: {
      art: "lago", fog: 0.45,
      text: [
        "El agua está tan quieta que parece un espejo.",
        "En ella se refleja otra Lía. Pero alrededor de esa otra Lía no hay niebla.",
        "La otra Lía levanta una mano. Espera.",
      ],
      choices: [
        { text: "Decir el nombre de la abuela", to: "final_casa", if: "recuerdo" },
        { text: "Tocar el reflejo", to: "final_reflejo" },
        { text: "Alejarse del agua", to: "cabana" },
      ],
    },

    cabana: {
      art: "cabana", fog: 0.5,
      text: [
        "Dentro hay una mesa con dos tazas. Una todavía humea.",
        "En la pared, un espejo cubierto con una sábana.",
        "Nadie responde cuando Lía pregunta si hay alguien.",
      ],
      choices: [
        { text: "Dejar el candil en la ventana", to: "final_faro", if: "candil" },
        { text: "Destapar el espejo", to: "final_reflejo" },
        { text: "Sentarse a esperar", to: "final_niebla" },
      ],
    },

    // ---------- FINALES ----------
    final_casa: {
      art: "luz", fog: 0.1, ending: "VOLVER",
      text: [
        "La niebla se rompe como papel mojado.",
        "Lía abre los ojos en una cama de hospital. Alguien le sujeta la mano. Huele a casa.",
        "En su muñeca lleva atada una cinta roja.",
      ],
    },

    final_reflejo: {
      art: "lago", fog: 0.2, ending: "EL OTRO LADO",
      text: [
        "Su mano atraviesa la superficie y el mundo da la vuelta.",
        "Ahora es ella quien mira desde el agua. Arriba, otra niña perdida se asoma.",
        "Lía levanta una mano. Espera.",
      ],
    },

    final_niebla: {
      art: "niebla", fog: 1, ending: "QUEDARSE",
      text: [
        "Espera tanto que olvida qué esperaba.",
        "La taza deja de humear. La niebla entra por las rendijas, suave, y la abraza.",
        "Ya no tiene frío. Ya no tiene nombre.",
      ],
    },

    final_faro: {
      art: "ventana", fog: 0.2, ending: "LA LUZ EN LA VENTANA",
      text: [
        "Coloca el candil junto al cristal. La llama crece, verde y tranquila. Los mosquitos acuden a bailar a su alrededor.",
        "Lía comprende que no va a salir. Pero cualquiera que se pierda aquí verá esta luz.",
        "Y nadie más tendrá que esperar sola.",
      ],
    },
  },
};
