"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Mascot } from "@/components/agente/mascot";
import { BORDER, Btn, DarkCard } from "@/components/agente/ui";
import { createClient } from "@/lib/supabase/client";

/**
 * Formulario inicial MÍNIMO de una cuenta nueva (antes de ver el pago o cualquier módulo): solo lo que el administrador y la
 * mascota necesitan de entrada — cómo te llamás (la mascota te va a llamar así), una contraseña propia y, opcional, un contacto.
 * Nada de datos de salud acá: los formularios de cada módulo (metas de Calorías, perfil de Entrenamiento…) se piden la primera
 * vez que entrás a ESE módulo (ver `FirstUseForms`), no se duplican acá.
 *
 * La contraseña se guarda en Supabase Auth con `updateUser`: la cuenta de Google puede entrar después también con su email y esa
 * contraseña (la pantalla de login ya tiene ese camino).
 */
const MIN_PASSWORD = 8;

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-extrabold text-white/60 uppercase tracking-wide">{label}</span>
      <div className="flex items-center rounded-2xl px-3 min-h-[48px]" style={{ background: "#2b2b2e", border: BORDER }}>
        {children}
      </div>
      {hint && !error && <span className="text-xs text-white/40">{hint}</span>}
      {error && <span className="text-xs text-[#ff9a9d]">{error}</span>}
    </label>
  );
}

/** "Ojito" para ver u ocultar lo que se escribe en los campos de contraseña. */
function EyeButton({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Ocultar contraseña" : "Mostrar contraseña"}
      aria-pressed={shown}
      className="ml-2 p-1.5 rounded-lg text-white/60 hover:text-white cursor-pointer shrink-0"
    >
      {shown ? <EyeOff size={20} /> : <Eye size={20} />}
    </button>
  );
}

const inputCls ="flex-1 bg-transparent outline-none text-[17px] font-bold min-w-0";

export function OnboardingWizard({ userId, name }: { userId: string; name: string | null }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState((name ?? "").split(" ")[0] ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOk = displayName.trim().length >= 2 && displayName.trim().length <= 30;
  const passwordOk = password.length >= MIN_PASSWORD;
  const confirmOk = confirm === password;
  const canSubmit = nameOk && passwordOk && confirmOk && !saving;

  async function finish() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { error: pwError } = await supabase.auth.updateUser({ password });
    if (pwError) {
      setError(`No se pudo guardar la contraseña: ${pwError.message}`);
      setSaving(false);
      return;
    }

    const base = { onboarding_done: true };
    const full = { ...base, display_name: displayName.trim(), phone: phone.trim() || null };
    let { error: profileError } = await supabase.from("profiles").update(full).eq("id", userId);
    // Sin la migración 0021 no existen display_name/phone: se guarda al menos lo esencial para no trabar a la persona.
    if (profileError && /display_name|phone/i.test(profileError.message)) {
      ({ error: profileError } = await supabase.from("profiles").update(base).eq("id", userId));
    }
    if (profileError) {
      setError(`No se pudo guardar tu perfil: ${profileError.message}`);
      setSaving(false);
      return;
    }
    try {
      localStorage.setItem(`vt_onboarding_done_${userId}`, "1");
    } catch {
      /* sin almacenamiento local: el flag de la base de datos alcanza */
    }
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="min-h-dvh w-full bg-black text-white flex flex-col items-center px-4 py-6 gap-5">
      <div className="w-full max-w-[460px] flex items-center gap-3">
        <Mascot mood="happy" size={72} />
        <div>
          <h1 className="text-xl font-extrabold leading-tight">¡Bienvenido a Vida Total!</h1>
          <p className="text-sm text-white/55">Dos datos y una contraseña, y listo.</p>
        </div>
      </div>

      <DarkCard className="w-full max-w-[460px] flex flex-col gap-4">
        <Field label="¿Cómo te llamo?" hint="Así te va a llamar la mascota." error={displayName && !nameOk ? "Entre 2 y 30 caracteres." : null}>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} aria-label="Cómo te llamo" placeholder="Tu nombre" maxLength={30} autoComplete="given-name" className={inputCls} />
        </Field>

        <Field
          label="Contraseña"
          hint={`Mínimo ${MIN_PASSWORD} caracteres. Con ella también podés entrar con tu email, sin Google.`}
          error={password && !passwordOk ? `Mínimo ${MIN_PASSWORD} caracteres.` : null}
        >
          <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Contraseña" autoComplete="new-password" className={inputCls} />
          <EyeButton shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
        </Field>

        <Field label="Repetí la contraseña" error={confirm && !confirmOk ? "No coincide." : null}>
          <input type={showPassword ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Repetí la contraseña" autoComplete="new-password" className={inputCls} />
          <EyeButton shown={showPassword} onToggle={() => setShowPassword((v) => !v)} />
        </Field>

        <Field label="WhatsApp o contacto (opcional)" hint="Solo lo ve el administrador, por si hay que avisarte algo de tu suscripción.">
          <input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Contacto" placeholder="+591 …" maxLength={30} autoComplete="tel" className={inputCls} />
        </Field>

        {error && <p className="text-sm text-[#ff9a9d]" role="alert">{error}</p>}

        <Btn variant="light" disabled={!canSubmit} onClick={finish}>
          {saving ? "Guardando…" : "Continuar"}
        </Btn>
      </DarkCard>
      <p className="text-xs text-white/35 max-w-[420px] text-center">Tus metas de calorías y tu perfil de entrenamiento te los pedimos la primera vez que entres a cada módulo.</p>
    </div>
  );
}
