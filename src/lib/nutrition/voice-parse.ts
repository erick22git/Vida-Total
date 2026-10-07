/**
 * Divide un dictado ("hoy comí dos huevos, 200 gramos de arroz y una manzana") en segmentos, cada uno con el texto
 * del alimento y su cantidad (gramos, o un multiplicador de porción: "dos huevos"). NO decide qué alimento es: eso es
 * trabajo del resolvedor (`food-resolver.ts`). Muy simple a propósito (regex, no NLP).
 */
import { normalizeText, parseQuantityFromText } from "@/lib/nutrition/food-resolver";

export interface SpokenSegment {
  /** Texto del alimento ya sin muletillas ni cantidades. */
  texto: string;
  /** Gramos dichos explícitamente ("200 gramos", "1 kg"); null si no. */
  gramos: number | null;
  /** Cuántas porciones ("dos", "una", "medio", "3"); null si no se dijo. */
  cantidad: number | null;
}

const NUMBER_WORDS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, medio: 0.5, media: 0.5,
};

const FILLER = /\b(hoy|ayer|me|he|comi|comido|desayune|desayuno|almorce|almuerzo|cene|cena|tome|bebi|merende|para|de desayuno|de almuerzo|de cena|en el desayuno|en el almuerzo|en la cena|como|comiendo|tambien|ademas|solo|aproximadamente|mas o menos)\b/g;

export function splitSpokenFoods(transcript: string): SpokenSegment[] {
  const plain = transcript.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const parts = plain
    .split(/[,;.]| y | e | mas | luego | despues | tambien | ademas /)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: SpokenSegment[] = [];
  for (const raw of parts) {
    const q = parseQuantityFromText(raw);
    let texto = normalizeText(q.texto).replace(FILLER, " ").replace(/\s+/g, " ").trim();
    let cantidad: number | null = null;
    // Cantidad en porciones al inicio: "2 huevos", "dos huevos", "medio aguacate" (sin unidad de peso).
    if (q.gramos === null) {
      const m = /^(\d+(?:\.\d+)?|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|medio|media)\s+(.+)$/.exec(texto);
      if (m) {
        const n = /^\d/.test(m[1]) ? parseFloat(m[1]) : NUMBER_WORDS[m[1]];
        if (n > 0 && n <= 50) {
          cantidad = n;
          texto = m[2];
        }
      }
    }
    // "de" suelto al inicio ("200 gramos de arroz" → "de arroz"): se limpia.
    texto = texto.replace(/^(de|del|la|el|los|las|un|una)\s+/, "").trim();
    if (!texto) continue;
    out.push({ texto, gramos: q.gramos, cantidad });
  }
  return out;
}
