"use client";

import { useTransition, useState } from "react";
import {
  crearSolicitudEdicionCliente,
  crearSolicitudEliminacionCliente,
} from "@/app/solicitudes/actions";

type ClienteActual = {
  idCliente: number;
  nombre: string;
  apellido: string | null;
  correo: string | null;
  direccion: string | null;
};

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30";
const labelClass =
  "block font-mono text-[11px] uppercase tracking-wider text-slate-500 mb-1";

export default function EditarClienteForm({
  cliente,
}: {
  cliente: ClienteActual;
}) {
  const [isPending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mostrarEliminar, setMostrarEliminar] = useState(false);

  const [nombre, setNombre] = useState(cliente.nombre);
  const [apellido, setApellido] = useState(cliente.apellido ?? "");
  const [correo, setCorreo] = useState(cliente.correo ?? "");
  const [direccion, setDireccion] = useState(cliente.direccion ?? "");

  // --- Vista previa en vivo de qué campos cambiarían ---
  const cambios: { campo: string; antes: string; despues: string }[] = [];
  if (nombre !== cliente.nombre)
    cambios.push({ campo: "Nombre", antes: cliente.nombre, despues: nombre });
  if (apellido !== (cliente.apellido ?? ""))
    cambios.push({
      campo: "Apellido",
      antes: cliente.apellido ?? "—",
      despues: apellido,
    });
  if (correo !== (cliente.correo ?? ""))
    cambios.push({
      campo: "Correo",
      antes: cliente.correo ?? "—",
      despues: correo,
    });
  if (direccion !== (cliente.direccion ?? ""))
    cambios.push({
      campo: "Domicilio",
      antes: cliente.direccion ?? "—",
      despues: direccion,
    });

  function handleSubmit(formData: FormData) {
    setError(null);
    setMensaje(null);
    if (cambios.length === 0) {
      setError("No hiciste ningún cambio respecto a los datos actuales.");
      return;
    }
    startTransition(async () => {
      try {
        await crearSolicitudEdicionCliente(cliente.idCliente, formData);
        setMensaje(
          "Solicitud de edición enviada. Un administrador o el jefe la revisará.",
        );
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
        await crearSolicitudEliminacionCliente(cliente.idCliente);
        setMensaje(
          "Solicitud de eliminación enviada. Un administrador o el jefe la revisará.",
        );
        setMostrarEliminar(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al enviar la solicitud",
        );
      }
    });
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="mb-1 text-sm font-mono uppercase tracking-wider text-amber-500">
        Solicitar edición de este cliente
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Los cambios no se aplican de inmediato: se envían como solicitud para
        que un administrador o el jefe los revise.
      </p>

      {mensaje && (
        <p className="mb-3 rounded-lg border-l-2 border-emerald-500 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          {mensaje}
        </p>
      )}
      {error && (
        <p className="mb-3 rounded-lg border-l-2 border-red-500 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}

      <form action={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClass}>Nombre</label>
          <input
            name="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Apellido</label>
          <input
            name="apellido"
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Correo</label>
          <input
            name="correo"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Domicilio de instalación</label>
          <input
            name="domicilioInstalacion"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* --- Vista previa: qué parte del cliente se va a editar --- */}
        {cambios.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="mb-2 text-xs font-medium text-amber-400">
              Se va a solicitar el siguiente cambio:
            </p>
            <ul className="space-y-1 text-xs text-slate-300">
              {cambios.map((c) => (
                <li key={c.campo}>
                  <span className="text-slate-500">{c.campo}:</span> {c.antes} →{" "}
                  <span className="text-amber-400">{c.despues}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || cambios.length === 0}
          className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Enviando..." : "Enviar solicitud de edición"}
        </button>
      </form>

      <div className="mt-4 border-t border-slate-800 pt-4">
        {!mostrarEliminar ? (
          <button
            onClick={() => setMostrarEliminar(true)}
            className="text-xs text-red-400 hover:text-red-300"
          >
            Solicitar eliminación de este cliente
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-400">
              ¿Confirmas solicitar la eliminación?
            </p>
            <button
              onClick={handleEliminar}
              disabled={isPending}
              className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/25"
            >
              Sí, solicitar
            </button>
            <button
              onClick={() => setMostrarEliminar(false)}
              className="text-xs text-slate-500 hover:text-slate-400"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
