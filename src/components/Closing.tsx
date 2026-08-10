"use client";

import { ATHENEA_URL } from "@/config/event";

// Pantalla de cierre (fases ROUND1_COMPLETE y FINISHED). Muestra un mensaje y,
// según el caso, enlaces a Athenea y al archivo post-evento.
export default function Closing({
  title,
  message,
  accent,
  showAthenea = false,
  showArchive = false,
}: {
  title: string;
  message: string;
  accent?: string;
  showAthenea?: boolean;
  showArchive?: boolean;
}) {
  return (
    <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-sm text-center">
        {accent && (
          <span
            className="mb-4 inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: accent }}
          />
        )}
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-3 text-slate-600">{message}</p>

        {(showAthenea || showArchive) && (
          <div className="mt-8 space-y-3">
            {showArchive && (
              <a
                href="/archivo"
                className="block w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white shadow-sm hover:bg-blue-800"
              >
                Ver lo que trabajó tu mesa
              </a>
            )}
            {showAthenea && (
              <a
                href={ATHENEA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 shadow-sm hover:border-blue-400 hover:bg-blue-50"
              >
                Explorar con Athenea ↗
              </a>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
