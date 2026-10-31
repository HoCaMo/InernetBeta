"use client";

import { useTransition, useState } from "react";
import {
  resolverSolicitudCliente,
  resolverSolicitudServicio,
  resolverSolicitudTransferencia,
  resolverSolicitudTrabajador,
  resolverSolicitudTrabajadorGestion,
} from "./actions";

type SolicitudConRelaciones = {
  idSolicitud: number;
  tipo: string;
  estado: string;
  fechaSolicitud: string | Date;
  comentario: string | null;
  datosPropuestos: unknown;
  solicitante: { nombre: string; rol: string };
  resolutor: { nombre: string } | null;
  cliente: { nombre: string; apellido: string | null } | null;
};

const estadoBadge: Record<string, string> = {
  PENDIENTE: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  ACEPTADA: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  RECHAZADA: "bg-red-500/15 text-red-400 border-red-500/30",
};

const tipoLabel: Record<string, string> = {
  CREACION_CLIENTE: "Nuevo cliente",
  EDICION_CLIENTE: "Editar cliente",
  ELIMINACION_CLIENTE: "Eliminar cliente",
  CAMBIO_SERVICIO: "Cambiar plan / precio / fechas de pago",
  NUEVO_SERVICIO: "Agregar otro plan",
  TRANSFERENCIA_CLIENTES: "Transferencia de clientes",
  CREACION_TRABAJADOR: "Nuevo trabajador",
  EDICION_TRABAJADOR: "Editar trabajador",
  ELIMINACION_TRABAJADOR: "Eliminar trabajador",
  CAMBIO_SUPERVISOR_TRABAJADOR: "Cambiar de administrador",
};

// Tipos que solo puede resolver el Jefe
const SOLO_JEFE = new Set([
  "TRANSFERENCIA_CLIENTES",
  "CREACION_TRABAJADOR",
  "EDICION_TRABAJADOR",
  "ELIMINACION_TRABAJADOR",
  "CAMBIO_SUPERVISOR_TRABAJADOR",
]);

const dinero = (v: unknown) => `S/ ${Number(v).toFixed(2)}`;

const ETIQUETAS_CAMPO: Record<string, string> = {
  nombre: "Nombre",
  apellido: "Apellido",
  correo: "Correo",
  direccion: "Domicilio",
  telefono: "Teléfono",
  tipoDocumento: "Tipo de documento",
  numeroDocumento: "N.° de documento",
};

function resumenPropuesta(s: SolicitudConRelaciones): string | null {
  const datos = s.datosPropuestos as Record<string, unknown> | null;

  if (
    (s.tipo === "EDICION_CLIENTE" || s.tipo === "EDICION_TRABAJADOR") &&
    datos
  ) {
    return Object.entries(datos)
      .map(([k, v]) => `${ETIQUETAS_CAMPO[k] ?? k}: ${v}`)
      .join(" · ");
  }

  if (s.tipo === "CAMBIO_SERVICIO" && datos) {
    const partes: string[] = [];
    if (typeof datos.planNombre === "string")
      partes.push(`Plan → ${datos.planNombre}`);
    if (typeof datos.precioMensual === "number")
      partes.push(`Precio → ${dinero(datos.precioMensual)}`);
    if (typeof datos.diaCobro === "number")
      partes.push(`Cobro → día ${datos.diaCobro}`);
    if ("diaVencimiento" in datos) {
      partes.push(
        datos.diaVencimiento == null
          ? "Vence → penúltimo día"
          : `Vence → día ${datos.diaVencimiento}`,
      );
    }
    return partes.join(" · ");
  }

  if (s.tipo === "NUEVO_SERVICIO" && datos) {
    const partes: string[] = [];
    if (typeof datos.planNombre === "string")
      partes.push(`Plan ${datos.planNombre}`);
    if (datos.fechaHoraInstalacion)
      partes.push(
        `Instalación ${new Date(String(datos.fechaHoraInstalacion)).toLocaleString("es-PE")}`,
      );
    if (datos.tieneCostoInstalacion)
      partes.push(`Derecho ${dinero(datos.derechoInstalacion)}`);
    if (datos.tieneServicioAdicional)
      partes.push(
        `Adicional: ${datos.servicioAdicionalDetalle} (${dinero(datos.servicioAdicionalPrecio)})`,
      );
    return partes.join(" · ");
  }

  return s.comentario;
}

