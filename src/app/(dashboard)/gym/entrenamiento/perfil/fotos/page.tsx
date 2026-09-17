"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Dumbbell, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { GlassCard } from "@/components/glass/glass-card";
import { useGymStore } from "@/lib/store/gymStore";

/** Bloque 13: una foto de progreso por mes calendario, asociada
 * automáticamente al plan que estaba activo cuando se subió (ver
 * `setProgressPhoto`/`planHistory` en gymStore.ts). Vive en Perfil porque
 * el módulo Progreso general todavía no existe (ver roadmap) — cuando se
 * construya, esta pantalla se puede mover ahí tal cual. */
function currentMonthKey(): string {
  return format(new Date(), "yyyy-MM");
}

export default function ProgressPhotosPage() {
  const progressPhotos = useGymStore((s) => s.progressPhotos);
  const plans = useGymStore((s) => s.plans);
  const setProgressPhoto = useGymStore((s) => s.setProgressPhoto);
  const removeProgressPhoto = useGymStore((s) => s.removeProgressPhoto);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const thisMonth = currentMonthKey();
  const currentPhoto = progressPhotos.find((p) => p.monthKey === thisMonth);

  const timeline = useMemo(
    () => [...progressPhotos].sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1)),
    [progressPhotos],
  );

  function planName(planId: string | undefined): string {
    if (!planId) return "Sin plan asignado";
    return plans.find((p) => p.id === planId)?.nombre ?? "Plan eliminado";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProgressPhoto(thisMonth, reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/gym/entrenamiento/perfil" className="text-white/50 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Fotos de Progreso</h1>
      </header>

      <GlassCard padding="md" className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-white/80 capitalize">
          {format(new Date(), "MMMM yyyy", { locale: es })}
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-56 rounded-2xl bg-white/[0.04] border border-dashed border-white/[0.15] flex items-center justify-center overflow-hidden cursor-pointer"
        >
          {currentPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentPhoto.photoUrl} alt="Foto de progreso de este mes" className="w-full h-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1.5 text-white/40 text-xs">
              <Camera size={24} /> Subir foto de este mes
            </span>
          )}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <p className="text-xs text-white/45">
          Se asocia automáticamente a <span className="text-white/70 font-medium">{planName(currentPhoto?.planId)}</span>, el
          plan activo este mes.
        </p>
      </GlassCard>

      <div className="flex flex-col gap-2.5">
        <h2 className="text-sm font-semibold text-white/85">Línea de tiempo</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-white/35 text-center py-8">Todavía no subiste ninguna foto mensual.</p>
        ) : (
          timeline.map((photo) => (
            <GlassCard key={photo.id} padding="sm" interactive={false} className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/[0.06] shrink-0 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.photoUrl} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white capitalize">
                  {format(new Date(`${photo.monthKey}-01`), "MMMM yyyy", { locale: es })}
                </p>
                <p className="text-xs text-white/45 flex items-center gap-1 truncate">
                  <Dumbbell size={11} className="shrink-0" /> {planName(photo.planId)}
                </p>
              </div>
              <button
                onClick={() => removeProgressPhoto(photo.id)}
                className="text-white/30 hover:text-red-400 cursor-pointer shrink-0"
                aria-label="Eliminar foto"
              >
                <Trash2 size={15} />
              </button>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}
