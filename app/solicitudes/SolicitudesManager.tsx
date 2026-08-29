"use client";

import { useTransition, useState } from "react";
import {
  resolverSolicitudCliente,
  resolverSolicitudTransferencia,
  resolverSolicitudTrabajador,
} from "./actions";

type SolicitudConRelaciones = {
  idSolicitud: number;
  tipo: string;
  estado: string;
  fechaSolicitud: string | Date;
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
  EDICION_CLIENTE: "Edición de cliente",
  TRANSFERENCIA_CLIENTES: "Transferencia",
  CREACION_TRABAJADOR: "Nuevo trabajador",
};

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
    if (s.tipo === "CREACION_CLIENTE" || s.tipo === "EDICION_CLIENTE") {
      return rolActual === "ADMINISTRADOR" || rolActual === "JEFE";
    }
    if (
      s.tipo === "TRANSFERENCIA_CLIENTES" ||
      s.tipo === "CREACION_TRABAJADOR"
    ) {
      return rolActual === "JEFE";
    }
    return false;
  }

  function resolver(
    s: SolicitudConRelaciones,
    decision: "ACEPTADA" | "RECHAZADA",
  ) {
    setErrorMsg(null);

    startTransition(async () => {
      try {
        if (s.tipo === "CREACION_CLIENTE" || s.tipo === "EDICION_CLIENTE") {
          await resolverSolicitudCliente(s.idSolicitud, decision);
        } else if (s.tipo === "TRANSFERENCIA_CLIENTES") {
          await resolverSolicitudTransferencia(s.idSolicitud, decision);
        } else if (s.tipo === "CREACION_TRABAJADOR") {
          await resolverSolicitudTrabajador(s.idSolicitud, decision);
        }
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
      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-500">
            <tr className="text-left font-mono text-[11px] uppercase tracking-wider">
              <th className="px-4 py-2.5">Tipo</th>
              <th className="px-4 py-2.5">Cliente</th>
              <th className="px-4 py-2.5">Solicitante</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5">Resuelto por</th>
              <th className="px-4 py-2.5">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => (
              <tr
                key={s.idSolicitud}
                className="border-t border-slate-800 text-slate-200"
              >
                <td className="px-4 py-2.5">{tipoLabel[s.tipo] ?? s.tipo}</td>
                <td className="px-4 py-2.5 text-slate-400">
                  {s.cliente
                    ? `${s.cliente.nombre} ${s.cliente.apellido ?? ""}`
                    : "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-400">
                  {s.solicitante.nombre}{" "}
                  <span className="text-slate-600">({s.solicitante.rol})</span>
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
            ))}
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
