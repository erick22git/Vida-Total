# Roadmap: visión por cámara y fotos (NO implementado)

Este documento es un plan para una **fase futura separada**, no una tarea en curso. Nada de lo que
describe acá está implementado — el entrenador basado en datos (motor de hipertrofia, perfil
avanzado, Rango, pantalla Coach) es la base que debe estar sólida antes de retomar esto. Se retoma
recién cuando el usuario lo pida explícitamente.

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

## Orden sugerido si se retoma

1. Investigar y documentar los umbrales de ángulos por ejercicio (con fuente) antes de tocar código.
2. Prototipo de conteo de reps + puntuación de forma para 2-3 ejercicios comunes (sentadilla, press de
   hombro, remo) antes de generalizar a todo el catálogo.
3. Estimación de % de grasa por foto queda en segundo lugar: depende de encontrar o entrenar un modelo
   con margen de error documentado, que es un problema más abierto que el conteo de reps.
