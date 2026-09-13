"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LoginVidrio } from "@/components/auth/login-vidrio";
import cardStyles from "@/components/auth/auth-card.module.css";

/**
 * Pantalla a la que Supabase redirige tras el link de "olvidé mi
 * contraseña" (ver resetPasswordForEmail en forgot-password-form.tsx,
 * redirectTo: `${origin}/auth/reset-password`). Supabase entrega una
 * sesión de recuperación temporal vía el hash de la URL — el cliente
 * de supabase-js la procesa automáticamente al cargar la página, así
 * que solo hace falta llamar updateUser({ password }) cuando el
 * usuario confirma su nueva contraseña.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // onAuthStateChange dispara PASSWORD_RECOVERY cuando supabase-js
    // procesa el token de recuperación del hash de la URL.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    // Si el usuario ya tiene sesión activa (o el token ya fue procesado
    // antes de que se suscriba el listener) tratamos el link como
    // válido igual — updateUser funciona con cualquier sesión activa.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else {
        // Da tiempo a que el listener de arriba reaccione al hash antes
        // de asumir que el link es inválido/expirado.
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: d2 }) => {
            if (!d2.session) setInvalidLink(true);
          });
        }, 1500);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setCargando(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        setCargando(false);
        return;
      }
      setExito(true);
      setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 1800);
    } catch {
      setError("Error al actualizar la contraseña. Intenta de nuevo.");
      setCargando(false);
    }
  }

  return (
    <LoginVidrio>
      <div className="w-full h-full flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={cardStyles.outer}
        >
          <div className={cardStyles.card} style={{ height: "auto" }}>
            <div className={cardStyles.cardBody} style={{ overflow: "visible" }}>
              <div className={cardStyles.logoWrap}>
                <div className={cardStyles.logoIcon}>
                  <Lock size={22} className="text-white" />
                </div>
                <h1 className={cardStyles.title}>Nueva contraseña</h1>
                <p className={cardStyles.subtitle}>Establece tu nueva contraseña</p>
              </div>

              {invalidLink && !exito && (
                <p className={cardStyles.formErrorBanner}>
                  <AlertCircle size={14} />
                  Este enlace ya no es válido o expiró. Solicita uno nuevo desde &quot;Olvidé mi contraseña&quot;.
                </p>
              )}

              {exito && (
                <p className={cardStyles.formSuccessBanner}>
                  <CheckCircle2 size={16} />
                  Contraseña actualizada. Redirigiendo…
                </p>
              )}

              {!invalidLink && !exito && (
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {error && (
                    <p className={cardStyles.formErrorBanner}>
                      <AlertCircle size={14} />
                      {error}
                    </p>
                  )}
                  <div className={cardStyles.field}>
                    <label className={cardStyles.label}>Nueva contraseña</label>
                    <div className={cardStyles.inputWrap}>
                      <Lock size={15} className={cardStyles.inputIcon} />
                      <input
                        className={`${cardStyles.input} ${cardStyles.inputWithToggle}`}
                        type={showPass ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="mín. 6 caracteres"
                        autoFocus
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className={cardStyles.toggleBtn}
                        onClick={() => setShowPass((v) => !v)}
                        tabIndex={-1}
                      >
                        {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div className={cardStyles.field}>
                    <label className={cardStyles.label}>Confirmar contraseña</label>
                    <div className={cardStyles.inputWrap}>
                      <Lock size={15} className={cardStyles.inputIcon} />
                      <input
                        className={cardStyles.input}
                        type="password"
                        value={confirmar}
                        onChange={(e) => setConfirmar(e.target.value)}
                        placeholder="repetir"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <button type="submit" className={cardStyles.submitBtn} disabled={cargando || !ready}>
                    {cargando ? (
                      <>
                        <span className={cardStyles.spinner} />
                        Actualizando...
                      </>
                    ) : (
                      "CAMBIAR CONTRASEÑA"
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </LoginVidrio>
  );
}
