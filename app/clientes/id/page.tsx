import { prisma } from "@/app/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ClienteDetalle from "./ClienteDetalle";
import InstalacionForm from "./InstalacionForm";
import Shell from "@/app/components/Shell";
import Link from "next/link";
import {
  PLAN_LABELS,
  TIPO_ACCION_LABELS,
  TIPO_INSTALACION_LABELS,
} from "@/app/lib/constantes";

export default async function ClienteDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const idCliente = Number(params.id);

  const cliente = await prisma.cliente.findUnique({
    where: { idCliente },
    include: { telefonos: true, documentos: true, ubigeo: true },
  });

  if (!cliente) {
    return (
      <Shell nombre={session.user.name ?? ""} rol={session.user.rol}>
        <p className="text-slate-400">Cliente no encontrado.</p>
      </Shell>
    );
  }

  const puedeCompletarInstalacion =
    session.user.rol === "ADMINISTRADOR" || session.user.rol === "JEFE";

  return (
    <Shell nombre={session.user.name ?? ""} rol={session.user.rol}>
      <Link
        href="/clientes/gestion"
        className="text-sm text-amber-500 hover:text-amber-400"
      >
        ← Volver a la lista
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-white">
        {cliente.nombre} {cliente.apellido ?? ""}
      </h1>

      <div className="mt-2 grid gap-x-8 gap-y-1 text-sm text-slate-400 sm:grid-cols-2">
        <p>
          Tipo: {cliente.tipoCliente} — Estado: {cliente.estadoAprobacion}
        </p>
        <p>Correo: {cliente.correo ?? "—"}</p>
        <p>Domicilio: {cliente.direccion ?? "—"}</p>
        <p>
          Ubigeo:{" "}
          {cliente.ubigeo
            ? `${cliente.ubigeo.departamento} / ${cliente.ubigeo.provincia} / ${cliente.ubigeo.distrito}`
            : "—"}
        </p>
        <p>Nacionalidad: {cliente.nacionalidad ?? "—"}</p>
        <p>Uso del servicio: {cliente.usoServicio ?? "—"}</p>
        <p>Condición: {cliente.condicionCliente ?? "—"}</p>
        <p>
          Tipo de acción:{" "}
          {cliente.tipoAccion ? TIPO_ACCION_LABELS[cliente.tipoAccion] : "—"}
        </p>
        <p>
          Fijo / No fijo:{" "}
          {cliente.tipoInstalacion
            ? TIPO_INSTALACION_LABELS[cliente.tipoInstalacion]
            : "—"}
        </p>
        <p>
          Fecha y hora de instalación:{" "}
          {cliente.fechaHoraInstalacion
            ? new Date(cliente.fechaHoraInstalacion).toLocaleString("es-PE")
            : "—"}
        </p>
        <p>
          Plan:{" "}
          {cliente.planTarifario ? PLAN_LABELS[cliente.planTarifario] : "—"}
        </p>
        <p>
          Pago mensual:{" "}
          {cliente.pagoMensual ? `S/ ${cliente.pagoMensual}` : "—"}
        </p>
        <p>
          Activo:{" "}
          {cliente.activo === null
            ? "Sin definir"
            : cliente.activo
              ? "Sí"
              : "No"}
        </p>
        <p>
          Derecho de instalación:{" "}
          {cliente.tieneCostoInstalacion
            ? `S/ ${cliente.derechoInstalacion} (definido por el trabajador)`
            : "No aplica"}
        </p>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {puedeCompletarInstalacion && (
          <InstalacionForm
            idCliente={cliente.idCliente}
            activoActual={cliente.activo}
          />
        )}
      </div>

      <ClienteDetalle
        idCliente={cliente.idCliente}
        telefonos={cliente.telefonos}
        documentos={cliente.documentos}
      />
    </Shell>
  );
}
