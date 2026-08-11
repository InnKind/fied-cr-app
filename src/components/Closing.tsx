"use client";

import { ATHENEA_URL } from "@/config/event";
import { BRAND_BG } from "@/lib/brand";

// Pantalla de cierre (fases ROUND1_COMPLETE y FINISHED). Muestra un mensaje y,
// según el caso, enlaces a Atenea y al archivo post-evento.
export default function Closing({
  title,
  message,
  accent,
  showAtenea = false,
  showArchive = false,
}: {
  title: string;
  message: string;
  accent?: string;
  showAtenea?: boolean;
  showArchive?: boolean;
}) {
  return (
    <main
      className="flex-1 flex items-center justify-center p-6"
      style={{ background: BRAND_BG }}
    >
      <div className="w-full max-w-sm text-center">
        {accent && (
          <span
            className="mb-4 inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: accent }}
          />
        )}
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="mt-3 text-white/80">{message}</p>

        {(showAtenea || showArchive) && (
          <div className="mt-8 space-y-3">
            {showArchive && (
              <a
                href="/archivo"
                className="block w-full rounded-lg bg-[#c8103e] px-4 py-3 font-semibold text-white shadow-sm hover:bg-[#a50d33] active:bg-[#8a0b2b]"
              >
                Ver lo que trabajó tu mesa
              </a>
            )}
            {showAtenea && (
              <a
                href={ATHENEA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 shadow-sm hover:border-[#0c7d75] hover:bg-[#0c7d75]/5"
              >
                Explorar con Atenea ↗
              </a>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
