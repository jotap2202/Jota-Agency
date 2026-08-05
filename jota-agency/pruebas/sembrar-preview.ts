import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { cargarDemo } from "@/lib/agente/demo";

const prisma = new PrismaClient();
const EMAIL = "demo@jotaagency.local";
const PASS = "JotaDemo2026!";

// Usuario admin de desarrollo. Usa el mismo hash bcrypt que /api/registro:
// no se toca nada de la autenticación, solo se siembra una cuenta.
const hash = await bcrypt.hash(PASS, 10);
await prisma.user.upsert({
  where: { email: EMAIL },
  create: { email: EMAIL, name: "Demo CEO", empresa: "JOTA agency", password: hash },
  update: { password: hash },
});

const r = await cargarDemo();
const t = await prisma.tenant.findUnique({ where: { id: r.tenantId } });
console.log("USUARIO=" + EMAIL);
console.log("TENANT=" + t?.nombreNegocio + " (" + t?.slug + ")");
console.log("CLAVE_WIDGET=" + r.clavePublica);
console.log("CONVERSACIONES=" + await prisma.conversation.count({ where: { tenantId: r.tenantId } }));
console.log("LEADS=" + await prisma.lead.count({ where: { tenantId: r.tenantId } }));
console.log("EMAILS=" + await prisma.emailOutbox.count({ where: { tenantId: r.tenantId } }));
await prisma.$disconnect();
