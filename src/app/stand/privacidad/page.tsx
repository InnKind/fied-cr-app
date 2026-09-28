import { BrandMark, Chip } from "@/components/stand/StandUI";
import { CONSENTS } from "@/config/stand";

// Aviso de privacidad del stand (respaldo si no llega el enlace del aviso de las
// inscripciones del FIEd). Mientras PRIVACY_APPROVED sea false, la página muestra
// los marcadores amarillos: no se imprime esta dirección sin la aprobación de Adriana.
const PRIVACY_APPROVED = false;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 space-y-2 leading-relaxed text-white/85">{children}</div>
    </section>
  );
}

export default function StandPrivacidad() {
  return (
    <main className="min-h-dvh flex-1 bg-[#223c5d] text-white">
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-6 sm:px-8">
        <header className="flex items-center justify-between gap-3">
          <BrandMark className="text-lg sm:text-xl" />
          <span className="text-xs font-medium text-white/60">GET Forum 2026</span>
        </header>

        <h1 className="mt-8 text-3xl font-bold leading-tight">Aviso de privacidad del stand</h1>
        {!PRIVACY_APPROVED && (
          <p className="mt-3">
            <Chip kind="APROBAR" text="Adriana aprueba este texto antes de publicarlo" />
          </p>
        )}

        <Section title="Quién trata tus datos">
          <p>
            SenecaLab S.A., que organiza InnKind. Contacto:{" "}
            {PRIVACY_APPROVED ? null : <Chip kind="PEDIR" text="correo de contacto" />}
          </p>
        </Section>

        <Section title="Qué datos guardamos">
          <p>
            Tus respuestas a las preguntas de la sesión son anónimas: se guardan con un código
            aleatorio de tu celular, sin tu nombre ni tu correo, y no se unen a tus datos de contacto.
          </p>
          <p>
            Si llenas las Tres puertas (en el celular o en el talón del tríptico), guardamos tu
            nombre, cargo, organización, país y correo, la puerta y las opciones que elegiste y lo
            que escribiste en el formulario.
          </p>
        </Section>

        <Section title="Para qué los usamos">
          <p>Solo para lo que marcaste:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{CONSENTS.contact}</li>
            <li>{CONSENTS.results}</li>
            <li>{CONSENTS.news}</li>
          </ul>
          <p>No vendemos tus datos ni los compartimos con patrocinadores.</p>
        </Section>

        <Section title="Dónde se guardan">
          <p>
            En servicios en la nube cuyos servidores pueden estar fuera de Ecuador.{" "}
            {!PRIVACY_APPROVED && (
              <Chip kind="APROBAR" text="línea sobre el envío de datos fuera de Ecuador" />
            )}
          </p>
        </Section>

        <Section title="Cuánto tiempo">
          <p>
            Hasta que nos pidas borrarlos o, como máximo,{" "}
            {PRIVACY_APPROVED ? "24 meses" : <Chip kind="APROBAR" text="24 meses" />}.
          </p>
        </Section>

        <Section title="Tus derechos">
          <p>
            Puedes pedirnos ver, corregir o borrar tus datos, o retirar un consentimiento, escribiendo
            al correo de contacto de arriba.
          </p>
        </Section>

        <p className="mt-10 text-sm text-white/60">
          <a href="/stand" className="underline">
            Volver al stand
          </a>
        </p>
      </div>
    </main>
  );
}
