# Plantilla de guion — NIEBLA

Copia este formato para cada escena. Solo hay **5 cosas** que rellenar.
No hace falta que sea perfecto: si algo no encaja, lo hablamos.

---

## ESCENA: nombre_corto
**Imagen:** qué se ve (ej. «el lago con la luna» o una de las existentes: claro, bosque, fuegos, puente, lago, cabaña, oscuro, luz, niebla)
**Niebla:** poca / media / mucha

Aquí va el texto que lee el jugador.
Cada párrafo, separado por una línea en blanco.

**Opciones:**
- Texto del botón → nombre_de_la_escena_a_la_que_lleva
- Otra opción → otra_escena  [consigue: farol]
- Opción secreta → escena_secreta  [solo si: farol]
- Opción si NO tiene algo → otra  [solo si no: farol]

---

## FINAL: nombre_corto
**Título del final:** EL NOMBRE QUE SE MUESTRA
**Imagen:** ...
**Niebla:** ...

Texto del final.

---

## Reglas para evitar confusiones

1. **Nombres de escena**: cortos, en minúscula, sin espacios ni tildes (`puente_roto`, `cabana_dentro`).
   Son las «direcciones» del juego: una opción lleva a una escena por su nombre exacto.
2. **Objetos y recuerdos** (`farol`, `recuerdo`, `cinta`...): escríbelos siempre igual.
   - `[consigue: x]` → Lía lo obtiene al elegir esa opción.
   - `[pierde: x]` → lo pierde.
   - `[solo si: x]` / `[solo si no: x]` → la opción solo aparece si lo tiene / no lo tiene.
3. **Una escena = un bloque**. Empieza siempre con `## ESCENA:` o `## FINAL:`.
4. La primera escena del juego se llama `inicio`.
5. Si quieres una imagen nueva, descríbela con libertad en **Imagen:** y yo la dibujo.

## Ejemplo real (la escena actual del puente)

## ESCENA: sendero
**Imagen:** puente
**Niebla:** poca

El sendero termina en un puente de cuerdas sobre un barranco sin fondo.

Al otro lado, una cabaña con una ventana encendida.

Las tablas crujen solo de mirarlas.

**Opciones:**
- Cruzar el puente → cabana
- Volver y seguir las luces → luces
