import type { AthleteConfidence, AthleteExercise, AthletePlan } from "@/lib/types";

/**
 * Rutinas de atletas (solo lectura). Regla de esta carga: NO se inventa precisión.
 * - `confianza` por ejercicio y `confianzaGeneral` por plan dicen qué tan respaldado está cada dato.
 * - Si la fuente pública no da el descanso, `descansoSeg` queda `undefined` (y se dice en las notas).
 * - Ningún texto de libros con copyright se copia: son estructura y cifras (ejercicios, series, reps) parafraseadas.
 */

const ex = (
  exerciseId: string,
  series: number,
  repsMin: number,
  repsMax: number,
  confianza: AthleteConfidence,
  extra: Partial<AthleteExercise> = {},
): AthleteExercise => ({ exerciseId, series, repsMin, repsMax, confianza, ...extra });

// ---------------------------------------------------------------- Arnold
const S = "secundaria" as const;
const ARNOLD_REST = 60;
const arnoldPyramid = { repsPorSerie: [10, 6, 4], nota: "Pirámide: 10, 6 y 4 reps (subiendo el peso)." };

const arnold: AthletePlan = {
  id: "arnold-volumen-alto",
  atleta: "Arnold Schwarzenegger",
  nombre: "Volumen alto, 6 días",
  resumen: "6 días/semana · cada músculo 2 veces por semana · 5 series por ejercicio",
  enfoque: "Culturismo de volumen y frecuencia altos",
  diasPorSemana: 6,
  minsPorSesion: 90,
  confianzaGeneral: S,
  semana: [0, 1, 2, 0, 1, 2, null],
  dias: [
    {
      nombre: "Pecho y espalda",
      grupoMuscular: "Pecho",
      ejercicios: [
        ex("press-banca-barra", 5, 8, 12, S, { descansoSeg: ARNOLD_REST }),
        ex("press-inclinado-barra", 5, 8, 12, S, { descansoSeg: ARNOLD_REST }),
        ex("pullover-mancuerna", 5, 8, 12, S, { descansoSeg: ARNOLD_REST }),
        ex("dominadas", 4, 8, 12, S, {
          descansoSeg: ARNOLD_REST,
          nota: "La fuente dice «tantas como puedas»: sin rango fijo; se asume que se acerca al fallo.",
        }),
        ex("remo-barra", 5, 8, 12, S, { descansoSeg: ARNOLD_REST }),
        ex("peso-muerto", 3, 4, 10, S, { descansoSeg: ARNOLD_REST, ...arnoldPyramid }),
        ex("elevacion-piernas", 5, 25, 25, S, { descansoSeg: ARNOLD_REST, nota: "Abdomen: se entrena en todas las sesiones." }),
      ],
    },
    {
      nombre: "Hombros y brazos",
      grupoMuscular: "Hombros",
      ejercicios: [
        ex("press-militar-barra", 5, 8, 12, S, { descansoSeg: ARNOLD_REST }),
        ex("elevaciones-laterales", 5, 8, 12, S, { descansoSeg: ARNOLD_REST }),
        ex("press-empuje", 5, 8, 12, S, { descansoSeg: ARNOLD_REST }),
        ex("curl-biceps-barra", 5, 8, 12, S, { descansoSeg: ARNOLD_REST }),
        ex("curl-biceps-mancuernas", 5, 8, 12, S, { descansoSeg: ARNOLD_REST }),
        ex("press-cerrado", 5, 8, 12, S, { descansoSeg: ARNOLD_REST }),
        ex("press-frances", 5, 8, 12, S, { descansoSeg: ARNOLD_REST, nota: "Extensión de tríceps tumbado con barra." }),
        ex("curl-muneca-barra-sentado", 5, 8, 12, S, { descansoSeg: ARNOLD_REST, nota: "Antebrazo: flexores." }),
        ex("extension-muneca-barra", 5, 8, 12, S, { descansoSeg: ARNOLD_REST, nota: "Antebrazo: extensores." }),
        ex("crunch-abdominal", 5, 25, 25, S, { descansoSeg: ARNOLD_REST }),
      ],
    },
    {
      nombre: "Piernas",
      grupoMuscular: "Cuadriceps",
      ejercicios: [
        ex("sentadilla-barra", 5, 8, 12, S, { descansoSeg: ARNOLD_REST }),
        ex("zancadas-caminando-barra", 5, 8, 12, S, { descansoSeg: ARNOLD_REST, nota: "Zancada con barra." }),
        ex("curl-femoral", 5, 8, 12, S, { descansoSeg: ARNOLD_REST }),
        ex("elevacion-talones", 5, 8, 12, S, { descansoSeg: ARNOLD_REST, nota: "Gemelos de pie." }),
        ex("peso-muerto-piernas-rigidas", 3, 4, 10, S, { descansoSeg: ARNOLD_REST, ...arnoldPyramid }),
        ex("buenos-dias", 3, 4, 10, S, { descansoSeg: ARNOLD_REST, ...arnoldPyramid }),
        ex("elevacion-piernas", 5, 25, 25, S, { descansoSeg: ARNOLD_REST }),
      ],
    },
  ],
  fuentes: [
    {
      titulo: "StrengthLog — Arnold Split (programa tal como se presenta en The New Encyclopedia of Modern Bodybuilding, Schwarzenegger y Dobbins)",
      url: "https://www.strengthlog.com/?p=34650",
      tipo: "secundaria",
    },
  ],
  notas: [
    "Ciclo de 3 sesiones (pecho y espalda · hombros y brazos · piernas) repetido dos veces por semana; el domingo es descanso. Abdomen en todas las sesiones.",
    "Fuente secundaria: el programa es el que aparece en la Enciclopedia de Arnold, pero lo leímos en un resumen de terceros, no en el libro. Las series y reps son las de ese resumen; no se copió texto del libro.",
    "Descanso: el resumen indica «un minuto o menos» entre series; se cargó 60 s. No es un dato exacto de Arnold por ejercicio.",
    "Duración de sesión (90 min) es una estimación nuestra, no un dato de la fuente.",
    "No hay series al fallo, dropsets, tempo ni superseries documentados en esta fuente, por eso no se marcaron. (Arnold es conocido por usar superseries, pero este resumen no las detalla y no las agregamos.)",
  ],
};

