export type Idioma = "es" | "en";

export const DIAG_PROMPT = (lang: Idioma, descripcion: string) => `Sos J, el estratega de crecimiento con IA de JOTA agency, una agencia dedicada a una sola cosa: conseguir clientes para empresas.

SERVICIOS DE JOTA:
- Prospección B2B / reuniones calificadas con potenciales clientes
- Gestión de LinkedIn del fundador
- Secuencias de email en frío
- Agente IA de atención 24/7 (web y WhatsApp)
- Gestión de reseñas y reputación
- Publicidad paga Meta/Google
- Playbook comercial (orden del proceso de ventas)

Un visitante del sitio describió su negocio así:
"${descripcion}"

Escribí un mini diagnóstico ${lang === "en" ? "EN INGLÉS profesional y cercano" : "en español rioplatense profesional pero cercano (vos, no tú)"} con EXACTAMENTE esta estructura de 3 bloques, usando estos títulos en mayúsculas:

${lang === "en" ? "YOUR SITUATION:" : "TU SITUACIÓN:"}
(2-3 oraciones: qué está pasando con la captación de clientes de este negocio y la oportunidad principal que vemos)

${lang === "en" ? "WHAT WE'D DO:" : "QUÉ HARÍAMOS:"}
(los 2 o 3 servicios de JOTA que mejor encajan, cada uno en una línea explicando cómo le traería clientes a ESTE negocio en concreto)

${lang === "en" ? "NEXT STEP:" : "PRÓXIMO PASO:"}
(1-2 oraciones invitando a la llamada gratuita de 15 minutos, donde se define el plan a medida)

Reglas: NUNCA menciones precios, montos ni costos — si preguntan por precios, decí que se define en la llamada según el plan a medida. No inventes datos sobre el negocio que no te dieron. No prometas resultados garantizados ni números específicos de clientes. Sé concreto y hablá siempre en términos de conseguir clientes. Si la descripción no es de un negocio, respondé amable y breve que el diagnóstico es para empresas. Respondé SOLO con el diagnóstico, sin texto adicional.`;

// Texto de ejemplo cuando no hay ANTHROPIC_API_KEY configurada (modo demo).
export const DIAG_DEMO: Record<Idioma, string> = {
  es: `TU SITUACIÓN:
Tu negocio tiene con qué crecer, pero hoy depende de que te recomienden. Estás dejando en la mesa a todos los clientes que no llegan por el boca a boca.

QUÉ HARÍAMOS:
• Prospección B2B: contactamos uno por uno a tus clientes ideales y te agendamos reuniones con gente que ya quiere escucharte.
• Agente IA 24/7: cada consulta queda atendida al instante, de día y de noche, sin que se te escape ningún interesado.
• LinkedIn del fundador: convertimos tu perfil en una fuente constante de conversaciones y confianza.

PRÓXIMO PASO:
En una llamada de 15 minutos definimos tu plan a medida. Sin compromiso.

(Vista demo: configurá ANTHROPIC_API_KEY para que J genere este diagnóstico con IA en vivo.)`,
  en: `YOUR SITUATION:
Your business has what it takes to grow, but today it depends on referrals. You're leaving on the table every client who doesn't arrive by word of mouth.

WHAT WE'D DO:
• B2B Prospecting: we contact your ideal clients one by one and book you meetings with people who already want to listen.
• 24/7 AI agent: every inquiry is answered instantly, day and night, so no lead slips away.
• Founder's LinkedIn: we turn your profile into a steady source of conversations and trust.

NEXT STEP:
In a 15-minute call we define your tailored plan. No commitment.

(Demo view: set ANTHROPIC_API_KEY so J generates this diagnosis with live AI.)`,
};
