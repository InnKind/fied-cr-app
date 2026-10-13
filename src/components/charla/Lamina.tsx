"use client";

import { useLayoutEffect, useRef } from "react";
import laminasJson from "@/config/charla-laminas.json";

// Dibuja una lámina de la presentación tal como está en el .pptx: mismas
// posiciones, colores, tamaños y tipografías, sobre un lienzo de 1920 x 1080.
// Los datos salen de src/config/charla-laminas.json, que genera
// herramientas/pptx_a_laminas.py (carpeta de entregables) a partir del .pptx.
// Para cambiar un texto: se cambia en el PowerPoint y se vuelve a convertir.

type Run = {
  t: string;
  sz?: number;
  b?: boolean;
  i?: boolean;
  u?: boolean;
  ls?: number;
  c?: string;
  f?: "serif" | "sans";
};
type Para = {
  runs: Run[];
  align?: "ctr" | "r";
  lh?: number; // interlineado exacto (px)
  lhPct?: number; // interlineado proporcional
  before?: number;
  num?: boolean; // lista numerada
  ml?: number;
  sz?: number; // tamaño de un párrafo vacío
};
type TextBody = {
  paras: Para[];
  ins?: number[]; // márgenes internos: izq, arriba, der, abajo
  anchor?: "ctr" | "b";
  nowrap?: boolean;
  fit?: boolean; // PowerPoint achica el texto si no cabe
};
export type LaminaItem = {
  k: "box" | "img" | "line";
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  grad?: { ang: number; stops: [string, number][] };
  stroke?: string;
  sw?: number;
  dash?: boolean;
  r?: number;
  path?: string;
  text?: TextBody;
  role?: "qr";
  src?: string;
  alt?: string;
};
export type LaminaScene = { n: number; bg: string; items: LaminaItem[] };

const DATA = laminasJson as unknown as { w: number; h: number; laminas: LaminaScene[] };
export const LAMINA_W = DATA.w;
export const LAMINA_H = DATA.h;

export function laminaScene(n: number): LaminaScene | null {
  return DATA.laminas.find((l) => l.n === n) ?? null;
}

// El cuadro blanco de una lámina de participación donde va el código QR.
export function qrBox(n: number): LaminaItem | null {
  return laminaScene(n)?.items.find((i) => i.role === "qr") ?? null;
}

// ¿La lámina tiene fondo oscuro? (para elegir el color de lo que se le superpone)
export function isDark(n: number): boolean {
  const bg = laminaScene(n)?.bg ?? "#FFFFFF";
  const v = parseInt(bg.slice(1), 16);
  const lum = 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255);
  return lum < 140;
}

const SERIF_FAMILY = "var(--font-serif4), Georgia, 'Times New Roman', serif";
const SANS_FAMILY = "var(--font-nunito), system-ui, -apple-system, sans-serif";
const MIN_K = 0.6; // lo más que se achica un texto que no cabe
const FIT_TOLERANCE = 4; // px que puede sobresalir sin achicar

