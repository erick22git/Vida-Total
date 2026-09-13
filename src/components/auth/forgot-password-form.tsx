"use client";

import { useState } from "react";
import { Mail, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BackButton } from "./back-button";
import styles from "./auth-card.module.css";

export function ForgotPasswordForm({ onVolver }: { onVolver: () => void }) {
  const [email, setEmail] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Ingresa tu correo electrónico");
      return;
    }
    setCargando(true);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (resetError) {
        setError(resetError.message);
        setCargando(false);
        return;
      }
      setExito(true);
    } catch {
      setError("Error al enviar el correo de recuperación. Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  if (exito) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <BackButton onClick={onVolver} />
        <p className={styles.formSuccessBanner}>
          <CheckCircle2 size={16} />
          Si existe una cuenta con ese correo, te enviamos un enlace para restablecer tu contraseña.
        </p>
        <button type="button" className={styles.submitBtn} onClick={onVolver}>
          VOLVER A INICIAR SESIÓN
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <BackButton onClick={onVolver} />

      {error && (
        <p className={styles.formErrorBanner}>
          <AlertCircle size={14} />
          {error}
        </p>
      )}

      <div className={styles.field}>
        <label className={styles.label}>Correo electrónico *</label>
        <div className={styles.inputWrap}>
          <Mail size={15} className={styles.inputIcon} />
          <input
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            autoFocus
            autoComplete="email"
          />
        </div>
      </div>

      <button type="submit" className={styles.submitBtn} disabled={cargando}>
        {cargando ? (
          <>
            <span className={styles.spinner} />
            Enviando...
          </>
        ) : (
          "ENVIAR ENLACE DE RECUPERACIÓN"
        )}
      </button>
    </form>
  );
}
