import { auth } from "@/auth";
import { prisma } from "@/app/lib/db";
import { redirect } from "next/navigation";
import Shell from "@/app/components/Shell";
import SolicitudesManager from "./SolicitudesManager";
import type { Prisma } from "@prisma/client";

export default async function SolicitudesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rol = session.user.rol;
  const idUsuario = session.user.idUsuario;

  let where: Prisma.SolicitudWhereInput = {};

  if (rol === "JEFE") {
    where = {};
  } else if (rol === "ADMINISTRADOR") {
    where = {
      OR: [
        { tipo: { in: ["CREACION_CLIENTE", "EDICION_CLIENTE"] } },
        { idSolicitante: idUsuario },
      ],
    };
  } else {
    where = { idSolicitante: idUsuario };
  }

  const solicitudes = await prisma.solicitud.findMany({
    where,
    include: {
      solicitante: { select: { nombre: true, rol: true } },
      resolutor: { select: { nombre: true } },
      cliente: { select: { nombre: true, apellido: true } },
    },
    orderBy: { fechaSolicitud: "desc" },
  });

  return (
    <Shell nombre={session.user.name ?? ""} rol={rol}>
      <h1 className="mb-1 text-2xl font-semibold text-white">Solicitudes</h1>
      <p className="mb-8 text-sm text-slate-400">
        {rol === "JEFE"
          ? "Todas las solicitudes del sistema."
          : "Solicitudes relevantes para tu rol."}
      </p>
      <SolicitudesManager solicitudes={solicitudes} rolActual={rol} />
    </Shell>
  );
}
