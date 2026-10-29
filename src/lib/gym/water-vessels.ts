/**
 * Vasos del usuario: los botones rápidos de la pantalla de Agua ya no son 150/250/500 fijos, sino los
 * recipientes que la persona usa de verdad (vaso de vidrio, termo, shaker...). Se guardan en el
 * store local (persistido) — con nombre, ml y una miniatura opcional.
 */
export interface WaterVessel {
  id: string;
  nombre: string;
  ml: number;
  /** Miniatura JPEG en data URL (≈120 px) — opcional. */
  foto?: string;
}

export const MAX_VESSEL_ML = 5000;
/** Tope de vasos guardados — la pantalla de Agua muestra uno de estos + la cámara = 6 botones como mucho. */
export const MAX_VESSELS = 5;

export const DEFAULT_VESSELS: WaterVessel[] = [
  { id: "v-150", nombre: "Vaso chico", ml: 150 },
  { id: "v-250", nombre: "Vaso", ml: 250 },
  { id: "v-500", nombre: "Botella", ml: 500 },
];

export function clampVesselMl(ml: number): number {
  return Math.min(MAX_VESSEL_ML, Math.max(1, Math.round(ml)));
}

/** Reduce una foto (data URL o File) a JPEG con el lado mayor `maxSide` — para mandar a la IA o guardar de miniatura. */
export function resizeImage(source: Blob, maxSide: number, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}
