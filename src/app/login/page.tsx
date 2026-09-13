"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { LoginVidrio } from "@/components/auth/login-vidrio";
import { AuthCard } from "@/components/auth/auth-card";
import { createClient } from "@/lib/supabase/client";
import styles from "@/components/auth/auth-card.module.css";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12
        c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24
        c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
      />
      <path
        fill="#FF3D00"
        d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657
        C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36
        c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
      />
      <path
        fill="#1976D2"
        d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002
        l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
      />
    </svg>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "No pudimos completar el inicio de sesión. Intenta de nuevo.",
  no_code: "El proveedor no devolvió un código de autorización válido.",
  exchange_failed: "Hubo un problema al validar tu sesión con Google. Intenta de nuevo.",
};

function LoginError() {
  const params = useSearchParams();
  const error = params.get("error");
  if (!error) return null;
  const message = ERROR_MESSAGES[error] ?? "Ocurrió un error inesperado. Intenta de nuevo.";
  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 mt-4">
      {message}
    </div>
  );
}

function GoogleButton() {
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setLoading(false);
      console.error("Error al iniciar sesión con Google:", error.message);
    }
    // Si no hay error, el navegador es redirigido a Google — no hace falta
    // apagar `loading`, la página se va a desmontar.
  }

  return (
    <div className={styles.googleWrap}>
      <div className={styles.dividerRow}>
        <span className={styles.dividerLine} />
        o continúa con
        <span className={styles.dividerLine} />
      </div>
      <motion.button
        type="button"
        whileHover={{ scale: 1.03, filter: "brightness(1.04)" }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        disabled={loading}
        onClick={handleGoogleLogin}
        className="w-full min-h-[48px] rounded-2xl bg-white text-[#1f1f1f] font-medium text-sm md:text-base px-7 py-3.5 inline-flex items-center justify-center gap-3 shadow-[0_4px_20px_rgba(0,0,0,0.25)] border border-white/20 cursor-pointer transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <GoogleIcon />
        {loading ? "Redirigiendo…" : "Continuar con Google"}
      </motion.button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <LoginVidrio>
      <div className="w-full h-full flex flex-col items-center justify-center px-4 py-8 overflow-y-auto gap-2">
        <AuthCard />
        <Suspense fallback={null}>
          <LoginError />
        </Suspense>
        <GoogleButton />
      </div>
    </LoginVidrio>
  );
}
