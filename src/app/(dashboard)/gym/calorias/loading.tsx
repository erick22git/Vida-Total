import { CaloriasSkeleton } from "@/components/gym/calorias-skeleton";

/** Estado de carga instantáneo de todo Calorías: Next lo precarga, así el toque responde al momento
 * mientras llega la pantalla real (la navegación pasa por el servidor, ver docs/plan o el reporte de rendimiento). */
export default function Loading() {
  return <CaloriasSkeleton />;
}
