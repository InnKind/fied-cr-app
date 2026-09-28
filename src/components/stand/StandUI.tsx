import { Fragment } from "react";
import { BRAND_TEXT, LOGOS } from "@/config/stand";

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

// Logos de las dos marcas, lado a lado. Son blancos: SOLO sobre fondo oscuro.
// `height` es el alto de la imagen de SénecaLab en px. Su PNG trae un margen
// transparente (17% a cada lado): se compensa con márgenes negativos para que el
// logo quede alineado con el texto, y el de InnKind se achica para que las dos
// marcas se vean del mismo alto.
export function BrandLogos({ height, className = "" }: { height: number; className?: string }) {
  const s = LOGOS.senecalab;
  const k = LOGOS.innkind;
  const hk = Math.round(height * 0.75);
  const pad = Math.round(height * 0.174);
  return (
    <div className={`flex items-center ${className}`} style={{ gap: Math.round(height * 0.36) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={s.src}
        alt={s.alt}
        width={Math.round((height * s.width) / s.height)}
        height={height}
        style={{ height, width: "auto", marginLeft: -pad, marginRight: -pad }}
      />
      <span
        aria-hidden
        className="shrink-0 rounded-full bg-white/30"
        style={{ width: 3, height: Math.round(height * 0.8) }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={k.src}
        alt={k.alt}
        width={Math.round((hk * k.width) / k.height)}
        height={hk}
        style={{ height: hk, width: "auto" }}
      />
    </div>
  );
}

// Marca en texto: «SénecaLab · InnKind».
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
