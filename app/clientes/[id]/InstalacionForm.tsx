"use client";

import { useTransition, useState } from "react";
import { completarInstalacion } from "./actions";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30";
const labelClass =
  "block font-mono text-[11px] uppercase tracking-wider text-slate-500 mb-1.5";

export default function InstalacionForm({
  idCliente,
  activoActual,
}: {
  idCliente: number;
  activoActual: boolean | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    setMensaje(null);
    startTransition(async () => {
      try {
        await completarInstalacion(idCliente, formData);
        setMensaje("Estado actualizado. Se notificó al trabajador.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al guardar");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="mb-1 text-sm font-mono uppercase tracking-wider text-amber-500">
        Estado de activación
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        El derecho de instalación ya quedó definido al aceptar la solicitud del
        cliente.
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
          <label className={labelClass}>Activo</label>
          <select
            name="activo"
            defaultValue={activoActual ? "si" : "no"}
            className={inputClass}
          >
            <option value="no">No</option>
            <option value="si">Sí</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Guardando..." : "Guardar y notificar al trabajador"}
        </button>
      </form>
    </section>
  );
}
