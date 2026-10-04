"use client";

import { useTransition, useState } from "react";
import {
  crearSolicitudEditarTrabajador,
  crearSolicitudEliminarTrabajador,
  crearSolicitudCambiarSupervisor,
} from "@/app/solicitudes/actions";

type Trabajador = {
  idUsuario: number;
  nombre: string;
  correo: string;
  telefono: string | null;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
};
type Administrador = { idUsuario: number; nombre: string };

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-xs text-white outline-none transition focus:border-amber-500";

export default function GestionTrabajadorItem({
  trabajador,
  otrosAdministradores,
}: {
  trabajador: Trabajador;
  otrosAdministradores: Administrador[];
}) {
  const [isPending, startTransition] = useTransition();
  const [accion, setAccion] = useState<
    "editar" | "eliminar" | "cambiar" | null
  >(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleEditar(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await crearSolicitudEditarTrabajador(trabajador.idUsuario, formData);
        setMensaje("Solicitud de edición enviada al jefe.");
        setAccion(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al enviar la solicitud",
        );
      }
    });
  }

  function handleEliminar() {
    setError(null);
    startTransition(async () => {
      try {
        await crearSolicitudEliminarTrabajador(trabajador.idUsuario);
        setMensaje("Solicitud de eliminación enviada al jefe.");
        setAccion(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al enviar la solicitud",
        );
      }
    });
  }

  function handleCambiar(formData: FormData) {
    setError(null);
    const idNuevo = Number(formData.get("idNuevoAdministrador"));
    if (!idNuevo) {
      setError("Selecciona el administrador destino");
      return;
    }
    startTransition(async () => {
      try {
        await crearSolicitudCambiarSupervisor(trabajador.idUsuario, idNuevo);
        setMensaje("Solicitud de cambio de administrador enviada al jefe.");
        setAccion(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al enviar la solicitud",
        );
      }
    });
  }

  return (
    <div className="border-t border-slate-800 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-200">{trabajador.nombre}</p>
          <p className="text-xs text-slate-500">
            {trabajador.correo} · {trabajador.telefono ?? "—"} ·{" "}
            {trabajador.tipoDocumento
              ? `${trabajador.tipoDocumento} ${trabajador.numeroDocumento}`
              : "sin documento"}
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => setAccion(accion === "editar" ? null : "editar")}
            className="text-amber-500 hover:text-amber-400"
          >
            Editar
          </button>
          <button
            onClick={() => setAccion(accion === "cambiar" ? null : "cambiar")}
            className="text-amber-500 hover:text-amber-400"
          >
            Pasar a otro admin
          </button>
          <button
            onClick={() => setAccion(accion === "eliminar" ? null : "eliminar")}
            className="text-red-400 hover:text-red-300"
          >
            Eliminar
          </button>
        </div>
      </div>

      {mensaje && <p className="mt-2 text-xs text-emerald-400">{mensaje}</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {accion === "editar" && (
        <form
          action={handleEditar}
          className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5"
        >
          <input
            name="nombre"
            placeholder="Nombre"
            defaultValue={trabajador.nombre}
            className={inputClass}
          />
          <input
            name="correo"
            placeholder="Correo"
            defaultValue={trabajador.correo}
            className={inputClass}
          />
          <select
            name="tipoDocumento"
            defaultValue={trabajador.tipoDocumento ?? "DNI"}
            className={inputClass}
          >
            <option value="DNI">DNI</option>
            <option value="PASAPORTE">Pasaporte</option>
            <option value="CE">CE</option>
            <option value="RUC">RUC</option>
          </select>
          <input
            name="numeroDocumento"
            placeholder="N.° documento"
            defaultValue={trabajador.numeroDocumento ?? ""}
            className={inputClass}
          />
          <input
            name="telefono"
            placeholder="Celular"
            defaultValue={trabajador.telefono ?? ""}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={isPending}
            className="col-span-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-amber-400 sm:col-span-5"
          >
            Enviar solicitud de edición
          </button>
        </form>
      )}

      {accion === "cambiar" && (
        <form action={handleCambiar} className="mt-2 flex flex-wrap gap-2">
          <select name="idNuevoAdministrador" required className={inputClass}>
            <option value="">Selecciona administrador...</option>
            {otrosAdministradores.map((a) => (
              <option key={a.idUsuario} value={a.idUsuario}>
                {a.nombre}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-amber-400"
          >
            Enviar solicitud
          </button>
        </form>
      )}

      {accion === "eliminar" && (
        <div className="mt-2 flex items-center gap-2">
          <p className="text-xs text-slate-400">
            ¿Confirmas solicitar la eliminación de este trabajador?
          </p>
          <button
            onClick={handleEliminar}
            disabled={isPending}
            className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/25"
          >
            Sí, solicitar
          </button>
        </div>
      )}
    </div>
  );
}
