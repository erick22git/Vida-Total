"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { BOTTOM_NAV_MODULES } from "@/lib/constants";
import { ICON_MAP } from "./icon-map";
import { useGlassMenu } from "@/glass-engine/use-glass-menu";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

/**
 * BottomNav — burbuja de vidrio real (motor vainilla portado tal
 * cual de C:\Erick\Gym\src\glass-engine\core\menu.js, ver
 * src/glass-engine/menu.ts + glass.ts + use-glass-menu.ts).
 *
 * A diferencia del intento anterior (Framer Motion `layoutId` +
 * use-bubble-spring.ts, que aproximaba el spring y nunca logró el
 * vidrio real — se veía blanca/opaca en vez de transparente) esta
 * versión NO usa React para animar la burbuja: GlassMenu inyecta
 * su propio nodo `.glass-selector` como hijo directo del
 * contenedor `.glass-menu` (ref de abajo) y lo mueve frame a
 * frame con dos resortes físicos reales (xSpring/widthSpring),
 * más un GlassMaterial (canal "menu") que aplica los filtros SVG
 * reales (feDisplacementMap de refracción + feSpecularLighting)
 * en cuanto public/svg/filters.svg termina de cargar — mientras
 * tanto la burbuja simplemente no es visible (opacity 0 hasta el
 * primer syncToActive), nunca se ve un placeholder blanco/opaco.
 *
 * Requisito funcional del usuario: por defecto el menú muestra
 * SOLO íconos — el label de texto aparece únicamente en el ítem
 * activo (`{active && <span>...}`), nunca en los demás.
 *
 * Como Next.js navega con <Link> (no con el click listener manual
 * que GlassMenu añade sobre cada .menu-item — se deja, es parte
 * del motor y es inofensivo), el índice activo se deriva de
 * usePathname() y se le pasa a useGlassMenu(); cuando cambia la
 * ruta, el hook llama a instance.select()/syncToActive() y el
 * propio motor anima la burbuja hacia la nueva posición.
 *
 * Sin ningún color de módulo (corrección previa del usuario): el
 * ítem activo se distingue solo por blanco + escala 1.15 (ver
 * .menu-item.active en globals.css), igual que antes.
 */
export function BottomNav() {
  const pathname = usePathname();

  const menuRef = useRef<HTMLDivElement>(null);

  const activeIndex = BOTTOM_NAV_MODULES.findIndex((mod) => isActive(pathname, mod.href));

  useGlassMenu(menuRef, activeIndex);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-1">
      <div
        ref={menuRef}
        className="glass-menu w-full flex items-center justify-between px-1.5"
        style={{ background: "color-mix(in srgb, var(--background) 88%, transparent)" }}
      >
        {BOTTOM_NAV_MODULES.map((mod, index) => {
          const Icon = ICON_MAP[mod.icon];
          const active = index === activeIndex;
          return (
            <Link
              key={mod.id}
              href={mod.href}
              className={`menu-item relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl ${
                active ? "active" : ""
              }`}
            >
              <div className="menu-item-content flex flex-col items-center gap-0.5">
                <Icon size={20} />
                {active && <span className="text-[10px] font-medium">{mod.label}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
