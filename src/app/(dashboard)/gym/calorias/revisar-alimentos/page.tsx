"use client";

/**
 * "Revisar alimentos en 0": detecta alimentos de TU base (editados o creados por ti) que quedaron con
 * calorías y macros todos en 0 — casi siempre un error al guardar (p. ej. "Arroz" editado sin llenar
 * los campos). Un alimento así, con el mismo id que uno de la base, lo TAPA en toda la app (buscador,
 * escáner, plan de comidas del nutriólogo), así que mientras exista roto el original queda escondido.
 *
 * Esta pantalla solo mira `customFoods` (lo que agregaste/editaste vos) — los alimentos de la base NUNCA
 * se guardan con 0 por error (los pocos que sí dan 0 de verdad, como el agua o la sal, están documentados
 * así a propósito).
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useGymStore } from "@/lib/store/gymStore";
import { BASE_FOODS } from "@/lib/food-utils";
import { ExpandSheet } from "@/components/shared/expand-sheet";

export default function RevisarAlimentosPage() {
  const customFoods = useGymStore((s) => s.customFoods);
  const removeCustomFood = useGymStore((s) => s.removeCustomFood);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const broken = useMemo(
    () =>
      customFoods
        .filter((f) => !f.calorias && !f.proteina && !f.carbos && !f.grasas)
        .map((f) => ({ food: f, base: BASE_FOODS.find((b) => b.id === f.id) })),
    [customFoods],
  );

  const target = broken.find((b) => b.food.id === confirmId);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/calorias" aria-label="Volver a Calorías" className="text-white/60 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Alimentos en 0</h1>
      </header>

      {broken.length === 0 ? (
        <p className="text-sm text-white/55">No hay ningún alimento tuyo en 0 kcal ahora mismo. Si vuelves a ver uno &ldquo;en 0&rdquo; al buscar o registrar, vuelve acá.</p>
      ) : (
        <>
          <p className="text-sm text-white/60 leading-relaxed">
            {broken.length} {broken.length === 1 ? "alimento tuyo está" : "alimentos tuyos están"} en 0 kcal y 0 g — probablemente un error al
            guardarlos.{" "}
            {broken.some((b) => b.base) && "Los que reemplazan a uno de la base app (mismo nombre que ya existía) lo están tapando en toda la app mientras sigan rotos."}
          </p>
          <div className="flex flex-col gap-2.5">
            {broken.map(({ food, base }) => (
              <div key={food.id} className="rounded-2xl bg-white/[0.05] p-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{food.nombre}</p>
                  <p className="text-xs text-white/45">
                    {food.categoria} · {food.porcion}
                    {base ? " · reemplaza a un alimento de la base" : " · alimento propio"}
                  </p>
                </div>
                <Link
                  href={`/gym/calorias/crear-alimento?editId=${food.id}`}
                  aria-label={`Editar ${food.nombre}`}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.08] text-white/80 cursor-pointer shrink-0"
                >
                  <Pencil size={15} />
                </Link>
                <button
                  onClick={() => setConfirmId(food.id)}
                  aria-label={base ? `Restablecer ${food.nombre}` : `Eliminar ${food.nombre}`}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-white/[0.08] text-white/80 cursor-pointer shrink-0"
                >
                  {base ? <RotateCcw size={15} /> : <Trash2 size={15} />}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <ExpandSheet open={!!target} onClose={() => setConfirmId(null)} title={target?.base ? "¿Restablecer alimento?" : "¿Eliminar alimento?"}>
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-sm text-white/65">
            {target?.base
              ? `"${target.food.nombre}" vuelve a mostrar los datos originales de la base de la app. Lo que editaste se pierde.`
              : `Se borra "${target?.food.nombre}" por completo, incluido de la nube. Esto no se puede deshacer.`}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmId(null)} className="flex-1 rounded-full py-3 text-sm font-semibold text-white/80 bg-white/[0.08] cursor-pointer">
              Cancelar
            </button>
            <button
              onClick={() => {
                if (confirmId) removeCustomFood(confirmId);
                setConfirmId(null);
              }}
              className="flex-1 rounded-full py-3 text-sm font-semibold text-black bg-white cursor-pointer"
            >
              {target?.base ? "Restablecer" : "Eliminar"}
            </button>
          </div>
        </div>
      </ExpandSheet>
    </div>
  );
}
