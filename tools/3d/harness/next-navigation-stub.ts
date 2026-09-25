import { useMemo } from "react";
export function useRouter() { return { push: (u: string) => console.log("router.push", u), replace: () => {}, back: () => {}, prefetch: () => {} }; }
export function useSearchParams() { return useMemo(() => new URLSearchParams(window.location.search), []); }
export function usePathname() { return window.location.pathname; }