// ---------------------------------------------------------------- Mentzer
const M = "secundaria" as const;
const E = "estimado" as const;
const mentzerSet = { seriesAlFallo: 1 };

const mentzer: AthletePlan = {
  id: "mentzer-heavy-duty",
  atleta: "Mike Mentzer",
  nombre: "Heavy Duty (intermedio)",
  resumen: "2 sesiones por semana · 1 serie al fallo por ejercicio · 6–9 reps",
  enfoque: "Máxima intensidad, mínimo volumen",
  diasPorSemana: 2,
  minsPorSesion: 30,
  confianzaGeneral: M,
  semana: [0, null, null, null, 1, null, null],
  dias: [
    {
      nombre: "Sesión A: pecho, espalda, hombros y piernas",
      grupoMuscular: "Pecho",
      ejercicios: [
        ex("press-banca-barra", 1, 6, 9, M, { ...mentzerSet, nota: "Antes: pocas series de calentamiento ligeras, lejos del fallo." }),
        ex("dominadas", 1, 6, 9, M, mentzerSet),
        ex("remo-barra", 1, 6, 9, E, { ...mentzerSet, nota: "Remo citado como ejemplo en la fuente; ubicación en esta sesión es nuestra elección." }),
        ex("press-militar-barra", 1, 6, 9, M, mentzerSet),
        ex("sentadilla-barra", 1, 6, 9, M, mentzerSet),
      ],
    },
    {
      nombre: "Sesión B: cuádriceps, femorales, bíceps, tríceps y gemelos",
      grupoMuscular: "Cuadriceps",
      ejercicios: [
        ex("prensa-piernas", 1, 6, 9, M, mentzerSet),
        ex("curl-femoral", 1, 6, 9, E, { ...mentzerSet, nota: "Ejercicio elegido por nosotros: la fuente solo dice «femorales»." }),
        ex("curl-biceps-barra", 1, 6, 9, M, mentzerSet),
        ex("fondos-paralelas", 1, 6, 9, E, { ...mentzerSet, nota: "Ejercicio elegido por nosotros: la fuente solo dice «tríceps»." }),
        ex("elevacion-talones", 1, 6, 9, M, mentzerSet),
      ],
    },
  ],
  fuentes: [
    {
      titulo: "FitnessVolt — The Mike Mentzer Heavy Duty Workout Explained (resumen; sin citas directas de Mentzer)",
      url: "https://fitnessvolt.com/mike-mentzer-heavy-duty-workout/",
      tipo: "secundaria",
    },
  ],
  notas: [
    "Filosofía (parafraseada del resumen): una sola serie de trabajo por ejercicio llevada al fallo muscular en 6–9 reps, con poco volumen total y mucho descanso entre sesiones.",
    "Esta es la versión «intermedia» del resumen: dos sesiones por semana. El resumen también describe una versión de principiante (2 sesiones más cortas) y una avanzada (3 sesiones con menos músculos cada una).",
    "El resumen dice que Mentzer descansaba entre 4 y 7 días tras cada sesión según la fatiga, y a la vez recomienda al menos 48 h entre sesiones del mismo músculo; no se reconcilian. Repartimos A el lunes y B el viernes como adaptación: es una ESTIMACIÓN para que quepa en una semana, ajustala según tu recuperación.",
    "Los ejercicios exactos de cada día no vienen en la fuente (solo ejemplos: banca, dominadas, press de hombros, sentadilla, remo, prensa, curls, elevaciones y gemelos). Los marcados «estimado» los eligió esta app.",
    "Descanso entre series y entre ejercicios: no especificado en la fuente, no se cargó. Mentzer tampoco figura aquí con pre-agotamiento ni dropsets; no los agregamos. (El resumen sí menciona rest-pause y repeticiones forzadas como técnicas avanzadas opcionales, sin integrarlas a la rutina.)",
    "Progresión: cuando llegas a 9 reps con buena técnica, subís el peso un poco. Ritmo lento y controlado.",
    "Su obra completa (Heavy Duty, Heavy Duty II) tiene copyright: acá solo hay la estructura general, no el texto.",
  ],
};

