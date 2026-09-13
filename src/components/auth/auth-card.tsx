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
 * Tarjeta de login con flip 3D — portada de
 * C:\Erick\Gym\src\pages\Login.jsx (mecánica: .login-flip-container /
 * .login-flip-inner / .login-flip-front / .login-flip-back, solo
 * lectura). El frente es el formulario de Login; el reverso alterna
 * entre Registro y Olvidé mi contraseña según `vista`.
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

  const flipped = vista !== "login";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`${styles.outer}${vista === "registrar" ? ` ${styles.outerWide}` : ""}`}
    >
      <div className={styles.flipContainer}>
        <div className={`${styles.flipInner}${flipped ? ` ${styles.flipped}` : ""}`}>
          <div className={styles.flipFront}>
            <div className={styles.card}>
              <div className={styles.cardBody}>
                <LogoTitulo titulo={TITULOS.login} shakeKey={shakeKey} errorGlow={errorGlow} />
                <LoginForm
                  onRegistrar={() => setVista("registrar")}
                  onRecuperar={() => setVista("recuperar")}
                  onError={handleError}
                />
                <PieSesion />
              </div>
            </div>
          </div>
          <div className={styles.flipBack}>
            <div className={styles.card}>
              <div className={styles.cardBody}>
                <LogoTitulo
                  titulo={vista === "registrar" ? TITULOS.registrar : TITULOS.recuperar}
                  shakeKey={0}
                  errorGlow={false}
                />
                {vista === "registrar" && <RegisterForm onVolver={() => setVista("login")} />}
                {vista === "recuperar" && <ForgotPasswordForm onVolver={() => setVista("login")} />}
                <PieSesion />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
