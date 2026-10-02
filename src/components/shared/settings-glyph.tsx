import { SlidersHorizontal } from "lucide-react";

/** Ícono de configuración de las pantallas tipo Hábitos (mismo glifo y medida en Hábitos, Calorías,
 * Agua, Kegel y Entrenamiento). Solo el ícono: cada pantalla decide qué abre. */
export function SettingsGlyph() {
  return <SlidersHorizontal size={26} strokeWidth={2.4} />;
}
