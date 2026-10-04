import { prisma } from "@/app/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ClienteDetalle from "./ClienteDetalle";
import InstalacionForm from "./InstalacionForm";
import EditarClienteForm from "./EditarClienteForm";
import Shell from "@/app/components/Shell";
import Link from "next/link";
import {
  PLAN_LABELS,
  TIPO_ACCION_LABELS,
  TIPO_INSTALACION_LABELS,
} from "@/app/lib/constantes";

const estadoPagoBadge: Record<string, string> = {
  PENDIENTE: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  PAGADO: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  VENCIDO: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default async function ClienteDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id } = await params;
  const idCliente = Number(id);

  const cliente = await prisma.cliente.findUnique({
    where: { idCliente },
    include: {
      telefonos: true,
      documentos: true,
      ubigeo: true,
      pagos: {
        orderBy: { periodo: "asc" },
      },
      asignadoA: {
        select: {
          idUsuario: true,
          nombre: true,
          idSupervisor: true,
        },
      },
    },
  });

  if (!cliente) {
    return (
      <Shell nombre={session.user.name ?? ""} rol={session.user.rol}>
        <p className="text-slate-400">Cliente no encontrado.</p>
      </Shell>
    );
  }

  // Quién puede ver/editar este cliente:
  const esTrabajadorDueño =
    session.user.rol === "TRABAJADOR" &&
    cliente.idAsignadoA === session.user.idUsuario;
  const esAdministradorSupervisor =
    session.user.rol === "ADMINISTRADOR" &&
    cliente.asignadoA?.idSupervisor === session.user.idUsuario;
  const esJefe = session.user.rol === "JEFE";

  if (!esTrabajadorDueño && !esAdministradorSupervisor && !esJefe) {
    return (
      <Shell nombre={session.user.name ?? ""} rol={session.user.rol}>
        <p className="text-slate-400">No tienes acceso a este cliente.</p>
      </Shell>
    );
  }

  const puedeCompletarInstalacion =
    session.user.rol === "ADMINISTRADOR" || session.user.rol === "JEFE";
  const puedeSolicitarEdicion = esTrabajadorDueño || esAdministradorSupervisor;

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
      <p className="text-xs text-slate-500">
        Trabajador asignado: {cliente.asignadoA?.nombre ?? "—"}
      </p>

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
          {cliente.pagoMensual
            ? `S/ ${Number(cliente.pagoMensual).toFixed(2)}`
            : "—"}
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
          Derecho de instalación (¿se aplicó?):{" "}
          {cliente.tieneCostoInstalacion
            ? `Sí — S/ ${Number(cliente.derechoInstalacion).toFixed(2)}`
            : "No"}
        </p>
        <p>
          Teléfonos: {cliente.telefonos.map((t) => t.numero).join(", ") || "—"}
        </p>
        <p>
          Documento:{" "}
          {cliente.documentos
            .map((d) => `${d.tipoDocumento} ${d.numeroDocumento}`)
            .join(", ") || "—"}
        </p>
      </div>

      {/* --- Historial de pagos: días de pago y si pagó o no --- */}
      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-4 text-sm font-mono uppercase tracking-wider text-amber-500">
          Historial de pagos
        </h2>
        {cliente.pagos.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aún no hay recibos generados (se crean al aceptar la solicitud del
            cliente).
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-500">
                <tr className="text-left font-mono text-[11px] uppercase tracking-wider">
                  <th className="px-4 py-2.5">Periodo</th>
                  <th className="px-4 py-2.5">Concepto</th>
                  <th className="px-4 py-2.5">Monto</th>
                  <th className="px-4 py-2.5">Descuento</th>
                  <th className="px-4 py-2.5">Total</th>
                  <th className="px-4 py-2.5">Vence</th>
                  <th className="px-4 py-2.5">Pagado el</th>
                  <th className="px-4 py-2.5">Estado</th>
                </tr>
              </thead>
              <tbody>
                {cliente.pagos.map((p) => (
                  <tr
                    key={p.idPago}
                    className="border-t border-slate-800 text-slate-200"
                  >
                    <td className="px-4 py-2.5">{p.periodo}</td>
                    <td className="px-4 py-2.5 text-slate-400">{p.concepto}</td>
                    <td className="px-4 py-2.5">
                      S/ {Number(p.monto).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400">
                      {Number(p.descuento) > 0
                        ? `-S/ ${Number(p.descuento).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-medium">
                      S/ {Number(p.montoFinal).toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400">
                      {new Date(p.fechaVencimiento).toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400">
                      {p.fechaPago
                        ? new Date(p.fechaPago).toLocaleDateString("es-PE")
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs ${estadoPagoBadge[p.estado]}`}
                      >
                        {p.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {puedeCompletarInstalacion && (
          <InstalacionForm
            idCliente={cliente.idCliente}
            activoActual={cliente.activo}
          />
        )}
        {puedeSolicitarEdicion && (
          <EditarClienteForm
            cliente={{
              idCliente: cliente.idCliente,
              nombre: cliente.nombre,
              apellido: cliente.apellido,
              correo: cliente.correo,
              direccion: cliente.direccion,
            }}
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
