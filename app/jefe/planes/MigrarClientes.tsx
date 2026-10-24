"use client";

import { useMemo, useState, useTransition } from "react";
import { migrarClientesAPlan } from "./actions";

type PlanOpcion = { idPlan: number; nombre: string; precioMensual: number };
type ServicioFila = {
  idServicio: number;
  idPlan: number | null;
  cliente: string;
  planActual: string | null;
  precioActual: number;
  trabajador: string | null;
  administrador: string | null;
};

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30";
const labelClass =
  "block font-mono text-[11px] uppercase tracking-wider text-slate-500 mb-1";

export default function MigrarClientes({
  planes,
  servicios,
}: {
  planes: PlanOpcion[];
  servicios: ServicioFila[];
}) {
  const [isPending, startTransition] = useTransition();
  const [idPlanDestino, setIdPlanDestino] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionados, setSeleccionados] = useState<number[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const planDestino = planes.find((p) => String(p.idPlan) === idPlanDestino);
  const yaTiene = (s: ServicioFila) =>
    idPlanDestino !== "" && String(s.idPlan) === idPlanDestino;

  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return servicios;
    return servicios.filter((s) =>
      [s.cliente, s.planActual, s.trabajador, s.administrador].some((v) =>
        (v ?? "").toLowerCase().includes(t),
      ),
    );
  }, [servicios, busqueda]);

  const seleccionables = filtrados.filter((s) => !yaTiene(s));
  const todosMarcados =
    seleccionables.length > 0 &&
    seleccionables.every((s) => seleccionados.includes(s.idServicio));

  function alternar(id: number) {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function alternarTodos() {
    const ids = seleccionables.map((s) => s.idServicio);
    setSeleccionados((prev) =>
      todosMarcados
        ? prev.filter((id) => !ids.includes(id))
        : Array.from(new Set([...prev, ...ids])),
    );
  }

  const validos = seleccionados.filter((id) =>
    servicios.some((s) => s.idServicio === id && !yaTiene(s)),
  );

  function aplicar() {
    setError(null);
    setMensaje(null);
    if (!planDestino) {
      setError("Elige el plan al que se van a cambiar.");
      return;
    }
    if (validos.length === 0) {
      setError("Selecciona al menos un cliente.");
      return;
    }
    if (
      !window.confirm(
        `¿Cambiar ${validos.length} cliente(s) al plan ${planDestino.nombre} (S/ ${planDestino.precioMensual.toFixed(2)}/mes)? Se notificará a sus administradores y trabajadores.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        const res = await migrarClientesAPlan(planDestino.idPlan, validos);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setMensaje(res.mensaje ?? "Listo.");
        setSeleccionados([]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo completar el cambio",
        );
      }
    });
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="mb-1 text-sm font-mono uppercase tracking-wider text-amber-500">
        Pasar clientes a un plan actualizado
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Elige el plan, marca uno o varios clientes y confirma. El nuevo precio
        aplica a los recibos que se emitan desde ese momento.
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

      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Plan destino</label>
          <select
            value={idPlanDestino}
            onChange={(e) => setIdPlanDestino(e.target.value)}
            className={inputClass}
          >
            <option value="">Selecciona...</option>
            {planes.map((p) => (
              <option key={p.idPlan} value={p.idPlan}>
                {p.nombre} — S/ {p.precioMensual.toFixed(2)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>
            Buscar cliente, plan, trabajador o administrador
          </label>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Escribe para filtrar..."
            className={inputClass}
          />
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-900 text-slate-500">
            <tr className="text-left font-mono text-[11px] uppercase tracking-wider">
              <th className="px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={todosMarcados}
                  onChange={alternarTodos}
                  aria-label="Seleccionar todos los visibles"
                />
              </th>
              <th className="px-3 py-2.5">Cliente</th>
              <th className="px-3 py-2.5">Plan actual</th>
              <th className="px-3 py-2.5">Trabajador</th>
              <th className="px-3 py-2.5">Administrador</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((s) => {
              const bloqueado = yaTiene(s);
              return (
                <tr
                  key={s.idServicio}
                  className={`border-t border-slate-800 ${bloqueado ? "opacity-40" : "text-slate-200"}`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      disabled={bloqueado}
                      checked={seleccionados.includes(s.idServicio)}
                      onChange={() => alternar(s.idServicio)}
                    />
                  </td>
                  <td className="px-3 py-2">{s.cliente}</td>
                  <td className="px-3 py-2 text-slate-400">
                    {s.planActual ?? "—"} (S/ {s.precioActual.toFixed(2)})
                    {bloqueado && " · ya tiene este plan"}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {s.trabajador ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {s.administrador ?? "—"}
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  No hay clientes para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        onClick={aplicar}
        disabled={isPending || validos.length === 0 || !planDestino}
        className="mt-4 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-medium text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending
          ? "Aplicando..."
          : `Cambiar ${validos.length} cliente(s)${planDestino ? ` a ${planDestino.nombre}` : ""}`}
      </button>
    </section>
  );
}