// ---------------------------------------------------------------- Nippard
const N = "secundaria" as const;
const rpe = (n: 7 | 8) => ({ nota: `Intensidad @${n}.` });

const nippard: AthletePlan = {
  id: "nippard-fundamentals",
  atleta: "Jeff Nippard",
  nombre: "Fundamentals Hypertrophy (Parte 1, semana 1)",
  resumen: "Cuerpo completo · 3 días/semana · 3 series por ejercicio",
  enfoque: "Hipertrofia basada en ciencia, para principiantes e intermedios",
  diasPorSemana: 3,
  minsPorSesion: 60,
  confianzaGeneral: N,
  semana: [0, null, 1, null, 2, null, null],
  dias: [
    {
      nombre: "Cuerpo completo 1",
      grupoMuscular: "Cuadriceps",
      ejercicios: [
        ex("sentadilla-barra", 3, 6, 6, N, rpe(7)),
        ex("press-banca-barra", 3, 8, 8, N, rpe(7)),
        ex("jalon-polea", 3, 10, 10, N, rpe(8)),
        ex("peso-muerto-rumano", 3, 10, 10, N, rpe(7)),
        ex("fondos-asistidos-maquina", 3, 8, 8, N, rpe(7)),
        ex("elevacion-talones", 3, 10, 10, N, rpe(8)),
        ex("curl-biceps-mancuernas", 3, 10, 10, N, rpe(8)),
      ],
    },
    {
      nombre: "Cuerpo completo 2",
      grupoMuscular: "Espalda",
      ejercicios: [
        ex("peso-muerto", 3, 5, 5, N, rpe(7)),
        ex("press-militar-barra", 3, 8, 8, N, rpe(8)),
        ex("remo-en-t", 3, 12, 12, N, rpe(8)),
        ex("extension-cuadriceps", 3, 12, 12, N, rpe(8)),
        ex("cruces-polea", 3, 12, 12, N, rpe(8)),
        ex("crunch-con-peso", 3, 12, 12, N, rpe(7)),
        ex("press-frances-mancuernas", 3, 12, 12, N, rpe(8)),
      ],
    },
    {
      nombre: "Cuerpo completo 3",
      grupoMuscular: "Pecho",
      ejercicios: [
        ex("zancadas", 3, 10, 10, N, { nota: "Intensidad @8. Zancadas caminando con mancuernas." }),
        ex("press-inclinado-mancuernas", 3, 8, 8, N, rpe(7)),
        ex("jalon-agarre-supino", 3, 10, 10, N, rpe(8)),
        ex("hip-thrust", 3, 12, 12, N, rpe(8)),
        ex("face-pull", 3, 12, 12, N, rpe(8)),
        ex("elevaciones-laterales", 3, 10, 10, N, { nota: "Intensidad @8. Con mancuernas." }),
        ex("curl-femoral", 3, 10, 10, N, { nota: "Intensidad @8. Tumbado." }),
      ],
    },
  ],
  fuentes: [
    {
      titulo: "Boostcamp — «Part 1 | Fundamentals Hypertrophy Program | Jeff N» (versión gratuita de la Parte 1, subida por un usuario; acredita a Nippard)",
      url: "https://www.boostcamp.app/users/LL84oY-part-1-or-fundamentals-hypertrophy-program-or-jeff-n",
      tipo: "secundaria",
    },
    {
      titulo: "Jeff Nippard — «Should You Train & Diet For Your Bodytype?» (su video, leído vía transcripción)",
      url: "https://rosetta.to/u/jeffnippard/should-you-train-diet-for-your-bodytype-ectomorph-endomorph-mesomorph",
      tipo: "directa",
    },
  ],
  notas: [
    "Solo está cargada la SEMANA 1 de la Parte 1 (3 días de cuerpo completo, las 8 semanas completas están en la app Boostcamp). El programa pago de Nippard (Fundamentals completo, con sus otros splits) no se copió.",
    "El «@7» y «@8» son la columna de intensidad de la fuente. La página no define la sigla; lo más probable es que sea RPE (7 ≈ unas 3 reps en reserva), pero es una inferencia. No hay series al fallo marcadas.",
    "Descanso y tempo: no figuran en la fuente, no se cargaron. Los días de la semana (L-X-V) y la duración (60 min) son una estimación nuestra.",
    "Nippard, sobre los somatotipos (su video): llama a la clasificación ectomorfo/mesomorfo/endomorfo una idea de Sheldon (1940) desacreditada, y dice no haber visto evidencia convincente de que deba cambiar cómo entrenás o comés. Para todos, el motor del músculo es la sobrecarga progresiva.",
    "Sobre quien le cuesta ganar peso: en ese video no usa la palabra «hardgainer» ni da un plan específico. Atribuye las diferencias a la genética (la respuesta al mismo entrenamiento varió de -5 % a +55 % en un estudio de 585 personas), al apetito y a la actividad espontánea (NEAT), y recomienda autoexperimentar con volumen y repeticiones.",
  ],
};

