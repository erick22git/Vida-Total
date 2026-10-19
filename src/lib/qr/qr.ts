import QRCode from "qrcode";
import {
  BinaryBitmap,
  DecodeHintType,
  HTMLCanvasElementLuminanceSource,
  HybridBinarizer,
  NotFoundException,
  QRCodeReader,
} from "@zxing/library";

/**
 * REGLA: el QR que se escanea NUNCA es una textura de la escena 3D ni una foto: se decodifica la imagen del banco una sola vez,
 * se guarda el TEXTO (payload) y cada vez que se muestra se regenera como SVG plano, alto contraste, sin degradados ni
 * transparencias, como overlay HTML encima de la escena (nunca dentro de ella).
 */

/** Decodifica el texto de un QR a partir de un `<canvas>`. Devuelve null si no encuentra un QR legible. */
export function decodeQrFromCanvas(canvas: HTMLCanvasElement): string | null {
  const reader = new QRCodeReader();
  const hints = new Map<DecodeHintType, unknown>([[DecodeHintType.TRY_HARDER, true]]);
  const bitmap = new BinaryBitmap(new HybridBinarizer(new HTMLCanvasElementLuminanceSource(canvas)));
  try {
    return reader.decode(bitmap, hints).getText();
  } catch (e) {
    if (e instanceof NotFoundException) return null;
    // ChecksumException / FormatException: se vio algo parecido a un QR pero no se pudo leer entero.
    return null;
  }
}

function drawToCanvas(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No se pudo crear el lienzo para leer el QR.");
  // Fondo blanco: una captura con transparencia se leería como negro.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo abrir la imagen."));
    img.src = src;
  });
}

/**
 * Lee el QR de una imagen subida (captura o foto del QR del banco). Prueba varios tamaños porque el decodificador rinde
 * distinto según la resolución. Devuelve el texto exacto del QR o null si no se encontró ninguno.
 */
export async function decodeQrFromFile(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    for (const side of [1600, 1000, 700, 450]) {
      const text = decodeQrFromCanvas(drawToCanvas(img, side));
      if (text) return text;
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** SVG limpio y plano del payload: negro sobre blanco opaco, zona de silencio de 4 módulos, sin ningún efecto. */
export async function renderQrSvg(payload: string): Promise<string> {
  return QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: "M", // sin logo encima. Con logo: nivel "H" y que el logo cubra como máximo 20–25 % del área.
    margin: 4,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

/**
 * Prueba de ida y vuelta: rasteriza el SVG regenerado y lo vuelve a decodificar. Si devuelve el mismo texto, el QR que ve el
 * usuario es legible y equivale al original. Solo corre en el navegador.
 */
export async function verifyQrSvg(svg: string, payload: string): Promise<boolean> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 600;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 600, 600);
    ctx.drawImage(img, 0, 0, 600, 600);
    return decodeQrFromCanvas(canvas) === payload;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}
