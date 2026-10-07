/** Código de vinculación de un solo uso. SOLO SERVIDOR (usa node:crypto). En la base se guarda únicamente el hash. */
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { LINK_CODE_ALPHABET, LINK_CODE_LENGTH } from "./update";

export function generateLinkCode(): string {
  let out = "";
  for (let i = 0; i < LINK_CODE_LENGTH; i++) out += LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)];
  return out;
}

export const hashLinkCode = (code: string): string => createHash("sha256").update(code).digest("hex");

/** Comparación en tiempo constante (para el secret_token del webhook). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
