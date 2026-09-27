import { timingSafeEqual } from "node:crypto";

// SOLO servidor. Verifica la clave del modo stand.
// La clave es STAND_SECRET (propia del stand: si se filtra, no compromete el
// panel del FIEd). Mientras no esté configurada en Vercel, se usa ADMIN_SECRET
// para no dejar el stand sin control.
// A diferencia del panel del FIEd, aquí NO hay modo de transición: si el
// servidor no tiene ninguna de las dos, nadie puede mover la sesión ni exportar.
export type KeyCheck =
  | { ok: true; source: "stand" | "admin" }
  | { ok: false; status: 401 | 503; code: "bad-key" | "no-secret"; error: string };

export function standSecret(): { secret: string; source: "stand" | "admin" } | null {
  const own = process.env.STAND_SECRET;
  if (own) return { secret: own, source: "stand" };
  const admin = process.env.ADMIN_SECRET;
  if (admin) return { secret: admin, source: "admin" };
  return null;
}

export function checkStandKey(k: unknown): KeyCheck {
  const s = standSecret();
  if (!s) {
    return {
      ok: false,
      status: 503,
      code: "no-secret",
      error: "Falta configurar STAND_SECRET en el servidor.",
    };
  }
  if (typeof k !== "string" || !k) {
    return { ok: false, status: 401, code: "bad-key", error: "Clave incorrecta." };
  }
  const a = Buffer.from(k);
  const b = Buffer.from(s.secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, code: "bad-key", error: "Clave incorrecta." };
  }
  return { ok: true, source: s.source };
}
