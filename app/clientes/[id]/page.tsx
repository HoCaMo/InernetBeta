import { prisma } from "@/app/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import InstalacionForm from "./InstalacionForm";
import EditarClienteForm from "./EditarClienteForm";
import CambiarServicioForm from "./CambiarServicioForm";
import NuevoServicioForm from "./NuevoServicioForm";
import FichaCliente from "./FichaCliente";
import MapaClientes from "@/app/ubigeo/mapa/MapaClientes";
import Shell from "@/app/components/Shell";
import Link from "next/link";
import {
  TIPO_ACCION_LABELS,
  TIPO_INSTALACION_LABELS,
} from "@/app/lib/constantes";
import { planesDisponibles } from "@/app/lib/planes";
import { diasDelMes } from "@/app/lib/facturacion";

const estadoPagoBadge: Record<string, string> = {
  PENDIENTE: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  PAGADO: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  VENCIDO: "bg-red-500/15 text-red-400 border-red-500/30",
};

const fecha = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("es-PE") : "—";
const dinero = (v: unknown) => `S/ ${Number(v).toFixed(2)}`;

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const idCliente = Number(id);

  if (Number.isNaN(idCliente)) {
    return (
      <Shell nombre={session.user.name ?? ""} rol={session.user.rol}>
        <p className="text-slate-400">
          El identificador del cliente no es válido.
        </p>
      </Shell>
    );
  }

  const cliente = await prisma.cliente.findUnique({
    where: { idCliente },
    include: {
      telefonos: { orderBy: { idTelefono: "asc" } },
      documentos: { orderBy: { idDocumento: "asc" } },
      ubigeo: true,
      servicios: {
        orderBy: { idServicio: "asc" },
        include: { pagos: { orderBy: { periodo: "asc" } } },
      },
      asignadoA: {
        select: {
          idUsuario: true,
          nombre: true,
          idSupervisor: true,
          supervisor: { select: { nombre: true } },
        },
      },
      creadoPor: { select: { nombre: true } },
    },
  });

  if (!cliente) {
    return (
      <Shell nombre={session.user.name ?? ""} rol={session.user.rol}>
        <p className="text-slate-400">Cliente no encontrado.</p>
      </Shell>
    );
  }

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
  const puedeSolicitarPlanes =
    puedeSolicitarEdicion && cliente.estadoAprobacion === "ACEPTADO";
  const planes = puedeSolicitarPlanes
    ? await planesDisponibles(session.user.idUsuario, session.user.rol)
    : [];

  // Día de vencimiento como NÚMERO (si no es fijo, el penúltimo día del mes correspondiente)
  const hoy = new Date();
  const penultimoEsteMes = diasDelMes(hoy.getFullYear(), hoy.getMonth()) - 1;
  const diaVencimiento = (s: (typeof cliente.servicios)[number]) => {
    if (s.diaVencimiento) return s.diaVencimiento;
    const pendiente = s.pagos.find((p) => p.estado !== "PAGADO");
    return pendiente
      ? new Date(pendiente.fechaVencimiento).getDate()
      : penultimoEsteMes;
  };

  const telefonoPrincipal =
    cliente.telefonos.find((t) => t.principal)?.numero ??
    cliente.telefonos[0]?.numero ??
    null;
  const documento = cliente.documentos[0] ?? null;

  // =========== PESTAÑA 1: información del cliente + mapa ===========
  const info = (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-3 text-sm font-mono uppercase tracking-wider text-amber-500">
          Datos del cliente
        </h2>
        <div className="grid gap-x-8 gap-y-1.5 text-sm text-slate-400 sm:grid-cols-2">
          <p>
            Tipo: {cliente.tipoCliente} — Estado: {cliente.estadoAprobacion}
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
            Documento:{" "}
            {cliente.documentos
              .map((d) => `${d.tipoDocumento} ${d.numeroDocumento}`)
              .join(", ") || "—"}
          </p>
          <p>
            Teléfonos:{" "}
            {cliente.telefonos.map((t) => t.numero).join(", ") || "—"}
          </p>
          <p>Correo: {cliente.correo ?? "—"}</p>
          <p>Nacionalidad: {cliente.nacionalidad ?? "—"}</p>
          <p className="sm:col-span-2">Domicilio: {cliente.direccion ?? "—"}</p>
          <p className="sm:col-span-2">
            Ubigeo:{" "}
            {cliente.ubigeo
              ? `${cliente.ubigeo.departamento} / ${cliente.ubigeo.provincia} / ${cliente.ubigeo.distrito}`
              : "—"}
          </p>
          <p>Uso del servicio: {cliente.usoServicio ?? "—"}</p>
          <p>Condición: {cliente.condicionCliente ?? "—"}</p>
        </div>
      </section>

      {cliente.latitud && cliente.longitud ? (
        <section>
          <h2 className="mb-3 text-sm font-mono uppercase tracking-wider text-amber-500">
            Ubicación exacta
          </h2>
          <MapaClientes
            marcadores={[
              {
                id: cliente.idCliente,
                lat: Number(cliente.latitud),
                lng: Number(cliente.longitud),
                popup: `<strong>${cliente.nombre} ${cliente.apellido ?? ""}</strong><br/>${cliente.direccion ?? ""}`,
              },
            ]}
          />
        </section>
      ) : (
        <p className="text-sm text-slate-500">
          Este cliente no tiene ubicación registrada en el mapa.
        </p>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-3 text-sm font-mono uppercase tracking-wider text-amber-500">
          Fechas de pago
        </h2>
        {cliente.servicios.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no tiene planes.</p>
        ) : (
          <ul className="space-y-1.5 text-sm text-slate-300">
            {cliente.servicios.map((s) => (
              <li key={s.idServicio}>
                <span className="text-slate-200">{s.planNombre ?? "—"}</span>
                <span className="text-slate-400">
                  {" "}
                  · Cobro: día {s.diaCobro} · Vence: día {diaVencimiento(s)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );

  // =========== PESTAÑA 2: planes y agregar plan ===========
  const pestañaPlanes = (
    <div className="space-y-6">
      {cliente.servicios.length === 0 && (
        <p className="text-sm text-slate-500">
          Este cliente aún no tiene planes registrados.
        </p>
      )}

      {cliente.servicios.map((s, i) => (
        <section
          key={s.idServicio}
          className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
        >
          <h2 className="text-sm font-mono uppercase tracking-wider text-amber-500">
            Plan {i + 1}: {s.planNombre ?? "—"} — {dinero(s.precioMensual)}/mes
          </h2>

          <div className="mt-3 grid gap-x-8 gap-y-1 text-sm text-slate-400 sm:grid-cols-2">
            <p>Día de cobro: {s.diaCobro}</p>
            <p>Vence: día {diaVencimiento(s)}</p>
            <p>
              Instalación:{" "}
              {s.fechaHoraInstalacion
                ? new Date(s.fechaHoraInstalacion).toLocaleString("es-PE")
                : "—"}
            </p>
            <p>
              Tipo de acción:{" "}
              {s.tipoAccion ? TIPO_ACCION_LABELS[s.tipoAccion] : "—"}
            </p>
            <p>
              Fijo / No fijo:{" "}
              {s.tipoInstalacion
                ? TIPO_INSTALACION_LABELS[s.tipoInstalacion]
                : "—"}
            </p>
            <p>
              Derecho de instalación:{" "}
              {s.tieneCostoInstalacion
                ? `Sí — ${dinero(s.derechoInstalacion)}`
                : "No"}
            </p>
            <p className="sm:col-span-2">
              Servicio adicional:{" "}
              {s.tieneServicioAdicional
                ? `${s.servicioAdicionalDetalle} — ${dinero(s.servicioAdicionalPrecio)}`
                : "No"}
            </p>
          </div>

          <h3 className="mb-2 mt-5 text-xs font-mono uppercase tracking-wider text-slate-500">
            Historial de pagos
          </h3>
          {s.pagos.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aún no hay recibos (se crean al aceptar la solicitud).
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-slate-500">
                  <tr className="text-left font-mono text-[11px] uppercase tracking-wider">
                    <th className="px-3 py-2.5">Periodo</th>
                    <th className="px-3 py-2.5">Concepto</th>
                    <th className="px-3 py-2.5">Cobro</th>
                    <th className="px-3 py-2.5">Vence</th>
                    <th className="px-3 py-2.5">Monto</th>
                    <th className="px-3 py-2.5">Desc.</th>
                    <th className="px-3 py-2.5">Total</th>
                    <th className="px-3 py-2.5">Pagado el</th>
                    <th className="px-3 py-2.5">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {s.pagos.map((p) => (
                    <tr
                      key={p.idPago}
                      className="border-t border-slate-800 text-slate-200"
                    >
                      <td className="px-3 py-2.5">{p.periodo}</td>
                      <td className="px-3 py-2.5 text-slate-400">
                        {p.concepto}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">
                        {fecha(p.fechaCobro)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">
                        {fecha(p.fechaVencimiento)}
                      </td>
                      <td className="px-3 py-2.5">{dinero(p.monto)}</td>
                      <td className="px-3 py-2.5 text-slate-400">
                        {Number(p.descuento) > 0
                          ? `-${dinero(p.descuento)}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-medium">
                        {dinero(p.montoFinal)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">
                        {fecha(p.fechaPago)}
                      </td>
                      <td className="px-3 py-2.5">
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

          {puedeSolicitarPlanes && (
            <CambiarServicioForm
              planes={planes}
              servicio={{
                idServicio: s.idServicio,
                idPlan: s.idPlan,
                planNombre: s.planNombre,
                precioMensual: Number(s.precioMensual),
                diaCobro: s.diaCobro,
                diaVencimiento: s.diaVencimiento,
              }}
            />
          )}
        </section>
      ))}

      {puedeSolicitarPlanes ? (
        <NuevoServicioForm idCliente={cliente.idCliente} planes={planes} />
      ) : (
        puedeSolicitarEdicion && (
          <p className="text-sm text-slate-500">
            Podrás agregar otro plan cuando el cliente sea aceptado.
          </p>
        )
      )}
    </div>
  );

  // =========== PESTAÑA 3: edición del cliente (incluye teléfono y documento) ===========
  const edicion = (
    <div className="grid gap-6 md:grid-cols-2">
      {puedeSolicitarEdicion && (
        <EditarClienteForm
          cliente={{
            idCliente: cliente.idCliente,
            nombre: cliente.nombre,
            apellido: cliente.apellido,
            correo: cliente.correo,
            direccion: cliente.direccion,
            telefono: telefonoPrincipal,
            tipoDocumento: documento?.tipoDocumento ?? null,
            numeroDocumento: documento?.numeroDocumento ?? null,
          }}
        />
      )}
      {puedeCompletarInstalacion && (
        <InstalacionForm
          idCliente={cliente.idCliente}
          activoActual={cliente.activo}
        />
      )}
      {!puedeSolicitarEdicion && (
        <p className="text-sm text-slate-500">
          El jefe no pide ediciones: revisa y aprueba las solicitudes desde la
          sección Solicitudes.
        </p>
      )}
    </div>
  );

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
        Creado por: {cliente.creadoPor?.nombre ?? "—"} · Trabajador asignado:{" "}
        {cliente.asignadoA?.nombre ?? "—"} · Administrador:{" "}
        {cliente.asignadoA?.supervisor?.nombre ?? "—"}
      </p>

      <FichaCliente
        info={info}
        planes={pestañaPlanes}
        edicion={edicion}
        totalPlanes={cliente.servicios.length}
      />
    </Shell>
  );
}
