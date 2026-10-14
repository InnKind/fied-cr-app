import type { CharlaError } from "@/lib/charla";

// Piezas comunes del celular de la charla. Los colores son los de `C` en
// src/config/charla.ts (Tailwind necesita las clases escritas tal cual):
// azul #223C5D, naranja #FF5800, azul claro #DCE4FF, crema #F6F3EE.
// Todo lo que se toca mide al menos 48 px y los campos usan 17 px (con menos
// de 16 px el iPhone hace zoom al escribir).
export const BTN_PRIMARY =
  "block min-h-[52px] w-full rounded-xl bg-[#FF5800] px-4 py-3.5 text-center text-lg font-bold text-white shadow-lg transition active:scale-[0.99] disabled:opacity-50";
export const BTN_SECONDARY =
  "block min-h-[52px] w-full rounded-xl px-4 py-3.5 text-center text-[17px] font-bold text-white ring-1 ring-inset ring-white/50 transition active:bg-white/10 disabled:opacity-50";
export const INPUT =
  "block w-full rounded-xl border-0 bg-white px-4 py-3.5 text-[17px] leading-snug text-[#223C5D] outline-none ring-2 ring-transparent placeholder:text-[#55657A]/70 focus:ring-[#FF5800] disabled:opacity-70";
// Avisos cortos sobre el fondo azul (máximo de opciones, campo mal escrito).
export const HINT = "text-sm font-bold text-[#FFD2BD]";

export function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

// Si no se guarda, la persona repite la acción de esa pantalla (vuelve a tocar
// su respuesta o «Enviar»). `text` dice cómo reintentar. Si fue la
// base la que rechazó el envío, se dice el motivo en vez de culpar a la conexión.
export function ErrorBox({ error, text }: { error: CharlaError; text: string }) {
  return (
    <div role="alert" className="rounded-xl bg-[#FFF1EA] px-4 py-3 text-sm text-[#8A2A00]">
      <p className="font-bold">
        {error.kind === "missing"
          ? "No se pudo guardar: la sesión todavía no está activada."
          : error.rejected
            ? error.message
            : text}
      </p>
      {error.detail && !error.rejected && <p className="mt-1 text-xs opacity-70">{error.detail}</p>}
    </div>
  );
}
