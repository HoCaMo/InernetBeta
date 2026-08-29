import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 60 * 30, // la sesión expira sola a los 30 minutos
  },
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // sin "maxAge" aquí -> cookie de sesión: se borra al cerrar el navegador
      },
    },
  },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        correo: {},
        password: {},
      },
      async authorize(credentials) {
        const correo = credentials?.correo as string;
        const password = credentials?.password as string;
        if (!correo || !password) return null;

        const usuario = await prisma.usuario.findUnique({ where: { correo } });
        if (!usuario || !usuario.activo) return null;

        const valido = await bcrypt.compare(password, usuario.passwordHash);
        if (!valido) return null;

        return {
          id: String(usuario.idUsuario),
          name: usuario.nombre,
          email: usuario.correo,
          rol: usuario.rol,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.idUsuario = Number(user.id);
        token.rol = (user as { rol: string }).rol;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.idUsuario = token.idUsuario as number;
      session.user.rol = token.rol as "JEFE" | "ADMINISTRADOR" | "TRABAJADOR";
      return session;
    },
  },
});
