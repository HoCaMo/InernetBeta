"use server";

import { prisma } from "@/app/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------
// TELÉFONOS
// ---------------------------------------------------------
export async function agregarTelefono(idCliente: number, formData: FormData) {
  const numero = formData.get("numero") as string;
  const principal = formData.get("principal") === "on";

  if (principal) {
    await prisma.telefono.updateMany({
      where: { idCliente },
      data: { principal: false },
    });
  }

  await prisma.telefono.create({
    data: { idCliente, numero, principal },
  });

  revalidatePath(`/clientes/${idCliente}`);
}

export async function eliminarTelefono(idTelefono: number, idCliente: number) {
  await prisma.telefono.delete({ where: { idTelefono } });
  revalidatePath(`/clientes/${idCliente}`);
}

// ---------------------------------------------------------
// DOCUMENTOS
// ---------------------------------------------------------
export async function agregarDocumento(idCliente: number, formData: FormData) {
  const tipoDocumento = formData.get("tipoDocumento") as
    | "DNI"
    | "CE"
    | "RUC"
    | "PASAPORTE";
  const numeroDocumento = formData.get("numeroDocumento") as string;
  const tipoRuc = formData.get("tipoRuc") as string;

  await prisma.documentoCliente.create({
    data: {
      idCliente,
      tipoDocumento,
      numeroDocumento,
      tipoRuc: tipoDocumento === "RUC" ? (tipoRuc as "RUC10" | "RUC20") : null,
    },
  });

  revalidatePath(`/clientes/${idCliente}`);
}

export async function eliminarDocumento(
  idDocumento: number,
  idCliente: number,
) {
  await prisma.documentoCliente.delete({ where: { idDocumento } });
  revalidatePath(`/clientes/${idCliente}`);
}

// ---------------------------------------------------------
// INSTALACIÓN (activo + derecho de instalación) — solo jefe/administrador
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
  const derechoInstalacion = Number(formData.get("derechoInstalacion"));

  if (Number.isNaN(derechoInstalacion) || derechoInstalacion < 0) {
    throw new Error("Ingresa un monto válido para el derecho de instalación");
  }

  const cliente = await prisma.cliente.update({
    where: { idCliente },
    data: { activo, derechoInstalacion, datosAdminCompletos: true },
  });

  if (cliente.idCreadoPor) {
    await prisma.notificacion.create({
      data: {
        idUsuarioDestino: cliente.idCreadoPor,
        mensaje: `${session.user.name} (${session.user.rol}) completó la instalación de "${cliente.nombre} ${cliente.apellido}": activo = ${activo ? "Sí" : "No"}, derecho de instalación = S/ ${derechoInstalacion.toFixed(2)}.`,
      },
    });
  }

  revalidatePath(`/clientes/${idCliente}`);
}
