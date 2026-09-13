"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Fondo "vidrio empañado" — portado de C:\Erick\Gym\src\pages\Login.jsx
 * (componente LoginVidrio, solo lectura, JS/canvas puro sin dependencias
 * de framework). Dos fotos apiladas: abajo /login.png (limpia, fondo del
 * div), encima /sobre_login.png (con vaho, dibujada en el canvas). El
 * cursor "limpia" el canvas con un gradiente radial en modo
 * destination-out, revelando la foto limpia debajo; el vaho vuelve a
 * aparecer lento donde se limpió (reempañado por pasos de opacidad
 * acumulados por tiempo, no por frame, para evitar el punto muerto de
 * redondeo de canvas).
 */
export function LoginVidrio({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const acumuladorRef = useRef(0);
  const lastTsRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = "/sobre_login.png";

    // Mismo cálculo matemático que CSS background-size: cover.
    const drawCover = (targetCtx: CanvasRenderingContext2D, image: HTMLImageElement, w: number, h: number) => {
      const imgRatio = image.naturalWidth / image.naturalHeight;
      const boxRatio = w / h;
      let drawW: number, drawH: number, drawX: number, drawY: number;
      if (imgRatio > boxRatio) {
        drawH = h;
        drawW = drawH * imgRatio;
        drawX = (w - drawW) / 2;
        drawY = 0;
      } else {
        drawW = w;
        drawH = drawW / imgRatio;
        drawX = 0;
        drawY = (h - drawH) / 2;
      }
      targetCtx.drawImage(image, drawX, drawY, drawW, drawH);
    };

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      if (img.complete) {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        drawCover(ctx, img, canvas.width, canvas.height);
      }
    };

    img.onload = resize;
    // Si la imagen ya está en caché del navegador, img.complete puede
    // quedar en true ANTES de asignar img.onload — el evento 'load' ya
    // se disparó y nunca llega a este handler. Sin esto, resize() nunca
    // corre y el canvas se queda en su tamaño por defecto.
    if (img.complete) resize();
    window.addEventListener("resize", resize);

    // ---- REEMPAÑADO: pasos discretos por tiempo acumulado ----
    const PASO_ALPHA = 0.025;
    const INTERVALO_MS = 150; // llega a ~opacidad total en ~15s

    const loop = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const delta = ts - lastTsRef.current;
      lastTsRef.current = ts;
      acumuladorRef.current += delta;

      if (acumuladorRef.current >= INTERVALO_MS && img.complete) {
        acumuladorRef.current = 0;
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = PASO_ALPHA;
        drawCover(ctx, img, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);

    // ---- LIMPIEZA CON EL CURSOR ----
    const limpiar = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const radio = 110;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radio);
      grad.addColorStop(0, "rgba(0,0,0,1)");
      grad.addColorStop(0.6, "rgba(0,0,0,0.8)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radio, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    };

    const onMouseMove = (e: MouseEvent) => limpiar(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      limpiar(e.touches[0].clientX, e.touches[0].clientY);
    };

    // [FIX] El original de Gym escuchaba en el propio `canvas`, pero en
    // Vida Total el contenedor de la tarjeta (children de LoginVidrio)
    // termina ocupando el 100% del viewport con `pointer-events: auto`
    // (verificado: getBoundingClientRect da el tamaño completo de la
    // pantalla), y al estar por encima del canvas en el z-index le
    // "roba" el mousemove antes de que le llegue — el listener del
    // canvas nunca se disparaba con movimiento real del cursor (sí
    // funcionaba si se disparaba el evento manualmente en el canvas
    // mismo, lo que confirmó que la lógica de "limpiar" en sí está
    // bien, solo no le llegaba el evento). Escuchar en `window` evita
    // el problema por completo: el mousemove llega sin importar qué
    // elemento esté "encima" del canvas en el hit-test, porque no
    // depende de que el canvas sea el target/ancestro del evento.
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100dvh",
        overflow: "hidden",
        backgroundImage: "url(/login.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "block",
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto", width: "100%" }}>{children}</div>
      </div>
    </div>
  );
}