// ---------------------------------------------------------------- CBum
const C = "secundaria" as const;

const cbum: AthletePlan = {
  id: "cbum-pecho",
  atleta: "Chris Bumstead",
  nombre: "Sesiones de pecho documentadas",
  resumen: "2 sesiones de pecho · series estimadas · sin split semanal publicado",
  enfoque: "Culturismo clásico: máquinas y poleas, tensión constante",
  diasPorSemana: 1,
  minsPorSesion: 60,
  confianzaGeneral: "estimado",
  semana: [0, null, null, null, null, null, null],
  dias: [
    {
      nombre: "Pecho y tríceps (gimnasio nuevo, 2023)",
      grupoMuscular: "Pecho",
      ejercicios: [
        ex("press-pecho-cable-sentado", 3, 12, 15, "estimado", { nota: "Calentamiento: «unas buenas series» (cantidad no indicada)." }),
        ex("press-inclinado-multipower", 4, 12, 15, "estimado", {
          nota: "«Series de alto volumen» (cantidad no indicada).",
          descendente: { bajadas: 1, descripcion: "Termina con una serie descendente." },
        }),
        ex("aperturas-inclinadas-maquina", 3, 12, 15, "estimado", { nota: "Inclinación de 30°; empuja desde los codos. Primero un par de series para encontrar el peso." }),
        ex("press-declinado-maquina", 3, 12, 15, "estimado", {
          nota: "Repeticiones lentas y controladas.",
          descendente: { bajadas: 1, descripcion: "Termina con una serie descendente." },
        }),
        ex("aperturas-inclinadas-polea", 3, 8, 10, C, { nota: "Al final de cada serie mantiene la posición estirada hasta el fallo." }),
        ex("extension-triceps-polea-horizontal", 3, 12, 15, "estimado", { nota: "Unilateral. «Unas series» (cantidad no indicada)." }),
        ex("fondos-maquina", 3, 12, 15, "estimado", { nota: "Último ejercicio de tríceps." }),
      ],
    },
    {
      nombre: "Pecho en The Mecca",
      grupoMuscular: "Pecho",
      ejercicios: [
        ex("contractora-pecho", 3, 15, 15, C),
        ex("press-inclinado-mancuernas", 5, 8, 12, C),
        ex("press-inclinado-maquina", 4, 10, 10, C),
        ex("press-banca-maquina", 3, 10, 10, C),
        ex("flexiones", 4, 25, 25, "estimado", { nota: "La fuente dice «100 flexiones en total»; el reparto en series es nuestro." }),
      ],
    },
  ],
  fuentes: [
    {
      titulo: "FitnessVolt (10-sep-2023) — Chris Bumstead Destroys A Chest Day, Unveils His New Private Gym (resumen de su video)",
      url: "https://fitnessvolt.com/chris-bumstead-chest-day-new-gym/",
      tipo: "secundaria",
    },
    {
      titulo: "Muscle & Strength — Chris Bumstead's Classic Bodybuilding Chest Workout At The Mecca (solo vi el extracto del buscador: la página bloqueó la lectura)",
      url: "https://www.muscleandstrength.com/videos/chris-bumstead-chest-workout-at-the-mecca",
      tipo: "secundaria",
    },
  ],
  notas: [
    "CBum NO tiene, en las fuentes que pude leer, una semana completa publicada. Esto no es un split: son dos sesiones de pecho documentadas en video, cargadas como rutinas separadas. El plan semanal solo usa la primera (lunes).",
    "Según los resúmenes, CBum dijo que antes entrenaba más pesado (unas 6–8 reps) y que ahora hace más volumen, de 12 a 15 reps en la mayoría de las series, por cuidar las articulaciones, y que busca tensión constante y tiempo bajo tensión.",
    "En la sesión de 2023 el resumen no da casi ninguna cantidad de series, y no hay descanso: las series y rangos marcados «estimado» son nuestra estimación, según su declaración de 12–15 reps.",
    "Fallo y descendentes: los dropsets (press inclinado en Smith y press declinado) y el mantener la posición estirada hasta el fallo en las aperturas sí están descritos en la fuente.",
    "Elegido sobre Ronnie Coleman porque CBum tiene sesiones documentadas con nombre y fecha; para Coleman no encontré ninguna fuente primaria ni resumen fiable (las páginas se contradecían entre sí).",
  ],
};

