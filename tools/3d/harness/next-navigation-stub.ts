import { useMemo } from "react";
// push = navegación real (recarga con la URL nueva): los stores persisten en localStorage, así se reproduce el flujo entre pantallas.
export function useRouter() { return { push: (u: string) => { console.log("router.push", u); (window as any).__pushed = u; window.location.assign(u); }, replace: () => {}, back: () => {}, prefetch: () => {} }; }
export function useSearchParams() { return useMemo(() => new URLSearchParams(window.location.search), []); }
export function usePathname() { return window.location.pathname; }
