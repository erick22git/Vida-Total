"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { BOTTOM_NAV_MODULES } from "@/lib/constants";
import { ICON_MAP } from "./icon-map";
import { useGlassMenu } from "@/glass-engine/use-glass-menu";

type ModuleDefItem = (typeof BOTTOM_NAV_MODULES)[number];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

// Tiempo de long-press sobre la burbuja YA VISIBLE para abrir el menú
// completo (bajado de los 2000ms originales — el usuario lo pidió más
// rápido). El toque que revela la burbuja desde "peek" es aparte y no
// cuenta para este timer.
const LONG_PRESS_MS = 600;
// Un dedo apoyado sobre la pantalla tiembla naturalmente mucho más que un
// mouse — un umbral chico cancelaba el long-press casi siempre en un
// teléfono real antes de completarse.
const MOVE_CANCEL_PX = 28;
const AUTO_COLLAPSE_MS = 4000;
// Si la burbuja (ya revelada, sin llegar a expandirse) queda un rato sin
// que la toquen, vuelve sola a "peek" (semi-oculta).
const BUBBLE_IDLE_MS = 2500;
// Porcentaje de su propio ancho que la burbuja esconde fuera del borde
// izquierdo en el estado "peek" — solo deja ver un borde redondeado como
// indicación de que está ahí, sin ícono ni texto legible.
const PEEK_TRANSLATE = "translateX(-85%)";

const GLASS_BACKGROUND = "color-mix(in srgb, var(--background) 88%, transparent)";

function vibrate() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(20);
    }
  } catch {
    // Feature-detected best-effort only — never let a vibration
    // failure (unsupported browser, permission denied, etc.) break
    // the expand interaction.
  }
}

/**
 * GlassMenuRow — el `.glass-menu` real + el motor GlassMenu (ver
 * use-glass-menu.ts/menu.ts), parametrizado por la lista de
 * `.menu-item` que debe mostrar.
 *
 * GlassMenu.constructor() hace `querySelectorAll('.menu-item')`
 * UNA sola vez al montar y nunca vuelve a escanear el DOM (ver
 * menu.ts línea ~74) — no hay forma de "avisarle" que la cantidad
 * de ítems cambió. Por eso, para pasar de 1 ítem (colapsado) a 6
 * (expandido) sin pelear con el motor, el padre (BottomNav)
 * monta este componente con una `key` distinta por estado
 * (collapsed/expanded): React lo desmonta/monta de cero, lo que
 * dispara el efecto de montaje de useGlassMenu (destroy() del
 * GlassMenu viejo + `new GlassMenu()` que re-escanea `.menu-item`
 * ya con la lista correcta) en vez de intentar mutar una instancia
 * viva.
 */
