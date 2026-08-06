import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite acceder al servidor de desarrollo desde otros dispositivos de la
  // red local (p. ej. un celular en el mismo wifi) usando la IP de la compu.
  // Si tu IP local cambia, agregá la nueva aquí. (En producción/Vercel no aplica.)
  allowedDevOrigins: ["10.10.0.178"],
};

export default nextConfig;
