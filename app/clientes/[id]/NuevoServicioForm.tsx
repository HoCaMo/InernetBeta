"use client";

import { useState, useTransition } from "react";
import { crearSolicitudNuevoServicio } from "@/app/solicitudes/actions";
import CamposServicio from "@/app/components/CamposServicio";

export default function NuevoServicioForm({
  idCliente,
}: {
  idCliente: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reinicio, setReinicio] = useState(0);

  function handleSubmit(formData: FormData) {
    setError(null);
    setMensaje(null);
    startTransition(async () => {
      try {
        const res = await crearSolicitudNuevoServicio(idCliente, formData);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setMensaje(
          "Solicitud enviada. Un administrador o el jefe la revisará.",
        );
        setAbierto(false);
        setReinicio((r) => r + 1);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo enviar la solicitud",
        );
      }
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="mb-1 text-sm font-mono uppercase tracking-wider text-amber-500">
        Agregar otro plan
      </h2>
      <p className="mb-3 text-xs text-slate-500">
        El cliente conserva el mismo DNI y teléfono; el nuevo plan tendrá sus
        propios recibos.
      </p>
      {mensaje && <p className="mb-2 text-xs text-emerald-400">{mensaje}</p>}

      {!abierto ? (
        <button
          onClick={() => setAbierto(true)}
          className="rounded-lg border border-amber-500/40 px-4 py-2 text-sm text-amber-400 hover:bg-amber-500/10"
        >
          + Solicitar otro plan
        </button>
      ) : (
        <form action={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg border-l-2 border-red-500 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          <CamposServicio key={reinicio} />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-60"
            >
              {isPending ? "Enviando..." : "Enviar solicitud"}
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="text-sm text-slate-500 hover:text-slate-400"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
