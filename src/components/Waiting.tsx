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
    <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md text-center">
        {accent && (
          <span
            className="inline-block h-3 w-3 rounded-full mb-4"
            style={{ backgroundColor: accent }}
          />
        )}
        <h1 className="text-2xl font-semibold text-slate-800">{title}</h1>
        <p className="mt-3 text-slate-600">{message}</p>
        <div className="mt-8 flex justify-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.2s]" />
          <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.1s]" />
          <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" />
        </div>
      </div>
    </main>
  );
}
