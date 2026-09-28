import type { Metadata, Viewport } from "next";

// Modo stand (GET Forum 2026). Título y color propios; no usa la marca del FIEd CR.
export const metadata: Metadata = {
  title: "SénecaLab · InnKind — GET Forum 2026",
  description:
    "Sesión participativa de SénecaLab e InnKind en el GET Forum 2026. Tus respuestas son anónimas.",
};

export const viewport: Viewport = {
  themeColor: "#223c5d",
};

export default function StandLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-1 flex-col bg-[#223c5d]">{children}</div>;
}
