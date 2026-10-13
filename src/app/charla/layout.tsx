import type { Metadata, Viewport } from "next";
import { Nunito_Sans, Source_Serif_4 } from "next/font/google";

// Charla «La universidad que el primer empleo necesita». Tipografías de la
// presentación: Nunito Sans (texto) y Source Serif 4 en cursiva (títulos y cifras).
const nunito = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const serif4 = Source_Serif_4({
  variable: "--font-serif4",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "La universidad que el primer empleo necesita — SénecaLab · InnKind",
  description:
    "Participe desde su celular en la charla «La universidad que el primer empleo necesita», de SénecaLab e InnKind.",
};

export const viewport: Viewport = {
  themeColor: "#223c5d",
};

export default function CharlaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${nunito.variable} ${serif4.variable} flex min-h-dvh flex-1 flex-col bg-[#223c5d]`}
      style={{ fontFamily: "var(--font-nunito), system-ui, -apple-system, sans-serif" }}
    >
      {children}
    </div>
  );
}
