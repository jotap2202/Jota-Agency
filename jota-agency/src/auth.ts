import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { envLimpio, googleConfigurado } from "@/lib/config-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true, // necesario detrás del proxy de Vercel / dominios propios
  session: { strategy: "jwt" },
  pages: { signIn: "/acceder", error: "/acceder" },
  providers: [
    // Google se suma solo si sus credenciales están cargadas: si faltan, el
    // proveedor rompería todo el login (incluido el de email y contraseña).
    ...(googleConfigurado()
      ? [
          Google({
            clientId: envLimpio("AUTH_GOOGLE_ID"),
            clientSecret: envLimpio("AUTH_GOOGLE_SECRET"),
            // NO activar allowDangerousEmailAccountLinking: el registro por
            // contraseña (/api/registro) no verifica el email, así que
            // alguien podría registrar tu email con SU contraseña antes que
            // vos, y ese flag fusionaría tu login de Google (verificado) con
            // esa cuenta — el atacante conservaría acceso. Sin el flag,
            // Auth.js rechaza el login con OAuthAccountNotLinked, que
            // /acceder ya traduce a un mensaje claro pidiendo entrar con
            // contraseña. Ver .ai-review/jota-agency-round-3.md (G4).
          }),
        ]
      : []),
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.password) return null;
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
  },
});
