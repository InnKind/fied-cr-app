import { BRAND_BG } from "@/lib/brand";
import BrandLogo from "@/components/BrandLogo";

// Pantalla de espera genérica: se muestra entre pasos, mientras el
// administrador avanza el ejercicio para todo el salón.
export default function Waiting({
  title,
  message,
  accent,
}: {
  title: string;
  message: string;
  accent?: string;
}) {
  return (
    <main
      className="flex-1 flex items-center justify-center p-6"
      style={{ background: BRAND_BG }}
    >
      <div className="w-full max-w-md text-center">
        <BrandLogo className="mx-auto mb-6" />
        {accent && (
          <span
            className="inline-block h-3 w-3 rounded-full mb-4"
            style={{ backgroundColor: accent }}
          />
        )}
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-3 text-white/80">{message}</p>
        <div className="mt-8 flex justify-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-teal-300 animate-bounce [animation-delay:-0.2s]" />
          <span className="h-2 w-2 rounded-full bg-teal-300 animate-bounce [animation-delay:-0.1s]" />
          <span className="h-2 w-2 rounded-full bg-teal-300 animate-bounce" />
        </div>
      </div>
    </main>
  );
}
