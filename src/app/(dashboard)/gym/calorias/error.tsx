"use client";

import { useEffect } from "react";
import { playEvent } from "@/lib/sound/sound-manager";

/**
 * Red de seguridad de Calorías: si una pantalla de esta sección lanza un error en el navegador, en vez de quedar en
 * blanco se ve este aviso con «Reintentar». Solo registra el NOMBRE del error y su `digest` (un identificador que Next
 * pone al error del servidor) para poder buscarlo en los logs de Vercel: nunca el mensaje ni los datos de la persona.
 */
export default function CaloriasError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[calorias] error de pantalla:", error.name, error.digest ?? "sin-digest");
    void playEvent("error");
  }, [error]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 px-6 text-center text-white" style={{ background: "var(--app-bg)" }}>
      <p className="text-base font-semibold">No se pudo mostrar esta pantalla</p>
      <p className="text-sm text-white/55">Tus datos no se tocaron. Intenta de nuevo; si sigue igual, vuelve a Calorías.</p>
      <div className="flex gap-2">
        <button onClick={reset} className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black cursor-pointer">
          Reintentar
        </button>
        <a href="/gym/calorias" className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white">
          Volver a Calorías
        </a>
      </div>
    </div>
  );
}
