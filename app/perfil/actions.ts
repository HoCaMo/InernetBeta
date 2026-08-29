"use server";

import { prisma } from "@/app/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

export async function cambiarPassword(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("No autenticado");

  const passwordActual = formData.get("passwordActual") as string;
  const passwordNueva = formData.get("passwordNueva") as string;
  const confirmarPassword = formData.get("confirmarPassword") as string;

  if (passwordNueva !== confirmarPassword) {
    throw new Error("Las contraseñas nuevas no coinciden");
  }
  if (passwordNueva.length < 6) {
    throw new Error("La nueva contraseña debe tener al menos 6 caracteres");
  }

  const usuario = await prisma.usuario.findUnique({
    where: { idUsuario: session.user.idUsuario },
  });
  if (!usuario) throw new Error("Usuario no encontrado");

  const valido = await bcrypt.compare(passwordActual, usuario.passwordHash);
  if (!valido) throw new Error("La contraseña actual es incorrecta");

  const nuevoHash = await bcrypt.hash(passwordNueva, 10);

  await prisma.usuario.update({
    where: { idUsuario: usuario.idUsuario },
    data: { passwordHash: nuevoHash },
  });

  // Notifica al supervisor directo, si tiene uno
  if (usuario.idSupervisor) {
    await prisma.notificacion.create({
      data: {
        idUsuarioDestino: usuario.idSupervisor,
        mensaje: `${usuario.nombre} (${usuario.rol}) actualizó su contraseña el ${new Date().toLocaleString("es-PE")}.`,
      },
    });
  }

  revalidatePath("/perfil");
}
