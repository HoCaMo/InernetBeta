"use client";

import { useTransition, useState, useMemo } from "react";
import { crearSolicitudTransferencia } from "@/app/solicitudes/actions";

type Trabajador = { idUsuario: number; nombre: string };
type Cliente = {
  idCliente: number;
  nombre: string;
  apellido: string | null;
  idAsignadoA: number | null;
};

const selectClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30";
const labelClass =
  "block font-mono text-[11px] uppercase tracking-wider text-slate-500 mb-1.5";

export default function SolicitarTransferenciaForm({
  trabajadoresPropios,
  todosTrabajadores,
  clientes,
}: {
  trabajadoresPropios: Trabajador[];
  todosTrabajadores: Trabajador[];
  clientes: Cliente[];
}) {
  const [isPending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [seleccionados, setSeleccionados] = useState<number[]>([]);

  const clientesDelOrigen = useMemo(
    () => clientes.filter((c) => c.idAsignadoA === Number(origen)),
    [clientes, origen],
  );

  function toggleCliente(id: number) {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    setMensaje(null);
    const comentario = formData.get("comentario") as string;

    if (!origen || !destino) {
      setError("Selecciona el trabajador de origen y destino");
      return;
    }
    if (Number(origen) === Number(destino)) {
      setError("El trabajador de origen y destino no pueden ser el mismo");
      return;
    }
    if (seleccionados.length === 0) {
      setError("Selecciona al menos un cliente para transferir");
      return;
    }

    startTransition(async () => {
      try {
        await crearSolicitudTransferencia(
          Number(origen),
          Number(destino),
          seleccionados,
          comentario,
        );
        setMensaje(
          `Solicitud enviada al jefe para transferir ${seleccionados.length} cliente(s).`,
        );
        setSeleccionados([]);
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
            value={origen}
            onChange={(e) => {
              setOrigen(e.target.value);
              setSeleccionados([]);
            }}
            className={selectClass}
          >
            <option value="">Selecciona...</option>
            {trabajadoresPropios.map((t) => (
              <option key={t.idUsuario} value={t.idUsuario}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>

        {origen && (
          <div>
            <label className={labelClass}>
              Clientes a transferir ({seleccionados.length} seleccionado
              {seleccionados.length === 1 ? "" : "s"})
            </label>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/60 p-2">
              {clientesDelOrigen.length === 0 && (
                <p className="px-2 py-1 text-xs text-slate-500">
                  Este trabajador no tiene clientes asignados.
                </p>
              )}
              {clientesDelOrigen.map((c) => (
                <label
                  key={c.idCliente}
                  className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={seleccionados.includes(c.idCliente)}
                    onChange={() => toggleCliente(c.idCliente)}
                  />
                  {c.nombre} {c.apellido ?? ""}
                </label>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>A (trabajador destino)</label>
          <select
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            className={selectClass}
          >
            <option value="">Selecciona...</option>
            {todosTrabajadores
              .filter((t) => String(t.idUsuario) !== origen)
              .map((t) => (
                <option key={t.idUsuario} value={t.idUsuario}>
                  {t.nombre}
                </option>
              ))}
          </select>
        </div>

        <input
          name="comentario"
          placeholder="Motivo (opcional)"
          className={selectClass}
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
