import { Fragment } from "react";
import { BRAND_TEXT } from "@/config/stand";

// Marcador de contenido pendiente: [PEDIR: …] o [APROBAR: …] en amarillo.
export function Chip({ kind, text }: { kind: string; text: string }) {
  return (
    <span className="mx-[0.1em] inline-block rounded-[0.35em] border-2 border-[#a16207] bg-[#fde047] px-[0.45em] py-[0.05em] align-baseline text-[0.85em] font-semibold leading-snug text-[#3a2c00]">
      {kind}: {text}
    </span>
  );
}

const TOKEN = /(\*\*[^*]+\*\*|\[(?:PEDIR|APROBAR):[^\]]*\])/g;

// Texto con **negrita** y marcadores [PEDIR: …] / [APROBAR: …].
export function Rich({ text }: { text: string }) {
  const parts = text.split(TOKEN);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
          return (
            <strong key={i} className="font-bold">
              {p.slice(2, -2)}
            </strong>
          );
        }
        const m = p.match(/^\[(PEDIR|APROBAR):\s*([^\]]*)\]$/);
        if (m) return <Chip key={i} kind={m[1]} text={m[2]} />;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

export function plain(text: string): string {
  return text.replace(/\*\*/g, "");
}

// Marca en texto: «SenecaLab · InnKind».
export function BrandMark({ className = "" }: { className?: string }) {
  const [a, b] = BRAND_TEXT.split(" · ");
  return (
    <span className={`font-bold tracking-tight text-white ${className}`}>
      {a}
      <span className="mx-[0.3em] text-[#c9283f]">·</span>
      {b}
    </span>
  );
}
