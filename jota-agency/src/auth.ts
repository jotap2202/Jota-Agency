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
            allowDangerousEmailAccountLinking: true,
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
