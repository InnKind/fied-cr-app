// Identidad del facilitador en el navegador: la mesa que atiende.
// Simple por ahora (número de mesa en localStorage). Cuando el equipo entregue
// credenciales preasignadas, esto se conecta a la tabla `facilitators`.

const TABLE_KEY = "fied_facilitator_table";

export function getFacilitatorTable(): number | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(TABLE_KEY);
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

export function setFacilitatorTable(n: number): void {
  localStorage.setItem(TABLE_KEY, String(n));
}

export function clearFacilitatorTable(): void {
  localStorage.removeItem(TABLE_KEY);
}
