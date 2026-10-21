"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { GlassCard } from "@/components/glass/glass-card";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/components/providers/profile-provider";

/**
 * "Mis datos": la persona edita su nombre (cómo la llama la mascota), su contacto y su contraseña. Todo pasa por la sesión
 * propia (RLS + Supabase Auth): nunca toca la cuenta de otra persona. La policy de `profiles` deja cambiar estos campos y
 * protege los administrativos (rol, bloqueo, vencimiento, pago).
 */
const MIN_PASSWORD = 8;
const inputCls = "flex-1 bg-transparent outline-none text-[16px] font-semibold text-white min-w-0";
const boxCls = "flex items-center rounded-2xl px-3 min-h-[46px] bg-white/[0.06] border border-white/10";

function Eye_({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Ocultar contraseña" : "Mostrar contraseña"}
      aria-pressed={shown}
      className="ml-2 p-1.5 rounded-lg text-white/60 hover:text-white cursor-pointer shrink-0"
    >
      {shown ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  );
}

export default function CuentaPage() {
  const profile = useProfile();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [savingData, setSavingData] = useState(false);
  const [dataMsg, setDataMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!profile?.id) return;
    let cancelled = false;
    void createClient()
      .from("profiles")
      .select("display_name, phone")
      .eq("id", profile.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setName((data?.display_name as string | null) ?? "");
        setPhone((data?.phone as string | null) ?? "");
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  const nameOk = name.trim().length >= 2 && name.trim().length <= 30;

  async function saveData() {
    if (!profile?.id || !nameOk) return;
    setSavingData(true);
    setDataMsg(null);
    const { error } = await createClient()
      .from("profiles")
      .update({ display_name: name.trim(), phone: phone.trim() || null })
      .eq("id", profile.id);
    setDataMsg(error ? { ok: false, text: `No se pudo guardar: ${error.message}` } : { ok: true, text: "Datos guardados." });
    setSavingData(false);
  }

  const pwOk = password.length >= MIN_PASSWORD && password === confirm;

  async function savePassword() {
    if (!pwOk) return;
    setSavingPw(true);
    setPwMsg(null);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) setPwMsg({ ok: false, text: `No se pudo cambiar la contraseña: ${error.message}` });
    else {
      setPwMsg({ ok: true, text: "Contraseña actualizada." });
      setPassword("");
      setConfirm("");
    }
    setSavingPw(false);
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-4 px-4 py-6">
      <Link href="/mis-modulos" className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white w-fit">
        <ArrowLeft size={16} /> Volver
      </Link>
      <h1 className="text-xl font-extrabold text-white">Mis datos</h1>

      <GlassCard padding="lg" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-white">Perfil</h2>
        <label className="flex flex-col gap-1.5 text-xs text-white/50">
          Cómo te llamo
          <span className={boxCls}>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="Tu nombre" className={inputCls} disabled={!loaded} />
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-white/50">
          WhatsApp o contacto (opcional)
          <span className={boxCls}>
            <input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} placeholder="+591 …" className={inputCls} disabled={!loaded} />
          </span>
        </label>
        {dataMsg && (
          <p className={`text-xs ${dataMsg.ok ? "text-emerald-300" : "text-[#ff9a9d]"}`} role="status">
            {dataMsg.text}
          </p>
        )}
        <button
          type="button"
          onClick={saveData}
          disabled={!loaded || !nameOk || savingData}
          className="rounded-full px-4 py-2 text-sm font-semibold bg-white text-black disabled:opacity-40 cursor-pointer w-fit"
        >
          {savingData ? "Guardando…" : "Guardar datos"}
        </button>
      </GlassCard>

      <GlassCard padding="lg" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-white">Contraseña</h2>
        <label className="flex flex-col gap-1.5 text-xs text-white/50">
          Nueva contraseña (mínimo {MIN_PASSWORD} caracteres)
          <span className={boxCls}>
            <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={inputCls} />
            <Eye_ shown={show} onToggle={() => setShow((v) => !v)} />
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-white/50">
          Repetila
          <span className={boxCls}>
            <input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={inputCls} />
            <Eye_ shown={show} onToggle={() => setShow((v) => !v)} />
          </span>
        </label>
        {confirm && password !== confirm && <p className="text-xs text-[#ff9a9d]">No coinciden.</p>}
        {pwMsg && (
          <p className={`text-xs ${pwMsg.ok ? "text-emerald-300" : "text-[#ff9a9d]"}`} role="status">
            {pwMsg.text}
          </p>
        )}
        <button
          type="button"
          onClick={savePassword}
          disabled={!pwOk || savingPw}
          className="rounded-full px-4 py-2 text-sm font-semibold bg-white text-black disabled:opacity-40 cursor-pointer w-fit"
        >
          {savingPw ? "Guardando…" : "Cambiar contraseña"}
        </button>
      </GlassCard>
    </div>
  );
}
