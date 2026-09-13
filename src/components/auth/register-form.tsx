"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BackButton } from "./back-button";
import styles from "./auth-card.module.css";

export function RegisterForm({ onVolver }: { onVolver: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({ nombre: "", email: "", password: "", confirmar: "" });
  const [showPass, setShowPass] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExito(null);

    if (!form.nombre.trim()) return setError("El nombre completo es obligatorio");
    if (!form.email.trim()) return setError("El correo es obligatorio");
    if (!form.password) return setError("La contraseña es obligatoria");
    if (form.password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres");
    if (form.password !== form.confirmar) return setError("Las contraseñas no coinciden");

    setCargando(true);
    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: { full_name: form.nombre.trim() },
        },
      });

      if (signUpError) {
        setError(
          signUpError.message === "User already registered"
            ? "Ya existe una cuenta con este correo"
            : signUpError.message,
        );
        setCargando(false);
        return;
      }

      // Si el proyecto de Supabase requiere confirmación de email
      // (Authentication > Settings > Email confirmations), signUp() NO
      // devuelve una sesión activa (data.session es null) aunque el
      // usuario se haya creado correctamente — no asumimos login
      // automático, mostramos el mensaje correcto en cada caso.
      if (!data.session) {
        setExito("¡Cuenta creada! Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.");
        setCargando(false);
        return;
      }

      // Confirmación de email desactivada: ya hay sesión activa.
      router.push("/");
      router.refresh();
    } catch {
      setError("Error al registrar la cuenta. Intenta de nuevo.");
      setCargando(false);
    }
  }

  if (exito) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <BackButton onClick={onVolver} />
        <p className={styles.formSuccessBanner}>
          <CheckCircle2 size={16} />
          {exito}
        </p>
        <button type="button" className={styles.submitBtn} onClick={onVolver}>
          IR A INICIAR SESIÓN
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <BackButton onClick={onVolver} />

      {error && (
        <p className={styles.formErrorBanner}>
          <AlertCircle size={14} />
          {error}
        </p>
      )}

      <div className={styles.field}>
        <label className={styles.label}>Nombre completo *</label>
        <div className={styles.inputWrap}>
          <User size={15} className={styles.inputIcon} />
          <input
            className={styles.input}
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            placeholder="Nombre Apellido"
            autoFocus
          />
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>Correo electrónico *</label>
        <div className={styles.inputWrap}>
          <Mail size={15} className={styles.inputIcon} />
          <input
            className={styles.input}
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="tu@correo.com"
            autoComplete="email"
          />
        </div>
      </div>

      <div className={styles.gridTwo}>
        <div className={styles.field}>
          <label className={styles.label}>Contraseña *</label>
          <div className={styles.inputWrap}>
            <Lock size={14} className={styles.inputIcon} />
            <input
              className={`${styles.input} ${styles.inputWithToggle}`}
              type={showPass ? "text" : "password"}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="mín. 6 caracteres"
              autoComplete="new-password"
            />
            <button type="button" className={styles.toggleBtn} onClick={() => setShowPass((v) => !v)} tabIndex={-1}>
              {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Confirmar *</label>
          <div className={styles.inputWrap}>
            <Lock size={14} className={styles.inputIcon} />
            <input
              className={styles.input}
              type={showPass ? "text" : "password"}
              value={form.confirmar}
              onChange={(e) => set("confirmar", e.target.value)}
              placeholder="repetir"
              autoComplete="new-password"
            />
          </div>
        </div>
      </div>

      <button type="submit" className={styles.submitBtn} disabled={cargando}>
        {cargando ? (
          <>
            <span className={styles.spinner} />
            Registrando...
          </>
        ) : (
          "CREAR CUENTA"
        )}
      </button>
      <p className={styles.helperNote}>Tu cuenta se crea con rol de usuario estándar.</p>
    </form>
  );
}
