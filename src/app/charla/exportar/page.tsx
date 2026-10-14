"use client";

import { useState } from "react";
import { CONTACT, TALK_TITLE } from "@/config/charla";
import { BrandLogos, Kicker, SERIF } from "@/components/charla/CharlaUI";

// Descarga los CSV de la charla (para Jerónimo y Adriana). La clave se escribe
// aquí y viaja en el encabezado x-stand-key: nunca queda en la URL, en los
// registros de Vercel ni en el historial. No se guarda en el navegador.
// Las respuestas son anónimas (un número por participante). Solo el archivo de
// contactos trae nombres y correos, y no se puede unir con el de respuestas.

type Kind = "participantes" | "respuestas" | "contactos";

function filenameFrom(res: Response, fallback: string): string {
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = cd.match(/filename="([^"]+)"/);
  return m ? m[1] : fallback;
}

export default function CharlaExportar() {
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
      const res = await fetch(`/api/charla/export?type=${type}${semicolon ? "&sep=semicolon" : ""}`, {
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
      a.download = filenameFrom(res, `charla-${type}.csv`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMsg({ ok: true, text: `Listo: ${a.download}` });
    } catch {
      setMsg({
        ok: false,
        text: "No se pudo descargar. Hay que revisar la conexión y volver a intentarlo.",
      });
    } finally {
      clearTimeout(timer);
      setBusy(null);
    }
  }

  const btn = "w-full rounded-xl px-4 py-3.5 font-bold shadow disabled:opacity-50";

  return (
    <main className="min-h-dvh flex-1 bg-[#223c5d] text-white">
      <div className="mx-auto max-w-md px-5 pb-16 pt-6">
        <header>
          <BrandLogos height={28} tone="blanco" />
        </header>

        <Kicker className="mt-8 text-[11px] text-[#dce4ff]">{TALK_TITLE}</Kicker>
        <h1 className="mt-2 text-4xl leading-tight" style={SERIF}>
          Exportar la charla
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#dce4ff]">
          Las respuestas son anónimas: cada celular sale como un participante con un número, sin
          nombre ni correo. Solo el archivo de contactos trae datos personales, y no se puede unir
          con el de respuestas.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void download("participantes");
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">Clave</span>
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full rounded-xl border-0 bg-white px-4 py-3 text-base text-[#1e2a3a] outline-none ring-2 ring-transparent focus:ring-[#ff5800]"
            />
            <span className="mt-1.5 block text-xs text-[#dce4ff]">
              Es la misma clave con la que se controla la pantalla.
            </span>
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={semicolon}
              onChange={(e) => setSemicolon(e.target.checked)}
              className="h-5 w-5 accent-[#ff5800]"
            />
            Separar con punto y coma (Excel en español)
          </label>

          <h2 className="pt-2 text-lg font-bold">Respuestas (anónimas)</h2>
          <button
            type="submit"
            disabled={!key.trim() || !!busy}
            className={`${btn} bg-[#ff5800] text-white`}
          >
            {busy === "participantes" ? "Descargando…" : "Una fila por participante (CSV)"}
          </button>
          <button
            type="button"
            onClick={() => void download("respuestas")}
            disabled={!key.trim() || !!busy}
            className={`${btn} bg-white text-[#223c5d]`}
          >
            {busy === "respuestas" ? "Descargando…" : "Una fila por respuesta (CSV)"}
          </button>
          <p className="text-xs leading-relaxed text-[#dce4ff]">
            «Una fila por participante» trae una columna por pregunta (como la hoja de un
            formulario de Google). «Una fila por respuesta» es el mismo contenido en formato largo,
            para tablas dinámicas. El número de participante es el mismo en los dos y va en el orden
            en que cada celular empezó a responder.
          </p>

          <h2 className="pt-2 text-lg font-bold">Contactos (con datos personales)</h2>
          <button
            type="button"
            onClick={() => void download("contactos")}
            disabled={!key.trim() || !!busy}
            className={`${btn} border-2 border-white bg-transparent text-white`}
          >
            {busy === "contactos" ? "Descargando…" : "Contactos (CSV)"}
          </button>
          <p className="text-xs leading-relaxed text-[#dce4ff]">
            Una fila por persona que dejó sus datos al final: nombre, organización, cargo, correo y
            lo que marcó. Va en orden alfabético y sin hora, para que no se pueda emparejar con las
            respuestas. Se maneja con cuidado, no se comparte fuera del equipo y se usa solo para lo
            que cada persona marcó: «{CONTACT.consent}»
          </p>
        </form>

        {msg && (
          <p
            role="status"
            className={`mt-5 rounded-xl px-4 py-3 text-sm font-bold ${
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
