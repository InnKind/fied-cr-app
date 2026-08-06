import { createClient } from "@supabase/supabase-js";

// Cliente de Supabase para el navegador. Usa la anon key (pública).
// Las credenciales viven en .env.local (no se suben a git).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey);
