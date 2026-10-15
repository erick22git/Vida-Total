# Roadmap: visión por cámara y fotos

**Estado (sección 2, cámara en vivo): Fases A–E implementadas.** El conteo de reps por cámara con
sugerencia de confirmación (sección 2.1.8) y de nota "mala técnica" (sección 2.1.9/Fase E) están en
`src/lib/camara/` y conectadas a `/gym/entrenamiento/activo` y `/gym/entrenamiento/camara`. El
resumen de cada fase queda al final de la sección 2 ("Estado de implementación"). La sección 1
(estimación de % de grasa por foto) sigue sin implementar — es un problema más abierto (necesita un
modelo entrenado contra un método de referencia que esta app no tiene) y queda para cuando el
usuario lo pida explícitamente.

## 1. Estimación de % de grasa por fotos

**Qué sería:** a partir de 1-4 fotos (frente, perfil, espalda — el ángulo que más se use en apps
similares), estimar % de grasa corporal sin báscula ni calibre.

**Por qué es menos preciso que la alternativa que ya existe (bioimpedancia, Fase 2 de este trabajo):**
- La bioimpedancia en sí ya es una estimación (no un dato de laboratorio) — la báscula mide
  resistencia eléctrica y aplica una fórmula poblacional; depende de hidratación, hora del día,
  comida/ejercicio reciente.
- Una estimación por foto depende además de: iluminación, pose, calidad de cámara, ropa, y requiere
  un modelo de visión entrenado con fotos etiquetadas por un método de referencia real (DEXA, el
  estándar de oro, o calibre con un evaluador entrenado) — ninguno de los dos se usa en esta app.
- Sin ese modelo (entrenarlo requiere un dataset de fotos + su % de grasa real medido por DEXA, que
  esta app no tiene y no se puede generar de la nada), cualquier estimación por foto en el cliente
  sería, en el mejor caso, una heurística visual aproximada (ej. contornos, sombras del abdomen) con
  un margen de error bastante mayor al de la bioimpedancia.

**Método de referencia si se investiga más adelante:**
- DEXA (absorciometría de rayos X de energía dual) es el estándar de oro de uso clínico, pero
  requiere equipamiento médico — no es algo que la app pueda ofrecer, solo citar como referencia de
  qué tan preciso NO va a ser lo que sí se puede hacer en el teléfono.
- Modelos públicos de estimación de composición corporal por foto existen en la literatura
  (generalmente entrenados contra DEXA), pero usarlos acá implicaría: (a) evaluar su licencia y si se
  pueden correr on-device (WASM/TF.js) sin mandar la foto a un servidor, dado que las fotos de
  bioimpedancia de la Fase 2 ya se guardan localmente por el mismo criterio de privacidad que el resto
  de fotos de progreso de la app, y (b) documentar su margen de error reportado en el paper original,
  no inventar uno.
- Hasta no hacer esa investigación, **no hay que prometer un número** — si se implementa, la UI debe
  dejar tan claro como la nota de bioimpedancia (o más) que es una aproximación visual, con un rango
  de error explícito citado de la fuente del modelo que se termine usando.

## 2. Cámara en vivo para rango de movimiento y técnica

**Qué sería:** usar la cámara del teléfono durante una serie para:
- Contar repeticiones automáticamente a partir de ángulos articulares (ej. ángulo de rodilla en una
  sentadilla cruza un umbral de "abajo" y vuelve a cruzar el de "arriba" = 1 repetición).
- Dar una puntuación gruesa de forma: profundidad alcanzada, alineación (rodillas no se van hacia
  adentro, espalda no se redondea más de cierto umbral), simetría izquierda/derecha.

**Tecnología propuesta:** MediaPipe Pose (modelo de estimación de pose de Google, corre vía WASM en el
navegador) — **sin backend**: el video nunca sale del dispositivo, el modelo corre localmente en el
cliente, igual que ya hace el escáner de código de barras / fotos con la cámara hoy (nada de la cámara
se sube a ningún servidor salvo que el usuario decida guardar una foto, como ya pasa en el resto de la
app). Esto es consistente con el criterio de privacidad que ya sigue el proyecto.

**Qué va a medir bien y qué no (para dejarlo claro en la UI cuando se implemente):**
- **Sí** puede detectar errores de forma *visibles* desde afuera: una sentadilla que no llega a
  paralelo, una espalda que se redondea mucho, una asimetría marcada entre un lado y el otro.
