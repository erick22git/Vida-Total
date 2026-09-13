"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, AlertCircle, UserPlus, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./auth-card.module.css";

type Errores = { email?: string; password?: string; general?: string };

export function LoginForm({
  onRegistrar,
  onRecuperar,
  onError,
}: {
  onRegistrar: () => void;
  onRecuperar: () => void;
  onError: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [errores, setErrores] = useState<Errores>({});

  function limpiarError(campo: keyof Errores) {
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nuevosErrores: Errores = {};
    if (!email.trim()) nuevosErrores.email = "Ingresa tu correo electrónico";
    if (!password) nuevosErrores.password = "Ingresa tu contraseña";
    if (nuevosErrores.email || nuevosErrores.password) {
      setErrores(nuevosErrores);
      onError();
      return;
    }

    setCargando(true);
    setErrores({});
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        const msg =
          error.message === "Invalid login credentials"
            ? "Correo o contraseña incorrectos"
            : error.message === "Email not confirmed"
              ? "Debes confirmar tu correo antes de iniciar sesión"
              : error.message;
        setErrores({ general: msg });
        onError();
        setCargando(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setErrores({ general: "Error al iniciar sesión. Intenta de nuevo." });
      onError();
      setCargando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {errores.general && (
        <p className={styles.formErrorBanner}>
          <AlertCircle size={14} />
          {errores.general}
        </p>
      )}

      <div className={styles.field}>
        <label className={styles.label}>Correo electrónico</label>
        <div className={styles.inputWrap}>
          <Mail size={15} className={styles.inputIcon} />
          <input
            className={`${styles.input}${errores.email ? ` ${styles.inputError}` : ""}`}
            type="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              limpiarError("email");
            }}
            autoComplete="email"
            autoFocus
          />
        </div>
        {errores.email && (
          <p className={styles.errorMsg}>
            <AlertCircle size={11} />
            {errores.email}
          </p>
        )}
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Contraseña</label>
        <div className={styles.inputWrap}>
          <Lock size={15} className={styles.inputIcon} />
          <input
            className={`${styles.input} ${styles.inputWithToggle}${errores.password ? ` ${styles.inputError}` : ""}`}
            type={showPass ? "text" : "password"}
            placeholder="Tu contraseña"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              limpiarError("password");
            }}
            autoComplete="current-password"
          />
          <button type="button" className={styles.toggleBtn} onClick={() => setShowPass((v) => !v)} tabIndex={-1}>
            {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errores.password && (
          <p className={styles.errorMsg}>
            <AlertCircle size={11} />
            {errores.password}
          </p>
        )}
      </div>

      <button type="submit" className={styles.submitBtn} disabled={cargando}>
        {cargando ? (
          <>
            <span className={styles.spinner} />
            Verificando...
          </>
        ) : (
          "INICIAR SESIÓN"
        )}
      </button>

      <div className={styles.bottomLinks}>
        <button type="button" className={`${styles.linkBtn} ${styles.linkBtnAccent}`} onClick={onRegistrar}>
          <UserPlus size={13} /> Registrarse
        </button>
        <button type="button" className={`${styles.linkBtn} ${styles.linkBtnMuted}`} onClick={onRecuperar}>
          <KeyRound size={13} /> Olvidé mi contraseña
        </button>
      </div>
    </form>
  );
}
