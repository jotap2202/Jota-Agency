export type Idioma = "es" | "en";

/** Mail de contacto de la agencia. Cambiándolo acá se actualiza en toda la web. */
export const EMAIL_CONTACTO = "hola@jota.agency";

export type Contenido = {
  skip: string;
  nav: { servicios: string; proceso: string; diagnostico: string; cta: string };
  hero: { eyebrow: string; lineas: string[]; sub: string; cta1: string; cta2: string };
  marquee: string;
  stats: { n: number; suf: string; label: string }[];
  sectores: { cap: string; titulo: string; items: string[] };
  manif: { cap: string; titulo: string; texto: string; imgCap: string };
  manif2: { cap: string; titulo: string; texto: string; imgCap: string };
  serviciosCap: string;
  servTitulo: string;
  servSub: string;
  servicios: { nombre: string; cap: string; desc: string }[];
  procTitulo: string;
  procSub: string;
  pasos: { titulo: string; desc: string }[];
  garantia: { cap: string; texto: string; firma: string };
  diag: {
    eyebrow: string;
    titulo: string;
    sub: string;
    online: string;
    placeholder: string;
    boton: string;
    analizando: string;
    resultado: string;
    denuevo: string;
    descLabel: string;
    authTitulo: string;
    authSub: string;
    googleBtn: string;
    orSep: string;
    tabSignup: string;
    tabLogin: string;
    regNombre: string;
    regEmail: string;
    regEmpresa: string;
    regPass: string;
    signupBtn: string;
    loginBtn: string;
    regNota: string;
    regError: string;
    emailError: string;
    passError: string;
    loginError: string;
    conectado: string;
    ctaLlamada: string;
    errorConexion: string;
    empTitulo: string;
    empSub: string;
    empPlaceholder: string;
    empBoton: string;
    empError: string;
  };
  cierre: { lineas: string[]; sub: string; cta: string; nota: string; oEscribinos: string };
  footer: string;
  salir: string;
  asuntoMail: string;
};

