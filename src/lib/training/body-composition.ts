/**
 * IMC a partir de peso/altura ya cargados en `gymProfile` (nunca se piden de nuevo). Es un índice
 * aproximado, no un diagnóstico — así se muestra en la UI. Fórmula estándar: kg / m².
 */
export function imc(pesoKg: number, alturaCm: number): number | null {
  if (pesoKg <= 0 || alturaCm <= 0) return null;
  const alturaM = alturaCm / 100;
  return pesoKg / (alturaM * alturaM);
}

export type ImcCategoria = "bajo_peso" | "normal" | "sobrepeso" | "obesidad";

/** Categorías estándar de la OMS (18.5 / 25 / 30) — informativas, nunca diagnóstico. */
export function imcCategoria(valor: number): ImcCategoria {
  if (valor < 18.5) return "bajo_peso";
  if (valor < 25) return "normal";
  if (valor < 30) return "sobrepeso";
  return "obesidad";
}
