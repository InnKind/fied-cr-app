import { LOGOS } from "@/config/charla";

// Piezas comunes de la charla. La tipografía de texto (Nunito Sans) la pone
// src/app/charla/layout.tsx y se hereda; los títulos y las cifras usan SERIF.
export const SERIF: React.CSSProperties = {
  fontFamily: "var(--font-serif4), Georgia, 'Times New Roman', serif",
  fontStyle: "italic",
  fontWeight: 400,
};

// Logos de SénecaLab e InnKind lado a lado, como en la presentación.
// tone="blanco" solo sobre fondo oscuro; tone="azul" sobre fondo claro.
// `height` es el alto del logo de SénecaLab en px; el de InnKind va un poco más
// bajo para que las dos marcas se vean del mismo tamaño.
export function BrandLogos({
  height,
  tone = "blanco",
  className = "",
}: {
  height: number;
  tone?: "blanco" | "azul";
  className?: string;
}) {
  const s = tone === "blanco" ? LOGOS.senecalabBlanco : LOGOS.senecalabAzul;
  const k = tone === "blanco" ? LOGOS.innkindBlanco : LOGOS.innkindAzul;
  const hk = Math.round(height * 0.82);
  return (
    <div className={`flex items-center ${className}`} style={{ gap: Math.round(height * 0.5) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={s.src}
        alt={s.alt}
        width={Math.round((height * s.width) / s.height)}
        height={height}
        style={{ height, width: "auto" }}
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

// Rótulo en mayúsculas espaciadas (los «kickers» de las láminas).
export function Kicker({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <p className={`font-bold uppercase ${className}`} style={{ letterSpacing: "0.18em", ...style }}>
      {children}
    </p>
  );
}
