import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      idUsuario: number;
      rol: "JEFE" | "ADMINISTRADOR" | "TRABAJADOR";
    } & DefaultSession["user"];
  }
}
