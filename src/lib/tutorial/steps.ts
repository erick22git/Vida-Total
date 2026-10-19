/**
 * Pasos del tutorial guiado (burbujas narradas por la mascota). Prioriza Calorías y Entrenamiento: ahí la explicación es
 * completa; el resto de módulos no lleva tutorial por ahora.
 *
 * Los módulos congelados (Gym, Calorías, Entrenamiento) NO se tocaron: cada paso encuentra su bloque por selectores sobre lo que
 * ya existe en pantalla (aria-label / placeholder / etiquetas). Si algún día cambia un aria-label, el paso no rompe nada: muestra
 * la burbuja centrada, sin resaltar el bloque.
 */
export interface TourStep {
  id: string;
  /** Ruta (con query) a la que hay que estar para ver este paso. */
  href: string;
  /** Devuelve el bloque a señalar, o null si no existe en este momento. */
  find: () => HTMLElement | null;
  title: string;
  text: string;
  /** Texto del botón de avance en este paso (por defecto «Siguiente»). */
  next?: string;
}

const q = (sel: string) => () => document.querySelector<HTMLElement>(sel);

export const TOUR_STEPS: TourStep[] = [
  {
    id: "cal-comida",
    href: "/gym/calorias",
    find: q("header h1"),
    title: "Tu comida actual",
    text: "Acá ves en qué comida estás registrando (desayuno, almuerzo…). Desliza a los lados para cambiar de comida.",
  },
  {
    id: "cal-puntos",
    href: "/gym/calorias",
    find: () => document.querySelector<HTMLElement>('[aria-label^="Ir a "]')?.parentElement ?? null,
    title: "Los puntitos",
    text: "Marcan en cuál de tus comidas estás. Toca uno para saltar directo a esa comida.",
  },
  {
    id: "cal-mas",
    href: "/gym/calorias",
    find: q('[aria-label^="Agregar a "], [aria-label*="mantén presionado para ver las kcal"]'),
    title: "Agregar un alimento",
    text: "El círculo con el + abre el buscador para AGREGAR un alimento a esta comida. Si lo mantienes presionado, puedes editar lo último que agregaste.",
  },
  {
    id: "cal-vistas",
    href: "/gym/calorias",
    find: q("main"),
    title: "Desliza hacia arriba",
    text: "Hacia arriba hay más vistas del día: primero el detalle de nutrientes (tus calorías y las 4 categorías de nutrientes, ahí viven los macros); después el calendario del año, donde cada día se pinta según tu racha: dorado si fue un día suelto, rojo en rachas de 2 a 6 días y verde desde 7. Más abajo está el Nutriólogo.",
  },
  {
    id: "cal-ajustes",
    href: "/gym/calorias",
    find: q('[aria-label="Ajustes de calorías"]'),
    title: "Tus metas",
    text: "Desde acá cambias tu meta de calorías y de macros, y cómo se muestra el gráfico del día.",
  },
  {
    id: "bus-buscar",
    href: "/gym/calorias/buscar-nuevo?meal=desayuno",
    find: q('input[placeholder^="Buscar alimento"]'),
    title: "Buscar un alimento",
    text: "Escribe el nombre de lo que comiste. Toca un resultado para ver su detalle y agregarlo a tu comida.",
  },
  {
    id: "ent-dia",
    href: "/gym/entrenamiento",
    find: q("header h1"),
    title: "Lo que toca hoy",
    text: "Arriba ves qué músculo entrenas hoy según tu plan semanal (o «Descanso» si hoy no toca).",
  },
  {
    id: "ent-iniciar",
    href: "/gym/entrenamiento",
    find: () => document.querySelector<HTMLElement>('[aria-label^="Iniciar o continuar"]') ?? document.querySelector<HTMLElement>("main"),
    title: "Registrar tu entrenamiento",
    text: "Tócalo para empezar. En cada serie anotas el peso y las repeticiones y la marcas con el ✓. Cada serie puede ser Normal, Calentamiento, Descendente o Al fallo: se cambia desde su botón de tipo. Entre series corre el temporizador de descanso.",
  },
  {
    id: "ent-ajustes",
    href: "/gym/entrenamiento",
    find: q('[aria-label="Configuración e historial"]'),
    title: "Planes, rango y perfil",
    text: "Acá están tus planes y rutinas, tu perfil de entrenamiento y el historial. Hacia abajo en esta pantalla hay más vistas: tu año, tu Rango y el Coach.",
    next: "Terminar",
  },
];
