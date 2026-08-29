"use client";

import { useTransition, useState } from "react";
import { crearSolicitudTransferencia } from "@/app/solicitudes/actions";

type Trabajador = {
  idUsuario: number;
  nombre: string;
};

const selectClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30";

const labelClass =
  "block font-mono text-[11px] uppercase tracking-wider text-slate-500 mb-1.5";

export default function SolicitarTransferenciaForm({
  trabajadoresPropios,
  todosTrabajadores,
}: {
  trabajadoresPropios: Trabajador[];
  todosTrabajadores: Trabajador[];
}) {
  const [isPending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    setMensaje(null);

    const origen = Number(formData.get("origen"));
    const destino = Number(formData.get("destino"));
    const comentario = formData.get("comentario") as string;

    if (!origen || !destino) {
      setError("Selecciona el trabajador de origen y destino");
      return;
    }

    if (origen === destino) {
      setError("El trabajador de origen y destino no pueden ser el mismo");
      return;
    }

    startTransition(async () => {
      try {
        await crearSolicitudTransferencia(origen, destino, comentario);

        setMensaje("Solicitud de transferencia enviada al jefe.");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al enviar la solicitud",
        );
      }
    });
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="mb-4 text-sm font-mono uppercase tracking-wider text-slate-400">
        Transferir clientes
      </h2>

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
          <label className={labelClass}>De (tu trabajador)</label>

          <select
            name="origen"
            required
            defaultValue=""
            className={selectClass}
          >
            <option value="" disabled>
              Selecciona...
            </option>

            {trabajadoresPropios.map((t) => (
              <option key={t.idUsuario} value={t.idUsuario}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>A (trabajador destino)</label>

          <select
            name="destino"
            required
            defaultValue=""
            className={selectClass}
          >
            <option value="" disabled>
              Selecciona...
            </option>

            {todosTrabajadores.map((t) => (
              <option key={t.idUsuario} value={t.idUsuario}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>

        <input
          name="comentario"
          placeholder="Motivo (opcional)"
          className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
        />

        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Enviando..." : "Enviar solicitud"}
        </button>
      </form>
    </section>
  );
}
