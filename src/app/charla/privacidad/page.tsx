import { CONTACT, CONTACT_EMAIL, TALK_TITLE } from "@/config/charla";
import { BrandLogos, Kicker, SERIF } from "@/components/charla/CharlaUI";

// Aviso de privacidad de la charla. Las respuestas son ANÓNIMAS: no se pide el
// nombre y el celular solo guarda un código aleatorio. El contacto del final es
// opcional y se guarda aparte, sin ese código, así que no se une con las respuestas.
// Mientras PRIVACY_APPROVED sea false, debajo del título sale un marcador
// amarillo: el texto es un borrador y Adriana todavía no lo ha aprobado. Cuando
// lo apruebe, se pone en true (y se anota aquí la fecha). Si el texto cambia y
// vuelve a necesitar su OK, se regresa a false.
const PRIVACY_APPROVED = false;

// Marcador de contenido pendiente, igual al del stand (se repite aquí para no
// depender de sus componentes).
function Chip({ kind, text }: { kind: string; text: string }) {
  return (
    <span className="mx-[0.1em] inline-block rounded-[0.35em] border-2 border-[#a16207] bg-[#fde047] px-[0.45em] py-[0.05em] align-baseline text-[0.85em] font-semibold leading-snug text-[#3a2c00]">
      {kind}: {text}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 space-y-2 leading-relaxed text-[#dce4ff]">{children}</div>
    </section>
  );
}

function Mail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-white underline">
      {CONTACT_EMAIL}
    </a>
  );
}

export default function CharlaPrivacidad() {
  return (
    <main className="min-h-dvh flex-1 bg-[#223c5d] text-white">
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-6 sm:px-8">
        <header>
          <BrandLogos height={28} tone="blanco" />
        </header>

        <Kicker className="mt-8 text-[11px] text-[#dce4ff]">{TALK_TITLE}</Kicker>
        <h1 className="mt-2 text-4xl leading-tight" style={SERIF}>
          Aviso de privacidad
        </h1>
        {!PRIVACY_APPROVED && (
          <p className="mt-3">
            <Chip kind="APROBAR" text="Adriana aprueba este texto antes de publicarlo" />
          </p>
        )}

        <Section title="Quién trata sus datos">
          <p>
            SenecaLab S.A., que organiza InnKind. Contacto: <Mail />
          </p>
        </Section>

        <Section title="Sus respuestas son anónimas">
          <p>
            Para responder no le pedimos su nombre ni ningún otro dato personal. Sus respuestas se
            guardan sin su nombre.
          </p>
          <p>
            Su celular guarda un código aleatorio solo para no repetirle las preguntas que ya
            respondió. Ese código no dice quién es usted.
          </p>
          <p>En las respuestas de texto, le pedimos no escribir su nombre ni otros datos personales.</p>
        </Section>

        <Section title="Su contacto, si decide dejarlo">
          <p>
            Al final puede dejar, si quiere, su nombre y su correo y, si lo desea, su organización y
            su cargo, junto con lo que marque en «{CONTACT.prompt}». Es opcional.
          </p>
          <p>
            Ese contacto se guarda aparte: no lleva el código de su celular y no lo unimos con sus
            respuestas.
          </p>
        </Section>

        <Section title="Para qué los usamos">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Sus respuestas: para alimentar InnKind Intelligence, el análisis de InnKind sobre lo
              que piensan y deciden los líderes de la educación superior y el empleo.
            </li>
            <li>
              Su contacto: solo para lo que marcó. Es lo que acepta al enviarlo: «{CONTACT.consent}»
            </li>
          </ul>
          <p>
            Lo que se muestra en la pantalla de la sala y en la{" "}
            <a href="/charla/resultados" className="text-white underline">
              página de resultados
            </a>{" "}
            son solo conteos: nunca nombres, correos ni textos escritos.
          </p>
        </Section>

        <Section title="Quién los ve">
          <p>El equipo de SénecaLab e InnKind.</p>
          <p>
            No vendemos ni cedemos sus datos. Los resultados agregados (sin nombres) pueden
            compartirse en informes de InnKind.
          </p>
        </Section>

        <Section title="Dónde se guardan">
          <p>En proveedores de nube (Supabase y Vercel) con servidores fuera de Panamá.</p>
        </Section>

        <Section title="Sus derechos">
          <p>
            Puede pedirnos ver, corregir o borrar su contacto escribiendo a <Mail />.
          </p>
          <p>
            Como sus respuestas no llevan su nombre, no podemos saber cuáles son suyas.
          </p>
        </Section>

        <p className="mt-10 text-sm text-[#dce4ff]">
          <a href="/charla" className="underline">
            Volver a la charla
          </a>
        </p>
      </div>
    </main>
  );
}