function GlassMenuRow({
  modules,
  activeIndex,
  containerClassName,
  renderItem,
}: {
  modules: ModuleDefItem[];
  activeIndex: number;
  containerClassName: string;
  renderItem: (mod: ModuleDefItem, index: number, active: boolean) => ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useGlassMenu(menuRef, activeIndex);

  return (
    <div ref={menuRef} className={containerClassName} style={{ background: GLASS_BACKGROUND }}>
      {modules.map((mod, index) => renderItem(mod, index, index === activeIndex))}
    </div>
  );
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
 * contenedor `.glass-menu` (ref de GlassMenuRow) y lo mueve frame a
 * frame con dos resortes físicos reales (xSpring/widthSpring),
 * más un GlassMaterial (canal "menu") que aplica los filtros SVG
 * reales (feDisplacementMap de refracción + feSpecularLighting)
 * en cuanto public/svg/filters.svg termina de cargar — mientras
 * tanto la burbuja simplemente no es visible (opacity 0 hasta el
 * primer syncToActive), nunca se ve un placeholder blanco/opaco.
 *
 * Interacción de 3 etapas (pedida por el usuario tras probar la versión
 * de solo 2 etapas — la burbuja colapsada quedaba muy a la vista):
 *
 *   "peek"     → casi toda la burbuja vive fuera del borde izquierdo de
 *                la pantalla (transform: translateX(-72%)); solo se ve
 *                un borde redondeado como indicación de que está ahí, sin
 *                ícono ni texto legibles. Es el estado de reposo/default.
 *   "bubble"   → un tap sobre ese borde revela la burbuja completa (ícono
 *                + label del módulo activo), ya dentro de la pantalla.
 *                Ese mismo toque NO cuenta para el long-press siguiente.
 *   "expanded" → un long-press (LONG_PRESS_MS, ver arriba) sobre la
 *                burbuja YA VISIBLE ("bubble") vibra el teléfono
 *                (`navigator.vibrate`, feature-detected) y abre la fila
 *                completa de 6 íconos — el mismo GlassMenu de siempre.
 *
 * Tocar un ítem del menú expandido navega (<Link>) y vuelve directo a
 * "peek"; tocar afuera del menú o quedarse inactivo (BUBBLE_IDLE_MS en
 * "bubble", AUTO_COLLAPSE_MS en "expanded") también vuelve a "peek" solo.
 *
 * Los tres estados salvo "expanded" comparten el mismo GlassMenuRow
 * (mismo `key="collapsed"`, un solo `.menu-item`) — "peek"/"bubble" son
 * puramente visuales (un transform en un wrapper alrededor del row), así
 * que no hace falta remontar el motor entre ellos. Solo se remonta al
 * entrar/salir de "expanded" (ver comentario en GlassMenuRow de por qué:
 * GlassMenu escanea `.menu-item` una sola vez al construirse).
 *
 * Como Next.js navega con <Link> (no con el click listener manual
 * que GlassMenu añade sobre cada .menu-item — se deja, es parte
 * del motor y es inofensivo), el índice activo se deriva de
 * usePathname().
 *
 * Sin ningún color de módulo (corrección previa del usuario): el
 * ítem activo se distingue solo por blanco + escala 1.15 (ver
 * .menu-item.active en globals.css), igual que antes.
 */
type Stage = "peek" | "bubble" | "expanded";

export function BottomNav() {
  const pathname = usePathname();

  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const autoRevertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [stage, setStage] = useState<Stage>("peek");

  const rawActiveIndex = BOTTOM_NAV_MODULES.findIndex((mod) => isActive(pathname, mod.href));
  const activeIndex = rawActiveIndex === -1 ? 0 : rawActiveIndex;
  const activeModule = BOTTOM_NAV_MODULES[activeIndex];

  // Cualquier navegación real (tap en un módulo dentro del menú
  // expandido) cambia el pathname — se usa como red de seguridad
  // para volver a "peek", además del onClick de cada <Link>. Se
  // resuelve durante el render con el patrón oficial de React
  // "Adjusting state when a prop changes" (state, no ref, comparado
  // y corregido en el propio cuerpo del render) en vez de un
  // useEffect, porque un setState incondicional dentro de un
  // efecto dispara el lint react-hooks/set-state-in-effect
  // (renders en cascada) y leer/escribir un ref durante el render
  // dispara react-hooks/refs.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (stage !== "peek") setStage("peek");
  }

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    pressStart.current = null;
  }, []);

  const goToPeek = useCallback(() => {
    setStage("peek");
  }, []);

  const scheduleAutoRevert = useCallback((ms: number) => {
    if (autoRevertTimer.current) clearTimeout(autoRevertTimer.current);
    autoRevertTimer.current = setTimeout(goToPeek, ms);
  }, [goToPeek]);

  // Fuera de "peek" (o sea "bubble"/"expanded"): volver solo a "peek" si
  // el usuario no toca nada por un rato, o si toca fuera del menú.
  useEffect(() => {
    if (stage === "peek") return;

    scheduleAutoRevert(stage === "expanded" ? AUTO_COLLAPSE_MS : BUBBLE_IDLE_MS);

    const handlePointerDownOutside = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        goToPeek();
      }
    };

    document.addEventListener("pointerdown", handlePointerDownOutside);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside);
      if (autoRevertTimer.current) {
        clearTimeout(autoRevertTimer.current);
        autoRevertTimer.current = null;
      }
    };
  }, [stage, goToPeek, scheduleAutoRevert]);

  useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const handleBubblePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // Desde "peek" el primer toque solo revela la burbuja — no cuenta
      // para el long-press de expandir, que necesita un toque aparte ya
      // con la burbuja visible.
      if (stage === "peek") {
        setStage("bubble");
        return;
      }

      pressStart.current = { x: event.clientX, y: event.clientY };

      // Pointer capture ancla el resto del gesto (move/up/cancel) a ESTE
      // elemento sin importar dónde termine el dedo — en móvil, sin esto,
      // un mínimo reflow (p.ej. el squeeze del propio GlassMaterial al
      // presionar) puede hacer que el navegador considere que el puntero
      // "salió" del elemento y aborte el hold antes de tiempo.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Algunos navegadores/casos (p.ej. click sintético) pueden rechazar
        // la captura — no es crítico, el resto de la lógica sigue funcionando.
      }

      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        vibrate();
        setStage("expanded");
      }, LONG_PRESS_MS);
    },
    [stage],
  );

  const handleBubblePointerMove = useCallback((event: ReactPointerEvent) => {
    if (!pressStart.current || !longPressTimer.current) return;

    const dx = event.clientX - pressStart.current.x;
    const dy = event.clientY - pressStart.current.y;

    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
      clearLongPressTimer();
    }
  }, [clearLongPressTimer]);

  const handleItemTap = useCallback(() => {
    goToPeek();
  }, [goToPeek]);

  return (
    <nav
      ref={containerRef}
      className={`md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-1 flex ${
        stage === "expanded" ? "justify-center" : "justify-start"
      }`}
    >
      {stage === "expanded" ? (
        <GlassMenuRow
          key="expanded"
          modules={BOTTOM_NAV_MODULES}
          activeIndex={activeIndex}
          containerClassName="glass-menu w-full flex items-center justify-between px-1.5"
          renderItem={(mod, index, active) => {
            const Icon = ICON_MAP[mod.icon];
            return (
              <Link
                key={mod.id}
                href={mod.href}
                onClick={handleItemTap}
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
          }}
        />
      ) : (
        <div
          className="transition-transform duration-300 ease-out"
          style={{ transform: stage === "peek" ? PEEK_TRANSLATE : "translateX(0)" }}
        >
          <GlassMenuRow
            key="collapsed"
            modules={[activeModule]}
            activeIndex={0}
            containerClassName="glass-menu inline-flex items-center justify-center px-1.5"
            renderItem={(mod) => {
              const Icon = ICON_MAP[mod.icon];
              return (
                <div
                  key={mod.id}
                  role="button"
                  tabIndex={0}
                  aria-label={
                    stage === "peek"
                      ? "Mostrar barra de navegación"
                      : `${mod.label}. Mantén presionado para abrir el menú.`
                  }
                  className="menu-item active relative z-10 flex flex-col items-center justify-center gap-0.5 py-1.5 px-4 rounded-2xl select-none touch-none"
                  style={{ WebkitTouchCallout: "none" }}
                  onPointerDown={handleBubblePointerDown}
                  onPointerMove={handleBubblePointerMove}
                  onPointerUp={clearLongPressTimer}
                  onPointerCancel={clearLongPressTimer}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <div className="menu-item-content flex flex-col items-center gap-0.5">
                    <Icon size={20} />
                    <span className="text-[10px] font-medium">{mod.label}</span>
                  </div>
                </div>
              );
            }}
          />
        </div>
      )}
    </nav>
  );
}
