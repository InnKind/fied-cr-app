import { timingSafeEqual } from "node:crypto";

// SOLO servidor. Verifica la clave del modo stand contra ADMIN_SECRET.
// A diferencia del panel del FIEd, aquí NO hay modo de transición: si el
// servidor no tiene ADMIN_SECRET, nadie puede mover la sesión ni exportar.
export type KeyCheck =
  | { ok: true }
  | { ok: false; status: 401 | 503; code: "bad-key" | "no-secret"; error: string };

export function checkStandKey(k: unknown): KeyCheck {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return {
      ok: false,
      status: 503,
      code: "no-secret",
      error: "Falta configurar ADMIN_SECRET en el servidor.",
    };
  }
  if (typeof k !== "string" || !k) {
    return { ok: false, status: 401, code: "bad-key", error: "Clave incorrecta." };
  }
  const a = Buffer.from(k);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, code: "bad-key", error: "Clave incorrecta." };
  }
  return { ok: true };
}
