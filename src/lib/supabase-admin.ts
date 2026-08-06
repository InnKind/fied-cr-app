import { createClient } from "@supabase/supabase-js";

// SOLO servidor. Cliente con privilegios (service_role) para operaciones de
// administrador que deben saltarse las políticas de seguridad (RLS).
// Si aún no está configurado SUPABASE_SERVICE_ROLE, cae al anon key para no
// romper nada durante la transición (queda seguro cuando se configure).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseAdmin = createClient(url, serviceKey || anonKey, {
  auth: { persistSession: false },
});

export const hasServiceRole = !!serviceKey;