// ---------------------------------------------------------------- Laid
const U = "no-verificado" as const;
const T = (e: string, s: number, a: number, b: number, extra: Partial<AthleteExercise> = {}) => ex(e, s, a, b, U, extra);
const accesorios = (e: string, n: string) => T(e, 3, 10, 12, { nota: `${n} Esquema 3–4 series de 10–12 (se carga el mínimo, 3).`.trim() });

const laid: AthletePlan = {
  id: "laid-powerbuilding",
  atleta: "David Laid",
  nombre: "Powerbuilding DUP, 6 días (no verificado)",
  resumen: "Push / Pull / Piernas ×2 por semana · fuerza + hipertrofia · NO VERIFICADO",
  enfoque: "Powerbuilding con periodización ondulante diaria (DUP)",
  diasPorSemana: 6,
  minsPorSesion: 90,
  confianzaGeneral: U,
  semana: [0, 1, 2, 3, 4, 5, null],
  dias: [
    {
      nombre: "Push 1 (pesado)",
      grupoMuscular: "Pecho",
      ejercicios: [
        T("press-banca-barra", 5, 1, 4, { seriePesada: true, repsPorSerie: [1, 4, 4, 4, 4], nota: "Primero una serie de 1RM y luego 4×4." }),
        T("press-empuje", 3, 4, 4, { seriePesada: true }),
        accesorios("fondos-paralelas", "Lastrados."),
        accesorios("aperturas-mancuernas", "O contractora de pecho."),
        accesorios("elevaciones-laterales", "Con mancuernas."),
        accesorios("press-frances", "Skull crushers."),
        accesorios("extension-triceps-mancuerna", ""),
      ],
    },
    {
      nombre: "Pull 1 (peso muerto 3RM)",
      grupoMuscular: "Espalda",
      ejercicios: [
        T("peso-muerto", 5, 3, 6, { seriePesada: true, repsPorSerie: [3, 6, 6, 6, 6], nota: "Primero una serie de 3RM y luego 4×6." }),
        accesorios("peso-muerto-piernas-rigidas", ""),
        T("dominadas", 3, 8, 10),
        accesorios("remo-yates", ""),
        accesorios("encogimientos-trapecio", ""),
        accesorios("curl-biceps-barra", ""),
        accesorios("curl-martillo", "Sentado."),
      ],
    },
    {
      nombre: "Piernas 1 (sentadilla 5RM)",
      grupoMuscular: "Cuadriceps",
      ejercicios: [
        T("sentadilla-barra", 5, 5, 12, { seriePesada: true, repsPorSerie: [5, 12, 12, 12, 12], nota: "Primero una serie de 5RM y luego 4×12." }),
        accesorios("peso-muerto-rumano", ""),
        T("zancadas-caminando-barra", 3, 10, 10, { nota: "10 por pierna." }),
        accesorios("hiperextension-reversa", "O glute-ham raise."),
      ],
    },
    {
      nombre: "Push 2 (hombros)",
      grupoMuscular: "Hombros",
      ejercicios: [
        T("press-militar-barra", 5, 5, 12, { seriePesada: true, repsPorSerie: [5, 12, 12, 12, 12], nota: "Primero una serie de 5RM y luego 4×12." }),
        T("press-inclinado-barra", 3, 12, 12),
        accesorios("elevaciones-laterales", "Con mancuernas."),
        accesorios("fondos-paralelas", "Lastrados."),
        accesorios("extension-triceps-mancuerna", ""),
        accesorios("press-frances", "Skull crushers."),
      ],
    },
    {
      nombre: "Pull 2 (peso muerto 1RM)",
      grupoMuscular: "Espalda",
      ejercicios: [
        T("peso-muerto", 5, 1, 2, { seriePesada: true, repsPorSerie: [1, 2, 2, 2, 2], nota: "Primero una serie de 1RM y luego 4×2." }),
        accesorios("peso-muerto-piernas-rigidas", ""),
        T("dominadas", 3, 8, 10),
        accesorios("remo-yates", ""),
        accesorios("encogimientos-trapecio", ""),
        accesorios("curl-biceps-barra", ""),
        accesorios("curl-martillo", "Sentado."),
      ],
    },
    {
      nombre: "Piernas 2 (sentadilla 3RM)",
      grupoMuscular: "Cuadriceps",
      ejercicios: [
        T("sentadilla-barra", 5, 3, 8, { seriePesada: true, repsPorSerie: [3, 8, 8, 8, 8], nota: "Primero una serie de 3RM y luego 4×8." }),
        accesorios("peso-muerto-rumano", ""),
        T("zancadas-caminando-barra", 3, 10, 10, { nota: "10 por pierna." }),
        accesorios("hiperextension-reversa", "O glute-ham raise."),
      ],
    },
  ],
  fuentes: [
    {
      titulo: "Lift Vault — David Laid DUP Program (resumen del programa que Laid vende en davidlaid.com; no incluye el detalle por día)",
      url: "https://liftvault.com/programs/david-laid-dup-program-spreadsheet/",
      tipo: "secundaria",
    },
    {
      titulo: "Gymshark — David Laid's Powerbuilding Split (artículo de terceros: no cita a Laid como autor de las series y reps)",
      url: "https://www.gymshark.com/blog/article/david-laid-workout",
      tipo: "secundaria",
    },
  ],
  notas: [
    "CONFIRMADO POR FUENTE SECUNDARIA (Lift Vault, que resume el programa DUP que Laid vende en davidlaid.com): 6 días por semana, rotación push / pull / piernas hecha dos veces, peso muerto 2 veces por semana, series de trabajo compuestas pesadas (85 % o más del máximo en la mayor parte del bloque) y accesorios de 3–4 series de 10–12 repeticiones. Esas cuatro cosas son la estructura de esta rutina.",
    "PESO MUERTO DOS VECES: es real según esa fuente («2x weekly deadlift»), no un error de carga. Está en Pull 1 y Pull 2, que en la semana quedan separados por 3 días (martes y viernes). Lift Vault no dice en qué sesiones va; que sea en las dos sesiones de pull es la lectura del artículo de Gymshark.",
    "SIGUE SIN VERIFICAR: qué ejercicios y qué series/reps exactas hace cada día. Salen del artículo de Gymshark, que no cita a Laid como autor. Piernas tiene pocos ejercicios porque así figura en esa única fuente detallada; no se completó con ejercicios inventados.",
    "Series «pesadas» (intentos de 1, 3 o 5RM y push press): guía cualitativa, sin peso cargado. Quedan como series normales; el descanso sugerido es más largo.",
    "NO VERIFICADO (conserva esta etiqueta): no encontré ninguna fuente directa (entrevista, video propio o programa publicado por Laid) con su rutina. La estructura sale de un artículo que la llama «comúnmente asociada» a él, sin respaldo. Otras páginas lo describen como PPL o «bro split»: las fuentes se contradicen. Tomalo como una rutina inspirada en Laid, no como la suya.",
    "Lo único atribuido a Laid en ese artículo son referencias sueltas: el concepto de DUP (video de 2018) y su lista de ejercicios favoritos (dominadas, fondos, elevaciones laterales, jalones de tríceps). El artículo tampoco dice que haya empezado delgado ni cómo ajustó su entrenamiento, así que no hay nada documentado sobre esa transformación.",
    "El orden de la semana (Push 1 – Pull 1 – Piernas 1 – Push 2 – Pull 2 – Piernas 2) es nuestra estimación: el artículo lista las 6 sesiones sin asignar días. Las sesiones «xRM» son un intento al máximo; el resto, series de respaldo. Descanso y tempo: no figuran. Duración (90 min): estimación nuestra.",
    "Series «hasta el fallo»: ninguna marcada. Las series de RM se hacen a máximo esfuerzo pero no se señalaron como fallo.",
  ],
};

export const ATHLETE_PLANS: AthletePlan[] = [nippard, laid, mentzer, arnold, cbum];

export const ATHLETE_CONFIDENCE_LABEL: Record<AthleteConfidence, string> = {
  confirmado: "Confirmado",
  secundaria: "Fuente secundaria",
  estimado: "Estimado",
  "no-verificado": "No verificado",
};

export function getAthletePlan(id: string): AthletePlan | undefined {
  return ATHLETE_PLANS.find((p) => p.id === id);
}