- **No** mide estímulo muscular con precisión de laboratorio — no reemplaza un RIR reportado por el
  usuario ni mide activación muscular real (eso requeriría EMG, no una cámara). Tampoco corrige
  errores de técnica más sutiles que un entrenador humano sí detecta (velocidad de la fase excéntrica,
  tensión mantenida, etc.).
- La puntuación de forma debe presentarse como lo que es — una detección automática de errores
  gruesos y visibles — nunca como una evaluación completa de la técnica, para no dar una falsa
  sensación de precisión.

**Qué falta investigar antes de implementar (no asumido acá):**
- Qué ángulos articulares y qué umbrales usar por ejercicio (sentadilla, peso muerto, press banca…) —
  esto necesita su propia investigación con fuente citada por ejercicio, no un umbral inventado.
- Rendimiento de MediaPipe Pose en el rango de teléfonos que realmente usa la base de usuarios (gama
  media/baja puede no sostener la inferencia en tiempo real sin lag).
- Cómo se integra con el flujo de registro de series ya existente (¿reemplaza el conteo manual de
  reps? ¿lo complementa? ¿qué pasa si el usuario no tiene buena luz o el teléfono no tiene dónde
  apoyarse para ver el cuerpo completo?).

## 2.1 Fase 5 — investigación y plan técnico (cámara en vivo, esqueleto rojo/verde)

**Estado: investigación cerrada, plan propuesto, SIN código de producción todavía.** Esta sección
responde punto por punto al encargo de investigación de Fase 5. Falta tu aprobación explícita antes
de pasar a implementar nada de esto.

### 1. Motor de pose: MediaPipe Pose Landmarker

- Corre en el navegador vía el paquete `@mediapipe/tasks-vision` (WASM + opcional delegado GPU),
  instalable por npm o CDN (jsDelivr). Es la pieza de MediaPipe que corresponde — Pose Landmarker,
  no el Pose Solution viejo (deprecado).
- Licencia: el código de ejemplo y los headers de archivo que Google publica para Pose Landmarker
  están bajo Apache License 2.0 (uso comercial permitido). No encontré el campo `license` del
  `package.json` publicado del paquete `@mediapipe/tasks-vision` en sí en esta búsqueda — **antes de
  escribir una sola línea de código hay que confirmar el LICENSE/`license` field exacto del paquete
  en npm/GitHub**, y por separado los términos de los archivos de modelo `.task` (se descargan de un
  bucket de Google, no vienen con el mismo texto de licencia que el código). Es un chequeo de 5
  minutos, pero no lo voy a dar por hecho sin verlo.
- Confirmado por búsqueda: no existe ningún componente web reusable con licencia abierta que ya
  dibuje "esqueleto rojo/verde" con comparación contra un rango de movimiento — los proyectos
  equivalentes que hacen eso son apps nativas (iOS/Swift) o scripts de escritorio en Python. El
  overlay, las reglas de ángulo por ejercicio y el coloreado hay que construirlos a medida sobre
  MediaPipe Pose (que solo da los landmarks, no el análisis).
  Fuentes: [Pose landmark detection guide for Web](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js).

### 2. Aclaración de alcance — "distintos ángulos" ≠ múltiples cámaras

Queda explícito para no prometer de más en la UI: esto mide **varios ángulos articulares con una
sola cámara 2D** (ej. rodilla + cadera en sentadilla, visibles desde un mismo plano). No es
reconstrucción 3D volumétrica real ni usa varias cámaras físicas — una sola cámara de celular no
puede dar eso. MediaPipe sí entrega coordenadas "world" (pseudo-3D estimadas a partir de la imagen
2D), pero siguen siendo una estimación de profundidad hecha por el modelo, no una medición
estereoscópica real. La UI debe hablar de "ángulos de las articulaciones visibles desde la cámara",
nunca de "escaneo 3D de tu cuerpo".

### 3. Ángulos y umbrales por ejercicio — resultado de la investigación

La instrucción fue explícita: si no hay fuente confiable para un ejercicio, dejarlo fuera en vez de
inventar un umbral. Con eso en mente, la investigación de biomecánica deportiva da resultados muy
distintos de calidad según ejercicio:

