import Results from "@/components/Results";
import { EVENT } from "@/config/event";

// Pantalla de resultados para PROYECTAR (versión grande).
export default function ResultsPage() {
  return (
    <main className="flex-1 flex flex-col items-center p-8 bg-slate-50">
      <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
        {EVENT.name}
      </p>
      <div className="mt-6 w-full flex justify-center">
        <Results round={1} big />
      </div>
    </main>
  );
}