export default function SolicitudesManager({
  solicitudes,
  rolActual,
}: {
  solicitudes: SolicitudConRelaciones[];
  rolActual: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function puedeResolver(s: SolicitudConRelaciones) {
    if (s.estado !== "PENDIENTE") return false;
    if (SOLO_JEFE.has(s.tipo)) return rolActual === "JEFE";
    // Lo pedido por un administrador solo lo resuelve el jefe (nadie se auto-aprueba)
    if (s.solicitante.rol === "ADMINISTRADOR") return rolActual === "JEFE";
    return rolActual === "ADMINISTRADOR" || rolActual === "JEFE";
  }

  function resolver(
    s: SolicitudConRelaciones,
    decision: "ACEPTADA" | "RECHAZADA",
  ) {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        let res: { ok: boolean; error?: string };
        if (
          s.tipo === "CREACION_CLIENTE" ||
          s.tipo === "EDICION_CLIENTE" ||
          s.tipo === "ELIMINACION_CLIENTE"
        ) {
          res = await resolverSolicitudCliente(s.idSolicitud, decision);
        } else if (
          s.tipo === "CAMBIO_SERVICIO" ||
          s.tipo === "NUEVO_SERVICIO"
        ) {
          res = await resolverSolicitudServicio(s.idSolicitud, decision);
        } else if (s.tipo === "TRANSFERENCIA_CLIENTES") {
          res = await resolverSolicitudTransferencia(s.idSolicitud, decision);
        } else if (s.tipo === "CREACION_TRABAJADOR") {
          res = await resolverSolicitudTrabajador(s.idSolicitud, decision);
        } else {
          res = await resolverSolicitudTrabajadorGestion(
            s.idSolicitud,
            decision,
          );
        }
        if (!res.ok)
          setErrorMsg(res.error ?? "No se pudo resolver la solicitud");
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : "Error al resolver la solicitud",
        );
      }
    });
  }

  return (
    <div>
      {errorMsg && (
        <p className="mb-4 rounded-lg border-l-2 border-red-500 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {errorMsg}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-500">
            <tr className="text-left font-mono text-[11px] uppercase tracking-wider">
              <th className="px-4 py-2.5">Tipo</th>
              <th className="px-4 py-2.5">Detalle</th>
              <th className="px-4 py-2.5">Solicitante</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5">Resuelto por</th>
              <th className="px-4 py-2.5">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => {
              const resumen = resumenPropuesta(s);
              return (
                <tr
                  key={s.idSolicitud}
                  className="border-t border-slate-800 align-top text-slate-200"
                >
                  <td className="px-4 py-2.5">{tipoLabel[s.tipo] ?? s.tipo}</td>
                  <td className="max-w-sm px-4 py-2.5">
                    <div className="text-slate-300">
                      {s.cliente
                        ? `${s.cliente.nombre} ${s.cliente.apellido ?? ""}`
                        : "—"}
                    </div>
                    {resumen && (
                      <div className="mt-0.5 text-xs text-slate-500">
                        {resumen}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">
                    {s.solicitante.nombre}{" "}
                    <span className="text-slate-600">
                      ({s.solicitante.rol})
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs ${estadoBadge[s.estado]}`}
                    >
                      {s.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">
                    {s.resolutor?.nombre ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {puedeResolver(s) ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => resolver(s, "ACEPTADA")}
                          disabled={isPending}
                          className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/25 disabled:opacity-50"
                        >
                          Aceptar
                        </button>
                        <button
                          onClick={() => resolver(s, "RECHAZADA")}
                          disabled={isPending}
                          className="rounded-lg bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-400 transition hover:bg-red-500/25 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {solicitudes.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  No hay solicitudes para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
