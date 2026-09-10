/** Full-viewport background photo for a single route (not shared chrome —
 * the sidebar/bottom-nav stay on top with their own glass background).
 * `positionClass` lets each page pick a responsive `object-position` so the
 * same wide photo pans to a different, still-uncropped-feeling focal point
 * on mobile vs. tablet vs. desktop instead of one static center-crop. */
export function PageBackdrop({ src, positionClass }: { src: string; positionClass?: string }) {
  // No z-index (esp. no negative): `body` tiene `position: relative`, así que
  // un hijo con z-index negativo queda debajo del propio fondo de `body` y
  // desaparece. En vez de eso, esto se apoya en el orden del DOM — se monta
  // primero, antes que el resto del contenido de la página — para quedar
  // visualmente detrás sin necesidad de z-index.
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={`absolute inset-0 w-full h-full object-cover ${positionClass ?? "object-center"}`}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(6,6,10,0.55) 0%, rgba(6,6,10,0.82) 55%, rgba(6,6,10,0.94) 100%)",
        }}
      />
    </div>
  );
}
