import type { SceneCollectionId } from "@/lib/3d/scene-registry";
import type { ProgressSourceId } from "@/lib/habits/progress-sources";

/**
 * Configuración de las categorías de hábito (las de `src/lib/data/habit-categories.ts`):
 *
 *   categoría → dominio/módulo → colección de figuras 3D → (opcional) fuente de progreso por defecto
 *
 * Para reasignar una categoría (p.ej. mandar "Movilidad" a Gym o "Sueño" a su propia colección) se edita SOLO esta
 * tabla; ni la UI ni el motor 3D ni el dispatcher tienen `if (category === ...)`.
 */
export interface CategoryProfile {
  /** Módulo funcional al que pertenece la categoría. */
  domain: "habitos" | "gym";
  /** Colección de figuras 3D con la que progresa un hábito de esta categoría. */
  sceneCollection: SceneCollectionId;
  /** Fuente que puede confirmar el hábito automáticamente (el usuario igual toca el check). */
  defaultSource?: ProgressSourceId;
}

const HABITOS: CategoryProfile = { domain: "habitos", sceneCollection: "habitos" };

/** Solo las categorías que NO son de Hábitos necesitan entrada; el resto cae en `HABITOS`. */
export const CATEGORY_PROFILES: Record<string, CategoryProfile> = {
  gym: { domain: "gym", sceneCollection: "gym", defaultSource: "gym.workout" },
  agua: { domain: "gym", sceneCollection: "gym", defaultSource: "gym.water" },
  comida: { domain: "gym", sceneCollection: "gym", defaultSource: "gym.calories" },
  // sueno, lectura, meditacion, trabajo, estudio, movilidad, higiene, finanzas → Hábitos (por ahora)
};

export function profileForCategory(categoryId: string | undefined | null): CategoryProfile {
  return (categoryId ? CATEGORY_PROFILES[categoryId] : undefined) ?? HABITOS;
}
