import { supabase } from "@/lib/supabase";

// Tema que trabaja una MESA. Se usa para la gente que se incorpora tarde: si
// alguien llega cuando el ejercicio ya arrancó, nunca pasó por la pantalla de
// elección de tema, así que su `selected_theme` está vacío y las pantallas que
// dependen de él (tema, ejemplos, pregunta clave) salían en blanco.
//
// Orden de resolución: lo que decidió la distribución (`table_themes`) y, si esa
// mesa no está ahí (p. ej. alguien se sentó en una mesa fuera del reparto), el
// tema de cualquier compañero de esa misma mesa.
export async function themeForTableNumber(
  table: number
): Promise<string | null> {
  const { data } = await supabase
    .from("table_themes")
    .select("theme")
    .eq("table_number", table)
    .maybeSingle();
  if (data?.theme) return data.theme as string;

  const { data: companero } = await supabase
    .from("participants")
    .select("selected_theme")
    .eq("current_table", table)
    .not("selected_theme", "is", null)
    .limit(1)
    .maybeSingle();
  return (companero?.selected_theme as string | null) ?? null;
}
