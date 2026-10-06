"use client";

/**
 * Pantalla de información Kegel — NHS/NICE + Squeezy.
 * Cómo identificar el músculo, cómo hacerlo correctamente,
 * cuándo parar, y aviso médico.
 *
 * NO hace ninguna afirmación clínica: todo es "las guías recomiendan..."
 */
import { useRouter } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { MONO_FONT } from "@/lib/ui/mono-font";

interface Section {
  title: string;
  body: string[];
}

const SECTIONS: Section[] = [
  {
    title: "Cómo identificar el músculo",
    body: [
      "Imagina que intentas detener el flujo de orina a mitad — ese es el músculo del suelo pélvico. Apriétalo sin contraer el abdomen, los glúteos ni los muslos.",
      "Consejo: no hagas estos ejercicios de forma habitual mientras orinas realmente — puede interferir con la función normal de la vejiga.",
    ],
  },
  {
    title: "Cómo hacerlo bien",
    body: [
      "Contrae el músculo unos segundos, luego relájalo el mismo tiempo. Descansa entre series.",
      "Respira con normalidad durante todo el ejercicio — no contengas el aliento.",
      "Mantén los demás músculos relajados: abdomen, glúteos y muslos no deben moverse.",
      "Puedes hacerlo sentado, de pie o tumbado boca arriba.",
    ],
  },
  {
    title: "Cuándo parar",
    body: [
      "Para inmediatamente si sientes dolor o molestia.",
      "Si los síntomas (incontinencia, pesadez) persisten más de unos meses, consulta a un profesional sanitario.",
      "Estas guías son informativas y no sustituyen el consejo médico personalizado.",
    ],
  },
  {
    title: "¿Cuánto tiempo hasta ver resultados?",
    body: [
      "Las guías NICE indican que se necesitan al menos 3 meses de práctica constante para evaluar resultados. La constancia es más importante que la intensidad.",
    ],
  },
];

function InfoSection({ section }: { section: Section }) {
  return (
    <div className="mb-6">
      <h2 className="text-[17px] font-bold mb-2 leading-tight">{section.title}</h2>
      {section.body.map((p, i) => (
        <p key={i} className="text-[15px] leading-relaxed mb-2" style={{ color: "#d0d8e8" }}>
          {p}
        </p>
      ))}
    </div>
  );
}

export default function KegelInfoPage() {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-[45] flex flex-col text-white" style={{ background: "#000" }}>
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),10px)] h-[calc(3.25rem+max(env(safe-area-inset-top),10px))] shrink-0">
        <button
          onClick={() => router.back()}
          aria-label="Volver"
          className="w-10 h-10 -ml-2 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
        >
          <ChevronLeft size={26} strokeWidth={2.4} />
        </button>
        <h1 className="text-[22px] font-bold tracking-tight">Información</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),28px)]">
        <p className="text-[13px] uppercase tracking-widest mb-5 pt-2" style={{ ...MONO_FONT, color: "#888" }}>
          Suelo Pélvico · Ejercicios de Kegel
        </p>

        {SECTIONS.map((s) => (
          <InfoSection key={s.title} section={s} />
        ))}

        {/* Aviso médico */}
        <div
          className="rounded-[12px] p-4 mt-2 mb-6"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <p className="text-[13px] leading-relaxed" style={{ color: "#aab4c8" }}>
            <strong style={{ color: "#fff" }}>Aviso médico: </strong>
            esta información es orientativa y no constituye consejo médico. Si tienes dolor, síntomas persistentes o alguna condición de salud, consulta con un profesional sanitario antes de comenzar cualquier programa de ejercicios.
          </p>
        </div>

        {/* Fuentes */}
        <div>
          <p className="text-[11px] uppercase tracking-widest mb-2" style={{ ...MONO_FONT, color: "#555" }}>
            Fuentes
          </p>
          <ul className="space-y-1">
            {[
              "NHS — Pelvic floor exercises (nhs.uk)",
              "NICE CG171 — Urinary incontinence in women (2013, rev. 2019)",
              "App Squeezy — NHS endorsed pelvic floor exercise app",
            ].map((s) => (
              <li key={s} className="text-[12px] leading-relaxed" style={{ color: "#555" }}>
                · {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}