export const T: Record<Idioma, Contenido> = {
  es: {
    skip: "Saltar al contenido",
    nav: { servicios: "Servicios", proceso: "Método", diagnostico: "Diagnóstico", cta: "Hablar con J" },
    hero: {
      eyebrow: "Agencia de generación de clientes B2B — ES/EN",
      lineas: ["Convertimos empresas", "desconocidas en", "empresas buscadas."],
      sub: "Nos dedicamos a una sola cosa: conseguirte clientes. Reuniones calificadas en tu agenda, todos los meses.",
      cta1: "Diagnóstico gratis con J",
      cta2: "Ver el método",
    },
    marquee: "MÁS CLIENTES — MÁS REUNIONES — MÁS CRECIMIENTO — ",
    stats: [
      { n: 24, suf: "/7", label: "Cada interesado atendido, sin importar la hora" },
      { n: 78, suf: "%", label: "de los compradores le compra a quien responde primero" },
      { n: 15, suf: " min", label: "Es lo que dura la llamada que puede cambiar tu negocio" },
    ],
    sectores: {
      cap: "Confianza",
      titulo: "Sistemas de captación pensados para tu rubro",
      items: ["Estudios contables", "Clínicas y salud", "Inmobiliarias", "Servicios profesionales", "Software / SaaS", "Agencias y estudios"],
    },
    manif: {
      cap: "El problema real",
      titulo: "No te faltan clientes. Te falta que te encuentren.",
      texto:
        "Hay empresas que hacen un trabajo excelente y aun así no crecen. No es por la calidad: es porque nadie sabe que existen, o porque cuando alguien pregunta, nadie responde a tiempo. Ahí es donde entramos.",
      imgCap: "Cada consulta sin responder es un cliente que se fue con otro.",
    },
    manif2: {
      cap: "La diferencia JOTA",
      titulo: "Trabajamos mientras dormís.",
      texto:
        "Nuestro sistema prospecta, contacta y responde las 24 horas. Cuando un cliente potencial escribe a medianoche, lo atendemos. Cuando te googlea, aparecés con la mejor cara. Vos te ocupás de tu negocio; nosotros, de llenarte la agenda.",
      imgCap: "El comprador que llega a las 11 de la noche también es tuyo.",
    },
    serviciosCap: "Servicios",
    servTitulo: "Cómo conseguimos clientes",
    servSub: "Seis piezas. Un solo objetivo: que tu agenda se llene.",
    servicios: [
      { nombre: "Prospección B2B", cap: "Reuniones calificadas", desc: "Buscamos, contactamos y calificamos potenciales clientes uno por uno. Tu equipo solo se sienta con alguien que ya quiere escucharte." },
      { nombre: "LinkedIn del fundador", cap: "Autoridad que atrae", desc: "Convertimos el perfil del dueño en un imán de clientes: contenido y conversaciones que hacen que te escriban a vos." },
      { nombre: "Email en frío", cap: "Puertas que se abren", desc: "Campañas hacia empresas que hoy no saben que existís, con seguimiento automático hasta conseguir la respuesta." },
      { nombre: "Agente IA 24/7", cap: "Cero consultas perdidas", desc: "Ningún interesado se queda sin respuesta, ni a las 3 de la mañana. Atiende, califica y captura cada lead." },
      { nombre: "Reseñas y reputación", cap: "Confianza al instante", desc: "Cuando te googlean, encuentran una empresa impecable: más reseñas, mejores respuestas, cero descuido." },
      { nombre: "Publicidad paga", cap: "Alcance medible", desc: "Campañas donde cada peso invertido se traduce en consultas de gente que busca lo que vendés." },
    ],
    procTitulo: "El método",
    procSub: "Tres pasos. Vos solo aparecés en el último.",
    pasos: [
      { titulo: "Diagnóstico", desc: "Contanos tu negocio (podés empezar ahora con J). Definimos juntos tu cliente ideal." },
      { titulo: "Sistema en marcha", desc: "En la primera semana armamos prospección, mensajes y automatización. Empezamos a contactar." },
      { titulo: "Reuniones en tu agenda", desc: "Recibís reuniones calificadas y un reporte semanal claro. Escalamos lo que funciona." },
    ],
    garantia: {
      cap: "Nuestra garantía",
      texto: "Acordamos un mínimo de reuniones por mes. Si no llegamos, el mes siguiente trabajamos gratis.",
      firma: "Así de seguros estamos del método.",
    },
    diag: {
      eyebrow: "Diagnóstico en vivo",
      titulo: "Contale a J sobre tu negocio",
      sub: "J es nuestro estratega con IA. Describí tu empresa y te devuelve un mini plan al instante.",
      online: "Estratega IA · en línea",
      descLabel: "Describí tu negocio",
      placeholder: "Ej: Tengo un estudio contable con 6 empleados. Los clientes llegan por recomendación pero hace un año que no crecemos…",
      boton: "Diagnosticar mi empresa",
      analizando: "J está analizando tu negocio…",
      resultado: "Diagnóstico de J",
      denuevo: "Hacer otro diagnóstico",
      authTitulo: "Accedé para ver tu diagnóstico",
      authSub: "Creá tu cuenta o entrá para que J genere tu plan y podamos enviártelo.",
      googleBtn: "Continuar con Google",
      orSep: "o con tu email",
      tabSignup: "Crear cuenta",
      tabLogin: "Entrar",
      regNombre: "Tu nombre",
      regEmail: "Tu email",
      regEmpresa: "Tu empresa",
      regPass: "Contraseña (mín. 6)",
      signupBtn: "Crear cuenta y ver diagnóstico",
      loginBtn: "Entrar y ver diagnóstico",
      regNota: "Al continuar aceptás que guardemos estos datos para contactarte sobre tu diagnóstico.",
      regError: "Completá nombre y empresa.",
      emailError: "Ingresá un email válido.",
      passError: "La contraseña debe tener al menos 6 caracteres.",
      loginError: "Email o contraseña incorrectos.",
      conectado: "Conectado como",
      ctaLlamada: "Agendar llamada de 15 min",
      errorConexion: "No pude conectar con J. Probá de nuevo.",
      empTitulo: "Una cosa más antes de empezar",
      empSub: "Decinos cómo se llama tu empresa para que J pueda darte un diagnóstico a medida.",
      empPlaceholder: "Nombre de tu empresa",
      empBoton: "Continuar",
      empError: "Escribí el nombre de tu empresa.",
    },
    cierre: {
      lineas: ["¿Listo para que", "te busquen a vos?"],
      sub: "Una llamada de 15 minutos alcanza para saber si podemos ayudarte. Sin compromiso.",
      cta: "Agendar llamada de 15 min",
      nota: "Respondemos en el día, en español o inglés.",
      oEscribinos: "o escribinos a",
    },
    footer: "Generación de clientes B2B · Español / English",
    salir: "Salir",
    asuntoMail: "Consulta desde la web de JOTA agency",
  },
  en: {
    skip: "Skip to content",
    nav: { servicios: "Services", proceso: "Method", diagnostico: "Diagnosis", cta: "Talk to J" },
    hero: {
      eyebrow: "B2B client generation agency — ES/EN",
      lineas: ["We turn unknown", "companies into", "sought-after companies."],
      sub: "We do one thing: get you clients. Qualified meetings on your calendar, every month.",
      cta1: "Free diagnosis with J",
      cta2: "See the method",
    },
    marquee: "MORE CLIENTS — MORE MEETINGS — MORE GROWTH — ",
    stats: [
      { n: 24, suf: "/7", label: "Every lead answered, no matter the hour" },
      { n: 78, suf: "%", label: "of buyers buy from whoever responds first" },
      { n: 15, suf: " min", label: "The length of the call that can change your business" },
    ],
    sectores: {
      cap: "Trusted",
      titulo: "Client-generation systems built for your industry",
      items: ["Accounting firms", "Clinics & health", "Real estate", "Professional services", "Software / SaaS", "Agencies & studios"],
    },
    manif: {
      cap: "The real problem",
      titulo: "You don't lack clients. You lack being found.",
      texto:
        "Some companies do excellent work and still don't grow. It's not quality: it's that nobody knows they exist, or that when someone asks, nobody answers in time. That's where we come in.",
      imgCap: "Every unanswered inquiry is a client who went with someone else.",
    },
    manif2: {
      cap: "The JOTA difference",
      titulo: "We work while you sleep.",
      texto:
        "Our system prospects, contacts and replies around the clock. When a potential client writes at midnight, we answer. When they google you, you show up at your best. You run your business; we fill your calendar.",
      imgCap: "The buyer who arrives at 11pm is yours too.",
    },
    serviciosCap: "Services",
    servTitulo: "How we get you clients",
    servSub: "Six pieces. One goal: a full calendar.",
    servicios: [
      { nombre: "B2B Prospecting", cap: "Qualified meetings", desc: "We find, contact and qualify potential clients one by one. Your team just sits down with someone who already wants to listen." },
      { nombre: "Founder's LinkedIn", cap: "Authority that attracts", desc: "We turn the owner's profile into a client magnet: content and conversations that make prospects write to you." },
      { nombre: "Cold email", cap: "Doors that open", desc: "Campaigns to companies that don't know you exist yet, with automatic follow-up until we get the reply." },
      { nombre: "24/7 AI agent", cap: "Zero lost inquiries", desc: "No lead goes unanswered, not even at 3am. It replies, qualifies and captures every lead." },
      { nombre: "Reviews & reputation", cap: "Instant trust", desc: "When they google you, they find an impeccable company: more reviews, better replies, zero neglect." },
      { nombre: "Paid ads", cap: "Measurable reach", desc: "Campaigns where every dollar invested turns into inquiries from people looking for what you sell." },
    ],
    procTitulo: "The method",
    procSub: "Three steps. You only show up for the last one.",
    pasos: [
      { titulo: "Diagnosis", desc: "Tell us about your business (start now with J). Together we define your ideal client." },
      { titulo: "System up and running", desc: "In the first week we build prospecting, messaging and automation. Outreach begins." },
      { titulo: "Meetings on your calendar", desc: "You get qualified meetings and a clear weekly report. We scale what works." },
    ],
    garantia: {
      cap: "Our guarantee",
      texto: "We agree on a minimum number of meetings per month. If we don't hit it, next month we work for free.",
      firma: "That's how confident we are in the method.",
    },
    diag: {
      eyebrow: "Live diagnosis",
      titulo: "Tell J about your business",
      sub: "J is our AI strategist. Describe your company and get a mini plan instantly.",
      online: "AI strategist · online",
      descLabel: "Describe your business",
      placeholder: "E.g.: I run an accounting firm with 6 employees. Clients come through referrals but we haven't grown in a year…",
      boton: "Diagnose my company",
      analizando: "J is analyzing your business…",
      resultado: "J's diagnosis",
      denuevo: "Run another diagnosis",
      authTitulo: "Sign in to see your diagnosis",
      authSub: "Create your account or sign in so J can build your plan and we can send it to you.",
      googleBtn: "Continue with Google",
      orSep: "or with your email",
      tabSignup: "Create account",
      tabLogin: "Sign in",
      regNombre: "Your name",
      regEmail: "Your email",
      regEmpresa: "Your company",
      regPass: "Password (min. 6)",
      signupBtn: "Create account & see diagnosis",
      loginBtn: "Sign in & see diagnosis",
      regNota: "By continuing you agree that we store these details to contact you about your diagnosis.",
      regError: "Fill in name and company.",
      emailError: "Enter a valid email.",
      passError: "Password must be at least 6 characters.",
      loginError: "Wrong email or password.",
      conectado: "Signed in as",
      ctaLlamada: "Book a 15-min call",
      errorConexion: "Couldn't reach J. Please try again.",
      empTitulo: "One more thing before we start",
      empSub: "Tell us your company's name so J can tailor the diagnosis to you.",
      empPlaceholder: "Your company's name",
      empBoton: "Continue",
      empError: "Please enter your company's name.",
    },
    cierre: {
      lineas: ["Ready to be the one", "they look for?"],
      sub: "A 15-minute call is enough to know if we can help. No commitment.",
      cta: "Book a 15-min call",
      nota: "We reply the same day, in Spanish or English.",
      oEscribinos: "or write to us at",
    },
    footer: "B2B client generation · Español / English",
    salir: "Sign out",
    asuntoMail: "Enquiry from the JOTA agency website",
  },
};
