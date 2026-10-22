/**
 * Pasos del tutorial guiado (burbujas narradas por la mascota). Cada módulo tiene SU recorrido y termina en ese módulo: el de
 * Calorías no salta a Entrenamiento ni a Gym.
 *
 * Los módulos congelados (Gym, Calorías, Entrenamiento) NO se tocaron: cada paso encuentra su bloque por selectores sobre lo que
 * ya existe en pantalla (aria-label / placeholder / etiquetas). Un paso debe señalar EXACTAMENTE el botón o bloque que explica:
 * si el selector no encuentra nada (o cambia un aria-label), muestra la burbuja centrada, sin resaltar nada.
 */
export type TourModule = "calorias" | "entrenamiento";

export interface TourStep {
  id: string;
  module: TourModule;
  /** Ruta (con query) a la que hay que estar para ver este paso. */
  href: string;
  /** Devuelve el bloque a señalar, o null si no existe en este momento. */
  find: () => HTMLElement | null;
  title: string;
  text: string;
  /** Texto del botón de avance en este paso (por defecto «Siguiente»). */
  next?: string;
}

/** Pantalla de entrada de cada módulo: donde queda la persona al terminar su recorrido. */
export const TOUR_HOME: Record<TourModule, string> = {
  calorias: "/gym/calorias",
  entrenamiento: "/gym/entrenamiento",
};

const q = (sel: string) => () => document.querySelector<HTMLElement>(sel);

export const TOUR_STEPS: TourStep[] = [
  {
    id: "cal-comida",
    module: "calorias",
    href: "/gym/calorias",
    find: q("header h1"),
    title: "Tu comida actual",
    text: "Acá ves en qué comida estás registrando (desayuno, almuerzo…). Desliza a los lados para cambiar de comida.",
  },
  {
    id: "cal-puntos",
    module: "calorias",
    href: "/gym/calorias",
    find: () => document.querySelector<HTMLElement>('[aria-label^="Ir a "]')?.parentElement ?? null,
    title: "Los puntitos",
    text: "Marcan en cuál de tus comidas estás. Toca uno para saltar directo a esa comida.",
  },
  {
    id: "cal-mas",
    module: "calorias",
    href: "/gym/calorias",
    find: q('[aria-label^="Agregar a "], [aria-label*="mantén presionado para ver las kcal"]'),
    title: "Agregar un alimento",
    text: "El círculo con el + abre el buscador para AGREGAR un alimento a esta comida. Si lo mantienes presionado, puedes editar lo último que agregaste.",
  },
  {
    id: "cal-vistas",
    module: "calorias",
    href: "/gym/calorias",
    find: () => null,
    title: "Desliza hacia arriba",
    text: "Hacia arriba hay más vistas del día: primero el detalle de nutrientes (tus calorías y las 4 categorías de nutrientes, ahí viven los macros); después el calendario del año, donde cada día se pinta según tu racha: dorado si fue un día suelto, rojo en rachas de 2 a 6 días y verde desde 7. Más abajo está el Nutriólogo.",
  },
  {
    id: "cal-ajustes",
    module: "calorias",
    href: "/gym/calorias",
    find: q('[aria-label="Ajustes de calorías"]'),
    title: "Tus metas",
    text: "Desde acá cambias tu meta de calorías y de macros, cómo se muestra el gráfico del día y, más abajo, a qué hora empieza cada comida (Tiempos de comida).",
    next: "Terminar",
  },
  {
    id: "ent-dia",
    module: "entrenamiento",
    href: "/gym/entrenamiento",
    find: q("header h1"),
    title: "Lo que toca hoy",
    text: "Arriba ves qué músculo entrenas hoy según tu plan semanal (o «Descanso» si hoy no toca).",
  },
  {
    id: "ent-iniciar",
    module: "entrenamiento",
    href: "/gym/entrenamiento",
    find: () => document.querySelector<HTMLElement>('[aria-label^="Iniciar o continuar"]'),
    title: "Registrar tu entrenamiento",
    text: "Tócalo para empezar. En cada serie anotas el peso y las repeticiones y la marcas con el ✓. Cada serie puede ser Normal, Calentamiento, Descendente o Al fallo: se cambia desde su botón de tipo. Entre series corre el temporizador de descanso.",
  },
  {
    id: "ent-ajustes",
    module: "entrenamiento",
    href: "/gym/entrenamiento",
    find: q('[aria-label="Configuración e historial"]'),
    title: "Planes, rango y perfil",
    text: "Acá están tus planes y rutinas, tu perfil de entrenamiento y el historial. Hacia abajo en esta pantalla hay más vistas: tu año, tu Rango y el Coach.",
    next: "Terminar",
  },
];

export function stepsForModule(module: TourModule): TourStep[] {
  return TOUR_STEPS.filter((s) => s.module === module);
}
