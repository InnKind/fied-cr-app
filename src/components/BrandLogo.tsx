// Logo FIEd (blanco) para el encabezado de las pantallas del participante.
// Va sobre el degradado de marca; tamaño discreto (el hero grande es la
// bienvenida).
export default function BrandLogo({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/fied-logo.png"
      alt="FIEd Costa Rica"
      className={`h-10 w-auto drop-shadow ${className}`}
    />
  );
}