- **Sentadilla — sí hay base, pero sin un número único de consenso.** Múltiples estudios coinciden en
  que la profundidad de la sentadilla depende principalmente del rango de flexión de rodilla (más que
  de cadera o tobillo), y que el rango de dorsiflexión normal de tobillo (≈20° dorsiflexión) es lo que
  limita bajar con los talones en el piso. No hay un grado exacto de "paralelo" acordado entre
  estudios — varía con el ancho de postura, el ángulo del pie y el nivel del lifter. **Decisión para
  el plan:** usar la definición reglamentaria de powerlifting (parte superior del muslo a la altura de
  la cadera rompe el paralelo con la parte superior de la rodilla) traducida a "ángulo de rodilla
  ≈90° o menos" como umbral de referencia, documentado como aproximación práctica — no como un
  número de laboratorio citado letra por letra. Fuentes:
  [Frontiers in Sports and Active Living 2024](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1454309/pdf),
  [BMC Sports Science 2018](https://bmcsportsscimedrehabil.biomedcentral.com/track/pdf/10.1186/s13102-018-0103-7).
- **Peso muerto — la mejor fuente de las cuatro.** Schellenberg et al. 2013 (análisis de movimiento 3D,
  n=13) midió flexión máxima de rodilla ≈103–108° en el setup del peso muerto convencional, y flexión
  de cadera consistentemente mayor que en el "good morning". Es un estudio pequeño pero con método
  cuantitativo claro y citable. Fuente:
  [Schellenberg et al. 2013, PMC3878967](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3878967/).
- **Press de banca — SIN fuente confiable, queda fuera de la primera tanda.** Los únicos números de
  ángulo de codo que encontré son de proyectos de laboratorio estudiantiles (Universidad de Michigan)
  que se contradicen entre sí (115–120° de rango un reporte, 147° el otro) por usar convenciones de
  medición distintas. El único estudio revisado por pares que encontré (JSSM 2019) mide rango
  completo/parcial en categorías, no en grados. No hay base suficientemente confiable para prometer un
  umbral de "técnica correcta" en grados — se deja fuera de esta tanda.
- **Curl de bíceps — SIN fuente confiable, queda fuera de la primera tanda.** El único dato de ángulo
  que encontré (≈12–18° en flexión máxima a ≈168–175° en extensión) viene de un único proyecto de
  captura de movimiento de alcance estudiantil, no de un estudio revisado por pares con n reportado
  rigurosamente. Se deja fuera por el mismo criterio.

**Consecuencia para el plan:** la primera tanda de "puntuación de forma" (segmento que se pinta rojo
si la técnica está mal) queda limitada a **sentadilla y peso muerto**, que son los dos únicos con
algo citable sobre rango correcto. Press de banca y curl pueden entrar al conteo de repeticiones
(ver punto 8 — no necesita un umbral "correcto", solo detectar mínimos/máximos del ángulo), pero
sin la validación de forma hasta encontrar una fuente mejor.

### 4. Rendimiento en celular real — SIN benchmark oficial, resuelto con auto-medición en producción

**Búsqueda de un benchmark oficial de Google:** no existe una tabla de benchmarks pública de Google
para Pose Landmarker (el modelo Tasks actual) con números de latencia/fps por dispositivo — revisé
la página oficial de Pose Landmarker y no publica esa tabla para este modelo. Lo único indirecto que
encontré:
- El post de 2020 de MediaPipe Holistic (pipeline *distinto y más pesado*, ya desactualizado) midió
  ≈18 fps en un Pixel 2 XL y ≈20 fps en un Galaxy S9+ (ambos gama media de la época). Fuente:
  [MediaPipe Holistic blog 2020](https://ai.googleblog.com/2020/12/mediapipe-holistic-simultaneous-face.html?hl=es).
- Un plugin de Flutter de terceros (no Google) reporta, en un Galaxy S25 Ultra (gama alta 2026), GPU
  ≈3 ms/frame, NPU ≈13–16 ms, CPU ≈17 ms — con el Pose Landmarker actual, pero en un dispositivo de
  gama alta y en una capa nativa (no navegador), así que no representa el piso de gama baja/media que
  necesitamos.
- Reportes de la comunidad en GitHub indican que, en versiones recientes, la diferencia CPU vs. GPU a
  veces no es notable — el delegado GPU no garantiza mejora en todos los dispositivos.

**Supuesto conservador de arranque (marcado explícitamente como SIN VERIFICAR):** con el modelo
`lite` corriendo en navegador en un celular de gama media, estimo un rango de ≈12–20 fps como punto
de partida razonable — basado en extrapolar el dato de Holistic 2020 (pipeline más pesado, ≈18-20
fps en gama media de esa época) hacia abajo con cautela, dado que Pose Landmarker `lite` es más
liviano pero corre sobre hardware/navegadores variables hoy. **Este número es una estimación
indirecta, no una medición real, y se reemplaza automáticamente por el mecanismo de auto-medición
del punto 9 en cuanto el código esté corriendo en cualquier dispositivo real** — incluido el tuyo, la
primera vez que abras la función.

**Decisión de diseño (reemplaza el banco de pruebas manual):** en vez de bloquear el plan en un
número medido a mano en un dispositivo específico, la app se mide a sí misma en cada dispositivo
donde corre — ver punto 9, "Auto-medición y degradación", que pasa a ser requisito obligatorio de la
primera fase de código, no una verificación previa aparte.

### 5. Zoom y pantalla completa

- **Android/Chrome:** zoom óptico/hardware real es posible vía
  `track.getCapabilities()` → si expone `zoom`, `track.applyConstraints({ advanced: [{ zoom }] })`.
  Hay que comprobar la capacidad en runtime, nunca asumir que existe.
- **iOS Safari:** no soporta zoom nativo por `applyConstraints` (confirmado por múltiples reportes,
  sin soporte documentado de Apple). La alternativa ahí es **zoom digital**: aplicar
  `transform: scale()` por CSS sobre el elemento `<video>` (o recortar el canvas), con la pérdida de
  nitidez esperable de cualquier zoom digital. El plan debe mostrar esto como "zoom óptico en
  Android, zoom digital (con menor nitidez) en iPhone" en la UI, no como la misma funcionalidad.
  Fuente: [Dynamsoft — Camera Zoom Control on Web](https://www.dynamsoft.com/codepool/camera-zoom-control-on-web.html).
- Pantalla completa: `Element.requestFullscreen()` estándar sobre el contenedor del video+overlay,
  sin dependencias nuevas.

### 6. Privacidad

Requisito de diseño, no solo de implementación: el video y la inferencia de pose corren enteramente
en el dispositivo (WASM/GPU local vía MediaPipe). Nada de la cámara se sube a ningún servidor, igual
que el resto de fotos/cámara de la app. Esto se escribe en el plan como restricción de arquitectura
desde el día 1 (no hay endpoint de subida de video en ningún diseño que se proponga).

### 7. Arquitectura del overlay

- Un `<canvas>` posicionado en `absolute` exactamente sobre el `<video>` (mismo tamaño, mismo
  `object-fit`), redibujado en el mismo loop de `requestAnimationFrame` que llama a
  `poseLandmarker.detectForVideo(video, timestamp)` — nunca un loop separado, para que el esqueleto
  no se desincronice del frame real.
- Por cada frame: se calculan los ángulos relevantes del ejercicio activo a partir de los landmarks
  devueltos, se determina la fase del movimiento (bajando/abajo/subiendo, ver punto 8), y se dibuja
  cada segmento del esqueleto (hombro-codo, codo-muñeca, cadera-rodilla, rodilla-tobillo, etc.) con
  `canvas.strokeStyle` verde si ese segmento específico está dentro del rango esperado para la fase
  actual, rojo solo en el segmento que se sale de rango — nunca todo el esqueleto en rojo.
- Solo sentadilla y peso muerto (punto 3) tendrían el coloreado de "fuera de rango" real en la
  primera tanda; press de banca y curl mostrarían el esqueleto en un color neutro (sin evaluación de
  forma) hasta tener fuente confiable.
- Librería: sin dependencia nueva — Canvas 2D nativo alcanza para líneas y color por segmento, no
  hace falta SVG ni una librería de gráficos.

### 8. Conteo de repeticiones — decisión de producto pendiente de tu confirmación

Máquina de estados por el ángulo principal del ejercicio: `arriba → bajando → abajo → subiendo →
arriba` (1 repetición completa cada vez que se vuelve a "arriba"), con histéresis (dos umbrales
ligeramente separados al entrar y salir de cada estado) para no contar dobles por ruido del tracking.
Esto **no necesita el umbral de "forma correcta" del punto 3** — solo detecta mínimos/máximos
relativos del ángulo, así que puede aplicarse a los 4 ejercicios de la tanda (sentadilla, peso
muerto, press de banca, curl) incluso a los que quedaron sin validación de forma.

Lo que sí necesito que decidas antes de implementar (texto tuyo, de la tarea original: *"es una
decisión de producto que quiero ver reflejada en el plan"*) — tres opciones, con mi recomendación:

1. **Reemplaza el conteo manual.** Más cómodo si funciona bien, pero si la cámara pierde el tracking
   (mala luz, cuerpo parcialmente fuera de cuadro) el dato queda mal sin que el usuario lo note en el
   momento.
2. **Sugiere un número, el usuario confirma/edita antes de guardar.** (Recomendado.) Consistente con
   cómo se hizo el campo "mala técnica" la sesión pasada — manual-first, la cámara alimenta un dato
   que el usuario revisa, no que se guarda solo. Reduce el riesgo de que un conteo erróneo quede
   guardado sin que nadie lo vea.
3. **Corre en paralelo solo como información en pantalla, nunca se guarda automáticamente.** Más
   conservador todavía, pero el usuario sigue tecleando el número igual que hoy — menos valor
   agregado inmediato.

**Decisión confirmada: Opción 2.** La cámara sugiere la repetición detectada; el usuario confirma
antes de que se guarde. Nunca reemplaza el conteo manual sin esa confirmación — mismo criterio
manual-first que el resto de la app.

### 9. Auto-medición de fps y degradación automática — requisito obligatorio, primera fase de código

No es opcional ni se deja para el final: es lo primero que se construye al tocar código de cámara,
porque es la red de seguridad que reemplaza al benchmark manual de un solo dispositivo.

**Qué mide:** al iniciar la función de cámara, antes de mostrar el overlay "en serio", corre
`detectForVideo` en los primeros 2–3 segundos de video real del dispositivo y calcula el fps
efectivo (frames procesados / tiempo transcurrido), igual que hace `tools/perf/pose-fps-test.html`
(la página de prueba manual que ya quedó en el repo — se reusa su misma lógica de medición, no se
inventa una nueva).

**Umbral propuesto (criterio técnico propio, documentado como tal — no es un número de la
literatura):** **15 fps** como piso mínimo para que el overlay se sienta "en vivo" y no como una
sucesión de fotos. Razonamiento: por debajo de ~15 fps el ojo humano empieza a percibir el
movimiento como entrecortado (referencia general de percepción de movimiento en video, no específica
de esta app), y además con menos de 15 muestras por segundo la máquina de estados de conteo de reps
(punto 8) empieza a tener más margen de error para detectar el instante exacto en que el ángulo
cruza un umbral — reps rápidas podrían perderse un frame clave. 15 fps es un número conservador
elegido para errar del lado de "avisar y degradar" antes que "mostrar algo poco confiable".

**Orden de degradación (automático, sin intervención del usuario salvo el aviso final):**
1. Si el fps medido en los primeros 2-3s está por debajo del umbral, el primer paso es bajar la
   resolución del video de entrada (ej. de 640×480 a 320×240 vía `applyConstraints`) y volver a medir
   2-3s más.
2. Si con la resolución más baja todavía no se alcanza el umbral, la app no se queda mostrando un
   overlay trabado: muestra un mensaje claro ("tu teléfono no puede sostener el análisis en vivo, usá
   el registro manual por ahora") y cae automáticamente al flujo de registro manual de series que ya
   existe hoy.
3. Nunca hay un estado intermedio de "overlay congelado sin avisar" — eso es justo lo que este
   mecanismo existe para evitar.

**Persistencia:** el resultado de la calibración (fps alcanzado, resolución final usada, si pasó o
cayó a manual) se guarda localmente en el dispositivo (mismo patrón de `localStorage`/Zustand persist
que ya usa el resto de la app), para no repetir la medición cada vez que se abre la cámara — solo se
vuelve a medir si cambia de dispositivo/navegador (se puede detectar por un cambio de
`navigator.userAgent` + resolución de pantalla guardados junto al resultado) o si el usuario fuerza
"volver a calibrar" desde un ajuste.

**Privacidad:** la medición es 100% local — ningún número de fps, video ni metadata del dispositivo
sale de él. Mismo requisito que el punto 6.

**Por qué esto resuelve el bloqueo de performance sin un benchmark previo:** cubre automáticamente
cualquier teléfono real que use cualquier usuario, no solo el dispositivo que se pudo probar a mano
antes de programar — y si un dispositivo no puede sostenerlo, la app lo sabe y se degrada sola en
vez de prometer algo que no puede cumplir.

## Bloqueantes previos — estado

1. ~~Confirmar licencia de `@mediapipe/tasks-vision` y del modelo `.task`.~~ **Resuelto** — ambos
   Apache 2.0, confirmado con el `package.json` real del paquete en el registry de npm y con la
   respuesta oficial de un mantenedor de Google en
   [google-ai-edge/mediapipe#6306](https://github.com/google-ai-edge/mediapipe/issues/6306)
   (10 de junio de 2026). Permite uso comercial y redistribución conservando el aviso de licencia.
2. ~~Benchmark real de fps en un dispositivo específico antes de programar.~~ **Resuelto de otra
   forma** — en vez de bloquear el plan en una medición manual previa, la sección 2.1.9
   (auto-medición y degradación) hace que cada dispositivo real se mida solo la primera vez que abre
   la función, con un supuesto conservador de arranque documentado como sin verificar mientras tanto.
3. Decisión de producto del punto 2.1.8 (conteo automático vs. manual). **Resuelto** — Opción 2
   confirmada (sugiere, el usuario confirma).

Con los tres bloqueantes cerrados, el plan de fases de implementación queda en la sección siguiente.

## Plan de fases de implementación (PROPUESTO — esperando aprobación, sin código escrito todavía)

Ningún ítem de esta lista se implementa hasta que apruebes explícitamente esta sección. Un commit
por fase, con las mismas salvaguardas de siempre (tsc/lint/build limpios, pruebas pasando, escaneo
de secretos antes de cada push). Sin dependencias nuevas de runtime salvo `@mediapipe/tasks-vision`
(Apache 2.0, confirmado arriba) — es la única dependencia nueva de todo este plan.

**Fase A — Auto-medición y degradación (sección 2.1.9), SIN overlay ni ejercicios todavía.**
Módulo puro (`src/lib/camara/device-calibration.ts` o similar) que corre `detectForVideo` 2-3s,
calcula fps, aplica el orden de degradación (bajar resolución → fallback a manual), persiste el
resultado (Zustand persist, mismo patrón que el resto de la app). Se prueba con tests unitarios
sobre la lógica de umbral/degradación (sin cámara real, con fps simulados) + una verificación manual
en al menos un dispositivo real tuyo para confirmar que el flujo de "cae a manual" se ve bien. Esta
fase por sí sola ya responde "¿mi teléfono puede sostener esto?" sin tocar ninguna pantalla de
ejercicio todavía.

**Fase B — Landmarks + ángulos, sin overlay visual todavía.**
Integrar `PoseLandmarker` (modelo `lite`), un módulo puro de cálculo de ángulos a partir de
landmarks (rodilla, cadera, codo), y la máquina de estados de fases de movimiento
(`bajando/abajo/subiendo/arriba`) para sentadilla y peso muerto primero (los 2 con umbral citable).
Sin canvas, sin color, solo lógica + tests unitarios con secuencias de ángulos simuladas. Esto separa
"¿los ángulos se calculan bien?" de "¿se ve bien en pantalla?", para poder debuggear cada cosa por
separado.

**Fase C — Overlay visual (canvas verde/rojo) + pantalla completa + zoom.**
Canvas sincronizado al mismo loop de `detectForVideo` (sección 2.1.7), con el coloreado por segmento
para sentadilla y peso muerto. Zoom óptico en Android, zoom digital por CSS en iOS (sección 2.1.5).
Pantalla completa vía `requestFullscreen`. Esta es la primera fase con algo visible para probar en
el teléfono de verdad — foco de la verificación manual mobile-first (375×812, 390×844, 430×932).

**Fase D — Conteo de reps sugerido + confirmación manual (Opción 2, sección 2.1.8).**
Conecta la máquina de estados de la Fase B con una UI de "detecté N repeticiones, ¿confirmás?" que
alimenta el mismo campo de reps del registro manual ya existente — nunca lo reemplaza sin
confirmación. Incluye press de banca y curl acá (solo conteo, sin coloreado de forma, como quedó
documentado en la sección 2.1.3).

**Fase E — Conexión con "mala técnica" y cierre.**
Cuando el overlay detecta un segmento fuera de rango de forma sostenida (no un frame suelto de
ruido), ofrece marcar la nota "mala técnica" de esa serie automáticamente — el usuario la confirma o
la descarta, igual que el resto. Build/test/secret-scan/push final, igual que en tareas anteriores.

**Qué NO entra en este plan (fuera de alcance, para que quede explícito):** press de banca y curl con
coloreado de forma (sin fuente confiable aún, sección 2.1.3); estimación de % de grasa por foto
(sección 1, problema más abierto, queda de último en cualquier caso); cualquier ejercicio fuera de
los 4 de la primera tanda.

## Estado de implementación (Fases A–E)

Las 5 fases del plan de arriba quedaron implementadas, cada una en su propio commit:

- **Fase A** (auto-medición y degradación, sección 2.1.9): `src/lib/camara/device-calibration.ts`
  (pura) + `run-calibration.ts` (glue de navegador) + `cameraCalibrationStore.ts` (persistencia por
  dispositivo). Reemplaza el benchmark manual de un solo dispositivo: cada teléfono real se mide
  solo (2.5s por escalón de resolución) la primera vez que abre la cámara.
- **Fase B** (ángulos + conteo de reps, secciones 2.1.3/2.1.8): `pose-landmarks.ts` (ángulo de
  rodilla/cadera/codo, 2D a propósito, elige el lado más visible), `rep-counter.ts` (máquina de
  estados con histéresis), `exercise-configs.ts` (umbrales citados para los 4 ejercicios de la
  primera tanda).
- **Fase C** (overlay visual, sección 2.1.7): pantalla `/gym/entrenamiento/camara` — esqueleto en
  canvas sincronizado al mismo loop de `detectForVideo`, zoom óptico/digital, pantalla completa.
  Acá se corrigió lo decidido en la Fase B: peso muerto pasó a `hasFormValidation: false` porque la
  única fuente citada (Schellenberg 2013) describe un rango típico, no un criterio de corrección —
  usarlo como rojo/verde habría prometido más precisión de la que la fuente da. Solo sentadilla
  tiene el coloreado real de profundidad.
- **Fase D** (conexión con el registro manual, sección 2.1.8, Opción 2 confirmada): botón "Cámara
  (beta)" en la serie activa del ejercicio (solo las 4 variantes canónicas mapeadas en
  `exercise-id-map.ts`, fuera de superserie/bloque), pantalla de cámara con "Confirmar N reps", y
  recién ahí `/gym/entrenamiento/activo` aplica el número al campo de reps de esa serie puntual.
  Nunca se guarda sin ese paso de confirmación explícito.
- **Fase E** (conexión con "mala técnica", cierre): `technique-tracker.ts` cuenta repeticiones
  SEGUIDAS que no llegaron a la profundidad citada (nunca por un intento aislado) y sugiere, solo
  para sentadilla, marcar la misma nota "mala técnica" que ya existía en el registro manual — el
  usuario la confirma o la descarta antes de que se guarde, igual que el resto.

**Limitaciones conocidas, dichas con la misma honestidad que el resto de este documento:**
- No se pudo verificar visualmente de punta a punta en un navegador automatizado porque la app
  pide login contra el Supabase real del proyecto, y la cámara en sí solo tiene sentido probarla en
  un teléfono real — la verificación de código (tsc/lint/build/tests, 72/72 checks acumulados en
  `tools/camara/`) es sólida, pero la prueba real en un cuerpo humano moviéndose queda pendiente de
  que el usuario la haga en su teléfono.
- El flujo de la Fase D no cubre superseries/bloques (varios ejercicios por ronda) — se dejó afuera
  a propósito en vez de arriesgar aplicar las reps a la serie equivocada.
- Press de banca y curl de bíceps solo cuentan repeticiones, sin coloreado de forma ni sugerencia de
  "mala técnica" — sigue sin haber una fuente citable en grados para esos dos (sección 2.1.3).
- La estimación de rendimiento de arranque (sección 2.1.4, ~12–20 fps) sigue marcada como
  "sin verificar" hasta que la auto-medición real (Fase A) corra en dispositivos de usuarios reales.
