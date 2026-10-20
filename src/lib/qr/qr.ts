import QRCode from "qrcode";
import jsQR from "jsqr";
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

/**
 * Decodifica el texto de un QR a partir de un `<canvas>`. Devuelve null si no encuentra un QR legible.
 * Usa DOS decodificadores en cascada: jsQR primero y ZXING (puerto a JS) de respaldo. Se agregó jsQR porque en pruebas ZXING-JS
 * NO leía varios QR perfectamente válidos (p. ej. una matriz de 45×45 que ZXING-C++, ZBar y jsQR leen sin problema a cualquier
 * tamaño); con solo ese decodificador, un QR de banco denso podía fallar al subirlo.
 */
export function decodeQrFromCanvas(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx) {
    try {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
      if (hit?.data) return hit.data;
    } catch {
      /* canvas contaminado o sin datos: se prueba con el otro decodificador */
    }
  }
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

/** Opciones ÚNICAS con las que se codifica el QR (SVG, matriz 3D y PNG de descarga comparten esto: misma matriz en todos lados). */
const QR_OPTIONS = { errorCorrectionLevel: "M" as const }; // sin logo encima. Con logo: nivel "H" y que el logo cubra como máximo 20–25 % del área.
/** Zona de silencio (en módulos) alrededor del QR, exigida por la especificación. */
export const QR_QUIET_ZONE = 4;

export interface QrMatrix {
  /** Lado de la matriz en módulos (sin zona de silencio). Un payload largo da una matriz más grande. */
  size: number;
  isDark(x: number, y: number): boolean;
}

/**
 * Matriz de módulos del QR, generada SOLO desde el texto guardado (codificar, nunca decodificar): es la misma que dibuja el SVG
 * (`QRCode.toString` usa `QRCode.create` con estas mismas opciones y la máscara se elige de forma determinista). La escena 3D
 * arma su piso con esta matriz; el QR que se escanea sigue siendo el SVG plano.
 */
export function getQrMatrix(payload: string): QrMatrix {
  const qr = QRCode.create(payload, QR_OPTIONS);
  const { size, data } = qr.modules;
  return { size, isDark: (x, y) => x >= 0 && y >= 0 && x < size && y < size && data[y * size + x] === 1 };
}

/**
 * PNG del QR para descargar/compartir/imprimir: módulos negros sobre blanco opaco, zona de silencio de 4 módulos, píxeles
 * enteros por módulo (sin suavizado). Se dibuja DIRECTO desde la matriz (no se rasteriza el SVG ni se pasa por la escena 3D).
 * Antes de entregarlo se vuelve a leer con el decodificador y se comprueba que da el mismo texto; si no coincide devuelve null.
 */
export async function renderQrPng(payload: string, targetPx = 1024): Promise<Blob | null> {
  const m = getQrMatrix(payload);
  const cells = m.size + QR_QUIET_ZONE * 2;
  const scale = Math.max(2, Math.ceil(targetPx / cells));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = cells * scale;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.isDark(x, y)) ctx.fillRect((x + QR_QUIET_ZONE) * scale, (y + QR_QUIET_ZONE) * scale, scale, scale);
  // Se relee con el decodificador a varias resoluciones (rinde distinto según el tamaño, igual que al leer la imagen del banco).
  let reads = false;
  for (const side of [1000, 700, 450, canvas.width]) {
    const probe = document.createElement("canvas");
    probe.width = probe.height = Math.min(side, canvas.width);
    const pctx = probe.getContext("2d", { willReadFrequently: true });
    if (!pctx) continue;
    pctx.fillStyle = "#ffffff";
    pctx.fillRect(0, 0, probe.width, probe.height);
    pctx.drawImage(canvas, 0, 0, probe.width, probe.height);
    if (decodeQrFromCanvas(probe) === payload) {
      reads = true;
      break;
    }
  }
  if (!reads) return null;
  return await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

/** SVG limpio y plano del payload: negro sobre blanco opaco, zona de silencio de 4 módulos, sin ningún efecto. */
export async function renderQrSvg(payload: string): Promise<string> {
  return QRCode.toString(payload, {
    type: "svg",
    ...QR_OPTIONS,
    margin: QR_QUIET_ZONE,
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
