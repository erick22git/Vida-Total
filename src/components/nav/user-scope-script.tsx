/**
 * Script inline (bloqueante, no next/script) que escribe el id del
 * usuario logueado en localStorage ANTES que cualquier otro JS de la
 * app corra. Necesario para que los stores de Zustand (que se hidratan
 * al importarse, muy temprano) puedan namespacear su key de
 * localStorage por usuario desde la primera lectura.
 * Ver src/lib/store/user-scope.ts.
 */
export function UserScopeScript({ userId }: { userId: string }) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `try{window.localStorage.setItem("vida-total-uid",${JSON.stringify(userId)});}catch(e){}`,
      }}
    />
  );
}
