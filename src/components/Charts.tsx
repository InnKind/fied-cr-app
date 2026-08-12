// Gráficos simples, sin librerías externas (puro CSS/SVG) para que sean
// livianos y confiables al proyectar. Consistentes con la estética de marca.

export type BarDatum = {
  label: string;
  value: number;
  color?: string;
};

// Barras horizontales con etiqueta y valor. Pensadas para ir dentro de una
// tarjeta blanca (barras teal sobre fondo claro). `big` = versión para proyectar.
export function HBars({
  data,
  color = "#0c7d75",
  big = false,
  valueSuffix = "",
  singularSuffix,
}: {
  data: BarDatum[];
  color?: string;
  big?: boolean;
  valueSuffix?: string;
  // Sufijo alternativo cuando el valor es 1 (p. ej. "mesa" en vez de "mesas").
  singularSuffix?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400">Sin datos.</p>;
  }
  // Sanea valores: si alguno viene undefined/NaN (p. ej. un dato mal formado de
  // la IA), lo trata como 0 para no romper TODO el gráfico con un max=NaN.
  const safe = (v: number) => (Number.isFinite(v) ? v : 0);
  const max = Math.max(...data.map((d) => safe(d.value)), 1);
  return (
    <ul className={big ? "space-y-3" : "space-y-2.5"}>
      {data.map((d, i) => (
        <li key={i}>
          <div className="flex items-baseline justify-between gap-3">
            <span
              className={`font-medium text-slate-800 ${big ? "text-lg" : "text-sm"}`}
            >
              {d.label}
            </span>
            <span
              className={`shrink-0 font-bold tabular-nums ${big ? "text-lg" : "text-sm"}`}
              style={{ color: d.color ?? color }}
            >
              {safe(d.value)}
              {safe(d.value) === 1 && singularSuffix !== undefined
                ? singularSuffix
                : valueSuffix}
            </span>
          </div>
          <div
            className={`mt-1 w-full overflow-hidden rounded-full bg-slate-100 ${
              big ? "h-3" : "h-2"
            }`}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(0, Math.min(100, (safe(d.value) / max) * 100))}%`,
                background: d.color ?? color,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
