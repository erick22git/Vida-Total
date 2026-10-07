"use client";

import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";

interface Status {
  linked: boolean;
  username?: string | null;
  botUsername: string | null;
  configured: boolean;
}

/** Vincular / desvincular Telegram. Solo desde la app (es de la lista «nunca automático»). */
export function TelegramLinkCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [code, setCode] = useState<{ code: string; botUsername: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram/link");
      if (res.ok) setStatus((await res.json()) as Status);
    } catch {
      /* sin conexión */
    }
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);

  // Mientras hay un código a la vista, revisa si ya se vinculó.
  const showCode = code && !status?.linked ? code : null;
  useEffect(() => {
    if (!showCode) return;
    const t = setInterval(() => void refresh(), 4000);
    return () => clearInterval(t);
  }, [showCode, refresh]);

  const link = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const json = (await res.json()) as { code?: string; botUsername?: string | null; error?: string };
      if (json.code) setCode({ code: json.code, botUsername: json.botUsername ?? status?.botUsername ?? null });
      else setMsg(json.error === "not_configured" ? "El bot todavía no está configurado en el servidor (ver docs/telegram.md)." : json.error === "already_linked" ? "Ya hay un Telegram vinculado." : "No pude generar el código.");
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (!window.confirm("¿Desvincular Telegram? El bot dejará de responderte.")) return;
    setBusy(true);
    try {
      await fetch("/api/telegram/link", { method: "DELETE" });
      setCode(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white/[0.04] p-3 flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <Send size={15} className="text-sky-300" />
        <p className="text-sm font-medium">Telegram</p>
        <span className={`ml-auto text-[11px] rounded-full px-2 py-0.5 ${status?.linked ? "bg-emerald-500/25 text-emerald-100" : "bg-white/10 text-white/55"}`}>
          {status?.linked ? `Vinculado${status.username ? ` · @${status.username}` : ""}` : "Sin vincular"}
        </span>
      </div>
      {status && !status.configured && <p className="text-xs text-amber-200/80">El bot aún no está configurado en el servidor (TELEGRAM_BOT_TOKEN). Mira docs/telegram.md.</p>}
      {status?.linked ? (
        <button onClick={unlink} disabled={busy} className="rounded-xl bg-red-500/15 text-red-200 text-sm py-2.5 cursor-pointer disabled:opacity-40">
          Desvincular Telegram
        </button>
      ) : showCode ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-white/60">Tu código (vale 10 minutos y sirve una sola vez):</p>
          <p className="text-2xl font-mono tracking-[0.3em] text-center py-1 select-all">{showCode.code}</p>
          {showCode.botUsername && (
            <a href={`https://t.me/${showCode.botUsername}?start=${showCode.code}`} target="_blank" rel="noreferrer" className="rounded-xl bg-sky-500 text-black text-sm font-medium py-2.5 text-center">
              Abrir @{showCode.botUsername} en Telegram
            </a>
          )}
          <p className="text-[11px] text-white/45">O escríbele al bot: <b>/start {showCode.code}</b></p>
        </div>
      ) : (
        <button onClick={link} disabled={busy || (status ? !status.configured : true)} className="rounded-xl bg-sky-500/90 text-black text-sm font-medium py-2.5 cursor-pointer disabled:opacity-40">
          Vincular Telegram
        </button>
      )}
      {msg && <p className="text-xs text-amber-200">{msg}</p>}
    </div>
  );
}
