"use server";

import { prisma } from "@/app/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------
// ACTIVACIÓN: solo jefe/administrador, define si el cliente está activo.
// (Teléfono y documento ya no se editan directo: se piden por solicitud desde la pestaña Edición.)
// ---------------------------------------------------------
export async function completarInstalacion(
  idCliente: number,
  formData: FormData,
) {
  const session = await auth();
  if (
    !session ||
    (session.user.rol !== "ADMINISTRADOR" && session.user.rol !== "JEFE")
  ) {
    throw new Error(
      "Solo un administrador o el jefe pueden completar este paso",
    );
  }

  const activo = formData.get("activo") === "si";

  const cliente = await prisma.cliente.update({
    where: { idCliente },
    data: { activo },
  });

  if (cliente.idCreadoPor) {
    await prisma.notificacion.create({
      data: {
        idUsuarioDestino: cliente.idCreadoPor,
        mensaje: `${session.user.name} (${session.user.rol}) definió el estado de "${cliente.nombre} ${cliente.apellido}" como activo = ${activo ? "Sí" : "No"}.`,
      },
    });
  }

  revalidatePath(`/clientes/${idCliente}`);
}