function TextLayer({ t, w, h, edge = 0 }: { t: TextBody; w: number; h: number; edge?: number }) {
  const inner = useRef<HTMLDivElement>(null);
  // `edge`: grosor del borde del cuadro, que aquí se dibuja por dentro; se suma
  // a los márgenes para que el texto no lo pise.
  const ins = (t.ins ?? [0, 0, 0, 0]).map((v) => v + edge);
  const avail = h - ins[1] - ins[3];
  const availW = w - ins[0] - ins[2];
  const fit = !!t.fit && avail > 0 && availW > 0;
  const nowrap = !!t.nowrap;

  // Igual que PowerPoint: si el texto no cabe en su cuadro, se achica hasta
  // que quepa. Se hace sobre el elemento (variable --k), sin volver a pintar.
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    let on = true;
    const fitNow = () => {
      if (!on) return;
      let k = 1;
      el.style.setProperty("--k", "1");
      if (!fit) return;
      // Texto en una sola línea: lo que no puede pasar es salirse a lo ancho
      // (con la tipografía real, una cifra grande puede pisar lo de al lado).
      const over = () =>
        nowrap ? el.scrollWidth > availW + FIT_TOLERANCE : el.offsetHeight > avail + FIT_TOLERANCE;
      for (let i = 0; i < 12 && over() && k > MIN_K; i++) {
        k = Math.max(MIN_K, k * 0.95);
        el.style.setProperty("--k", k.toFixed(3));
      }
    };
    fitNow();
    // Las tipografías llegan un instante después: se vuelve a medir.
    if (typeof document !== "undefined" && document.fonts?.ready) {
      void document.fonts.ready.then(fitNow);
    }
    return () => {
      on = false;
    };
  }, [fit, nowrap, avail, availW, t]);

  // Número de cada párrafo de lista numerada (0 si no es de lista).
  const nums = t.paras.map((p, i) => (p.num ? t.paras.slice(0, i + 1).filter((x) => x.num).length : 0));
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        padding: `${ins[1]}px ${ins[2]}px ${ins[3]}px ${ins[0]}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: t.anchor === "ctr" ? "center" : t.anchor === "b" ? "flex-end" : "flex-start",
        whiteSpace: t.nowrap ? "nowrap" : "normal",
      }}
    >
      <div ref={inner} style={{ flexShrink: 0 }}>
        {t.paras.map((p, pi) => {
          const first = p.runs[0];
          const size = first?.sz ?? p.sz ?? 36;
          const lineHeight = p.lh
            ? `calc(${p.lh}px * var(--k, 1))`
            : `calc(${(p.lhPct ?? 1.2) * size}px * var(--k, 1))`;
          return (
            <p
              key={pi}
              style={{
                margin: 0,
                marginTop: p.before,
                textAlign: p.align === "ctr" ? "center" : p.align === "r" ? "right" : "left",
                // El párrafo lleva el tamaño y la tipografía de su texto: si
                // heredara los 16 px de la página, cada línea mediría más que
                // su interlineado y el ajuste achicaría textos que sí caben.
                fontSize: `calc(${size}px * var(--k, 1))`,
                fontFamily: first?.f === "serif" ? SERIF_FAMILY : SANS_FAMILY,
                fontStyle: first?.i ? "italic" : "normal",
                lineHeight,
                minHeight: p.runs.length ? undefined : lineHeight,
                paddingLeft: p.num ? p.ml : undefined,
                textIndent: p.num && p.ml ? -p.ml : undefined,
              }}
            >
              {p.num && (
                <span
                  style={{
                    display: "inline-block",
                    width: p.ml,
                    textIndent: 0,
                    fontSize: `calc(${size}px * var(--k, 1))`,
                    color: first?.c,
                    fontWeight: first?.b ? 700 : 400,
                  }}
                >
                  {nums[pi]}.
                </span>
              )}
              {p.runs.map((r, ri) => (
                <span
                  key={ri}
                  style={{
                    fontSize: `calc(${r.sz ?? size}px * var(--k, 1))`,
                    fontFamily: r.f === "serif" ? SERIF_FAMILY : SANS_FAMILY,
                    fontWeight: r.b ? 700 : 400,
                    fontStyle: r.i ? "italic" : "normal",
                    textDecoration: r.u ? "underline" : undefined,
                    letterSpacing: r.ls ? `${r.ls}px` : undefined,
                    color: r.c,
                  }}
                >
                  {r.t}
                </span>
              ))}
            </p>
          );
        })}
      </div>
    </div>
  );
}

function background(it: LaminaItem): string | undefined {
  if (it.grad) {
    return `linear-gradient(${it.grad.ang}deg, ${it.grad.stops.map(([c, p]) => `${c} ${p}%`).join(", ")})`;
  }
  return it.fill;
}

function Item({ it, qr }: { it: LaminaItem; qr?: React.ReactNode }) {
  const pos: React.CSSProperties = { position: "absolute", left: it.x, top: it.y, width: it.w, height: it.h };

  if (it.k === "img") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={it.src} alt={it.alt ?? ""} style={pos} />;
  }

  if (it.k === "line") {
    const sw = it.sw ?? 2;
    const vertical = it.w < it.h;
    return (
      <div
        style={{
          position: "absolute",
          left: vertical ? it.x - sw / 2 : it.x,
          top: vertical ? it.y : it.y - sw / 2,
          width: vertical ? sw : it.w,
          height: vertical ? it.h : sw,
          background: it.stroke,
        }}
      />
    );
  }

  return (
    <div style={pos}>
      {it.path ? (
        <svg
          width={it.w}
          height={it.h}
          viewBox={`0 0 ${it.w} ${it.h}`}
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
          aria-hidden
        >
          <path d={it.path} fill={it.fill ?? "none"} stroke={it.stroke} strokeWidth={it.stroke ? it.sw : undefined} />
        </svg>
      ) : (
        (it.fill || it.grad || it.stroke) && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: background(it),
              borderRadius: it.r,
              border: it.stroke ? `${it.sw ?? 2}px ${it.dash ? "dashed" : "solid"} ${it.stroke}` : undefined,
              boxSizing: "border-box",
            }}
          />
        )
      )}
      {it.text && <TextLayer t={it.text} w={it.w} h={it.h} edge={it.stroke && !it.path ? (it.sw ?? 0) : 0} />}
      {it.role === "qr" && qr}
    </div>
  );
}

// `qr`: lo que va dentro del cuadro del código QR (láminas de participación).
export function Lamina({ n, qr, children }: { n: number; qr?: React.ReactNode; children?: React.ReactNode }) {
  const scene = laminaScene(n);
  if (!scene) return null;
  return (
    <div
      style={{
        position: "relative",
        width: LAMINA_W,
        height: LAMINA_H,
        overflow: "hidden",
        background: scene.bg,
        fontFamily: SANS_FAMILY,
      }}
    >
      {scene.items.map((it, i) => (
        <Item key={i} it={it} qr={qr} />
      ))}
      {children}
    </div>
  );
}
