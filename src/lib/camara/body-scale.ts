/**
 * Mejora visual pedida junto con el arreglo del conteo: el esqueleto dibujado debe verse más
 * grueso/grande o más fino/chico según la altura y el peso que el usuario ya tiene configurados
 * en su perfil de entrenamiento (`GymProfile.alturaCm`/`pesoKg`) — no un grosor de línea fijo
 * para cualquier cuerpo.
 *
 * No usa las medidas de cuello/cintura/cadera (`medidaCuelloCm` etc.) — esas existen para estimar
 * % de grasa corporal (fórmula Navy), no para esto; usarlas acá sería forzar un dato pensado para
 * otra cosa. Altura + peso ya alcanzan como señal de tamaño general del cuerpo.
 */

/** "Adulto promedio" de referencia — punto de partida razonado para la escala, no un estándar
 * antropométrico citado. El factor final queda acotado (ver MIN/MAX_SCALE) para que nunca se vea
 * absurdamente fino ni grueso aunque el perfil tenga valores atípicos. */
const REFERENCE_HEIGHT_CM = 170;
const REFERENCE_WEIGHT_KG = 70;

export const MIN_LINE_SCALE = 0.75;
export const MAX_LINE_SCALE = 1.4;

/**
 * Factor multiplicador para el ancho de línea del esqueleto (1 = el grosor base, sin cambios).
 * El peso pesa un poco más que la altura en el resultado (una persona más pesada se percibe "más
 * ancha" visualmente aunque no sea mucho más alta) — criterio propio, no antropometría real.
 * Sin datos de perfil, devuelve 1 (comportamiento de antes, sin escalar).
 */
export function bodyLineWidthScale(alturaCm?: number, pesoKg?: number): number {
  if (!alturaCm && !pesoKg) return 1;
  const heightFactor = alturaCm && alturaCm > 0 ? alturaCm / REFERENCE_HEIGHT_CM : 1;
  const weightFactor = pesoKg && pesoKg > 0 ? pesoKg / REFERENCE_WEIGHT_KG : 1;
  const combined = heightFactor * 0.4 + weightFactor * 0.6;
  return Math.min(MAX_LINE_SCALE, Math.max(MIN_LINE_SCALE, combined));
}
