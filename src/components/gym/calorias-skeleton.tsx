/**
 * Esqueleto instantáneo de las pantallas de Calorías (mismo fondo, encabezado y círculo central que las
 * pantallas reales). Se pinta antes de que llegue nada del servidor — ver `app/(dashboard)/gym/calorias/loading.tsx`.
 * Sin hooks ni datos: es estático a propósito para que cueste cero.
 */
export function CaloriasSkeleton() {
  return (
    <div
      className="fixed inset-0 z-[45] flex flex-col text-white overflow-hidden"
      style={{ background: "var(--app-bg)" }}
      aria-busy="true"
      aria-label="Cargando"
    >
      <header className="flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),10px)] h-[calc(3rem+max(env(safe-area-inset-top),10px))]">
        <div className="w-10 h-10 rounded-full shrink-0" style={{ background: "#0d0d0d" }} />
        <div className="h-3 w-28 rounded-full bg-white/10 animate-pulse" />
        <div className="w-10 h-10 shrink-0" />
      </header>
      <div className="flex-1 flex flex-col items-center justify-center gap-7 px-6">
        <div className="w-[68vw] max-w-[340px] aspect-square rounded-full animate-pulse" style={{ background: "#0d0d0d" }} />
      </div>
      <div className="pb-[max(env(safe-area-inset-bottom),28px)] min-h-[104px] flex items-center justify-center gap-3">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="w-8 h-8 rounded-full bg-white/[0.07]" />
        ))}
      </div>
    </div>
  );
}
