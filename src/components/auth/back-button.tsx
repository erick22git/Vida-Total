"use client";

import styles from "./auth-card.module.css";

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={styles.backBtn}>
      ← Volver
    </button>
  );
}
