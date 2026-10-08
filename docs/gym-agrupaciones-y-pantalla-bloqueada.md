# Agrupaciones de ejercicios y marcar series sin mirar el celular

Resumen de la investigación y de lo que ya hace la app. Fuentes al final; donde algo viene de conocimiento general y no de una fuente, se dice.

## 1. Cómo agrupan los entrenadores

| Técnica | Qué es | Ejemplo |
|---|---|---|
| **Superserie** | Dos ejercicios seguidos con poco o ningún descanso; mismo músculo o músculos opuestos | curl de bíceps → martillo |
| **Pre-agotamiento** | Aislado primero para fatigar el músculo y luego el compuesto | extensión de cuádriceps → sentadilla |
| **Post-agotamiento** | Primero el compuesto y luego el aislado | sentadilla → extensión |
| **Tri-serie / serie gigante** | 3 ejercicios seguidos / 4 o más | — |
| **Serie descendente (drop set)** | Se llega cerca del fallo, se baja la carga 20–30 % y se sigue sin descanso | 80 → 60 → 40 kg |
| **Rest-pause** | Fallo, ~10 s de pausa y se sigue con el mismo peso | — |
| **Escalera (ladder)** | Las reps suben (1-2-3-4-5) o bajan de serie en serie | 1, 2, 3 … 8 |
| **Complejo** | Varios ejercicios encadenados sin soltar la carga (dato de conocimiento general, no de las fuentes) | sentadilla → press |

Lo que describes (extensión pesada de 10 → zancadas 2 + sentadillas 1 → zancadas 2 + sentadillas 2 → …) combina **pre-agotamiento** (aislado pesado primero) con una **escalera de reps** en la sentadilla, todo como **una sola serie**. No es una técnica con un nombre único; es una combinación válida de las anteriores.

Los datos de las fuentes son pautas de entrenadores, no estándares científicos: p. ej. una guía de escaleras 1-2-3-4-5 usa ≥ 80 % del 1RM, 1–6 reps por serie y 10–25 reps totales. Los drop sets se recomiendan con moderación (uno por músculo y sesión suele bastar).

## 2. ¿Estaba bien nuestra forma de configurar la agrupación?

**Lo que ya tenía la app:** superserie (los ejercicios del grupo se hacen en rondas, sin descanso entre ellos y con descanso al cerrar la ronda), "Rondas" y "Escalera de reps" para un ejercicio del bloque (inicio, sube, tope) y drop sets por serie.

**Lo que no cubría tu caso:**
1. Todos los ejercicios del bloque se repetían en **todas** las rondas: la extensión pesada salía cada vuelta.
2. Cada ronda era una "serie" con descanso: no existía "todo el bloque es **una** serie".

**Qué se agregó** (en el constructor de rutinas, panel *Superserie*):
- **«1× inicio»** por ejercicio: se hace una sola vez al comienzo y no vuelve en las rondas siguientes (queda con 1 serie).
- **«Todo el bloque es 1 serie»**: sin descanso entre rondas; solo se descansa al terminar. El entrenamiento activo muestra "Serie compuesta: ronda 2 de 8".

**Cómo armar tu ejemplo:**
1. Agrupa Extensión de cuádriceps + Zancadas + Sentadilla.
2. Extensión: marca **1× inicio**, pon el peso y 10 reps (pesado).
3. Zancadas: 2 reps. Sentadilla: elige **Escalera** (inicio 1, sube 1, tope 8) con la sentadilla como objetivo.
4. Activa **Todo el bloque es 1 serie**.

**Evaluación:** el modelo (ejercicio → series con reps y peso, más un `grupo`) es correcto y suficiente porque cada ronda ya es una fila de series por ejercicio. Dos límites que quedan:
- Dentro de una ronda no se puede poner un *drop set* a un miembro del bloque desde el constructor (sí durante el entrenamiento, por serie).
- Los "pesos que suben o bajan por ronda" se editan a mano en cada serie; no hay una escalera de peso (solo de reps).

## 3. Botón de volumen y botón en pantalla bloqueada (web móvil)

**Resultado: en una web no es viable de forma fiable; en la app móvil nativa sí.**

| Opción | Android (Chrome) | iPhone (Safari / PWA) | Veredicto |
|---|---|---|---|
| **Botones de volumen** como "check" | Una web normalmente no recibe esa pulsación (conocimiento general; no lo confirma ninguna fuente de la búsqueda) | Tampoco | ❌ Solo con app nativa |
| **Media Session API** (botones "siguiente/anterior" en la pantalla bloqueada y auriculares) | Funciona (Chrome 73+), pero necesita que **esté sonando un audio** de la página | Soporte irregular en PWA instaladas | ⚠️ Posible con un audio en bucle casi mudo; frágil |
| **Notificación con botones** (service worker + `showNotification` con `actions`) | Hasta **2 botones** de texto (comprobar `Notification.maxActions`) | Los botones propios **no se muestran** (reporte en el foro de Apple, iOS 16.4) | ⚠️ Solo Android; además exige push |
| **Plugin de botones de volumen en Capacitor** | Soportado | Soportado | ✅ **Recomendado** al empaquetar la app |

**Recomendación:** para "apretar volumen = hecho serie" y un botón grande con la pantalla bloqueada, hacerlo al convertir la web en app móvil (Capacitor): plugin de botones de volumen para el check, y la Media Session nativa de Capacitor para los controles en la pantalla de bloqueo. En web pura, lo máximo razonable hoy es Media Session en Android con un audio en bucle, y no lo recomiendo por frágil. **No se implementó nada de esto en la web.**

## 4. Tibial anterior

Se agregaron 7 ejercicios en la categoría **Pantorrilla** (músculo primario «Tibial anterior»): elevación de puntas en pared, sentado con disco/mancuerna, barra tibial, máquina, banda, polea baja y caminata sobre talones. No tienen imagen todavía (la ficha muestra el ícono por defecto) y no tienen estándar de rango.

## Fuentes
- [Media Session API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API) · [Media Session (web.dev)](https://web.dev/articles/media-session) · [Media Session en iOS PWA (dbushell)](https://dbushell.com/2023/03/20/ios-pwa-media-session-api/)
- [Notification actions (Chrome)](https://developer.chrome.com/blog/notification-actions) · [Actions en iOS 16.4 (foro de Apple)](https://developer.apple.com/forums/thread/726793)
- [Plugin de botones de volumen (Capacitor, Capgo)](https://capgo.app/docs/plugins/volume-buttons) · [Volumen (Capawesome)](https://capawesome.io/docs/sdks/capacitor/volume/)
- [Tipos de series (Iron Man)](https://www.ironmanmagazine.com/workout-sets-different-types-and-how-to-perform/) · [Técnicas avanzadas (Muscle & Strength)](https://www.muscleandstrength.com/articles/guide-to-advanced-muscle-building-training-techniques.html) · [Tipos de series (Livestrong)](https://livestrong.com/article/106421-types-weight-training-sets)
- [Ladder sets (Breaking Muscle)](https://breakingmuscle.com/fitness/how-to-use-ascending-reps-to-build-size-and-strength) · [Ladder training (Tonal)](https://tonal.com/blog/ladder-training-fitness-strength-and-intensity)
