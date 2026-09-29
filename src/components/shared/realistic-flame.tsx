"use client";

/**
 * Fuego "realista" para todas las rachas de la app (antes era el emoji 🔥 plano) — pedido del usuario
 * a partir de `biblioteca de assets/racha/racha.blend`: un modelo de Blender pensado para esto. Ese
 * .blend no se puede abrir/renderizar desde acá (no hay ninguna herramienta de Blender en esta sesión
 * — la infraestructura 3D del proyecto solo tiene la Fase 1 lista, ver memoria), así que esto es una
 * aproximación 100% CSS: varias "lenguas" de fuego superpuestas (cada una parpadea a su propio ritmo,
 * como fuego real) + un resplandor de fondo + humo que sube y se desvanece arriba. Se puede reemplazar
 * más adelante por el render de Blender sin tocar dónde se usa este componente (mismo `size` en props).
 */
import styles from "./realistic-flame.module.css";

export function RealisticFlame({ size = 28 }: { size?: number }) {
  return (
    <span className={styles.wrap} style={{ width: size, height: size }} aria-hidden>
      <span className={styles.glow} />
      <span className={`${styles.smoke} ${styles.smoke1}`} />
      <span className={`${styles.smoke} ${styles.smoke2}`} />
      <span className={`${styles.smoke} ${styles.smoke3}`} />
      <span className={`${styles.tongue} ${styles.tongueOuter}`} />
      <span className={`${styles.tongue} ${styles.tongueMid}`} />
      <span className={`${styles.tongue} ${styles.tongueCore}`} />
    </span>
  );
}
