import { BRAND_BG } from "@/lib/brand";

// Encabezado de marca para las pantallas de operación (admin, facilitador,
// curaduría, archivo): una barra con el logo FIEd sobre el degradado, dejando
// el contenido de abajo claro y legible.
export default function BrandBar() {
  return (
    <div
      className="mb-5 flex items-center rounded-xl px-4 py-2.5 shadow-sm"
      style={{ background: BRAND_BG }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/fied-logo.png" alt="FIEd Costa Rica" className="h-7 w-auto" />
    </div>
  );
}
