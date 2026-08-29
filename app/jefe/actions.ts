"use server";

import { prisma } from "@/app/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

export async function crearAdministrador(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "JEFE") {
    throw new Error("Solo el jefe puede crear administradores");
  }

  const password = formData.get("password") as string;
  if (password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres");
  }
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.usuario.create({
    data: {
      nombre: formData.get("nombre") as string,
      correo: formData.get("correo") as string,
      passwordHash,
      rol: "ADMINISTRADOR",
      idSupervisor: session.user.idUsuario,
    },
  });

  revalidatePath("/jefe");
}
