"use client";

import { useState } from "react";
import { BrandMark } from "@/components/stand/StandUI";

// Descarga los CSV del stand (para Jerónimo). La clave se escribe aquí y viaja
// en el encabezado x-stand-key: nunca queda en la URL, en los registros de
// Vercel ni en el historial. No se guarda en el navegador.

type Kind = "contacts" | "responses";

function filenameFrom(res: Response, fallback: string): string {
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = cd.match(/filename="([^"]+)"/);
  return m ? m[1] : fallback;
}

export default function StandExportar() {
  const [key, setKey] = useState("");
  const [semicolon, setSemicolon] = useState(false);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function download(type: Kind) {
    if (!key.trim() || busy) return;
    setBusy(type);
    setMsg(null);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(`/api/stand/export?type=${type}${semicolon ? "&sep=semicolon" : ""}`, {
        headers: { "x-stand-key": key.trim() },
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) {
        setMsg({ ok: false, text: (await res.text().catch(() => "")) || `Error ${res.status}` });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFrom(res, `stand-${type}.csv`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMsg({ ok: true, text: `Listo: ${a.download}` });
    } catch {
      setMsg({ ok: false, text: "No se pudo descargar. Revisa la conexión y vuelve a intentarlo." });
    } finally {
      clearTimeout(timer);
      setBusy(null);
    }
  }

  const btn =
    "w-full rounded-xl px-4 py-3.5 font-semibold shadow disabled:opacity-50";

  return (
    <main className="min-h-dvh flex-1 bg-[#223c5d] text-white">
      <div className="mx-auto max-w-md px-5 pb-16 pt-6">
        <header className="flex items-center justify-between gap-3">
          <BrandMark className="text-lg" />
          <span className="text-xs font-medium text-white/60">GET Forum 2026</span>
        </header>
        <h1 className="mt-8 text-2xl font-bold">Exportar el stand</h1>
        <p className="mt-2 text-sm text-white/75">
          Descarga los CSV para la base maestra. Los contactos traen el código de evento y la
          columna «uso_autorizado»: usa cada contacto solo para lo que marcó.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void download("contacts");
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Clave del stand</span>
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full rounded-xl border-0 bg-white px-4 py-3 text-base text-slate-900 outline-none ring-2 ring-transparent focus:ring-[#c9283f]"
            />
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={semicolon}
              onChange={(e) => setSemicolon(e.target.checked)}
              className="h-5 w-5 accent-[#c9283f]"
            />
            Separar con punto y coma (Excel en español)
          </label>
          <button
            type="submit"
            disabled={!key.trim() || !!busy}
            className={`${btn} bg-[#c9283f] text-white`}
          >
            {busy === "contacts" ? "Descargando…" : "Contactos de las Tres puertas (CSV)"}
          </button>
          <button
            type="button"
            onClick={() => void download("responses")}
            disabled={!key.trim() || !!busy}
            className={`${btn} bg-white text-[#223c5d]`}
          >
            {busy === "responses" ? "Descargando…" : "Respuestas anónimas (CSV)"}
          </button>
        </form>

        {msg && (
          <p
            className={`mt-5 rounded-xl px-4 py-3 text-sm font-semibold ${
              msg.ok ? "bg-white/10 text-white" : "bg-[#fff1f3] text-[#9f1239]"
            }`}
          >
            {msg.text}
          </p>
        )}
      </div>
    </main>
  );
}
