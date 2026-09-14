"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";
import { ForgotPasswordForm } from "./forgot-password-form";
import styles from "./auth-card.module.css";

type Vista = "login" | "registrar" | "recuperar";

const TITULOS: Record<Vista, string> = {
  login: "Bienvenido de nuevo",
  registrar: "Crear cuenta",
  recuperar: "Recuperar contraseña",
};

const SHAKE_VARIANTS = {
  idle: { x: 0 },
  shake: {
    x: [0, -9, 9, -7, 7, -4, 4, 0],
    transition: { duration: 0.52, ease: "easeInOut" as const },
  },
};

function LogoTitulo({ titulo, shakeKey, errorGlow }: { titulo: string; shakeKey: number; errorGlow: boolean }) {
  return (
    <motion.div
      key={shakeKey}
      variants={SHAKE_VARIANTS}
      animate={shakeKey > 0 ? "shake" : "idle"}
      className={styles.logoWrap}
    >
      <div className={`${styles.logoIcon}${errorGlow ? ` ${styles.errorGlow}` : ""}`}>
        <Sparkles size={26} className="text-white" />
      </div>
      <h1 className={styles.title}>Vida Total</h1>
      <p className={styles.subtitle}>{titulo}</p>
    </motion.div>
  );
}

function PieSesion() {
  return <p className={styles.footerNote}>Sesión segura</p>;
}

/**
 * Tarjeta de login. Antes usaba un flip 3D (rotateY + perspective,
 * portado de C:\Erick\Gym\src\pages\Login.jsx) para pasar de Login a
 * Registro/Olvidé-contraseña — se quitó porque combinar un
 * `backdrop-filter` (el blur de `.card`) con un padre en
 * `transform-style: preserve-3d` es una combinación con soporte
 * inconsistente en WebKit/Safari (la misma familia de bug ya vista en
 * el BottomNav — ver globals.css): en un iPhone real la tarjeta
 * giraba pero el compositor la "corregía" de golpe a mitad de la
 * animación en vez de completar el giro. Ahora es un simple cambio
 * de contenido (sin animación de transición entre vistas) — más
 * liviano y sin ese bug. Como ya no hay dos caras montadas a la vez,
 * la altura de la tarjeta también se ajusta sola al contenido de
 * cada vista en vez de reservar siempre el alto de la vista más
 * larga (Registro).
 */
export function AuthCard() {
  const [vista, setVista] = useState<Vista>("login");
  const [shakeKey, setShakeKey] = useState(0);
  const [errorGlow, setErrorGlow] = useState(false);

  const handleError = useCallback(() => {
    setShakeKey((k) => k + 1);
    setErrorGlow(true);
    setTimeout(() => setErrorGlow(false), 700);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`${styles.outer}${vista === "registrar" ? ` ${styles.outerWide}` : ""}`}
    >
      <div className={styles.card}>
        <div className={styles.cardBody}>
          <LogoTitulo
            titulo={vista === "login" ? TITULOS.login : vista === "registrar" ? TITULOS.registrar : TITULOS.recuperar}
            shakeKey={shakeKey}
            errorGlow={errorGlow}
          />
          {vista === "login" && (
            <LoginForm
              onRegistrar={() => setVista("registrar")}
              onRecuperar={() => setVista("recuperar")}
              onError={handleError}
            />
          )}
          {vista === "registrar" && <RegisterForm onVolver={() => setVista("login")} />}
          {vista === "recuperar" && <ForgotPasswordForm onVolver={() => setVista("login")} />}
          <PieSesion />
        </div>
      </div>
    </motion.div>
  );
}
