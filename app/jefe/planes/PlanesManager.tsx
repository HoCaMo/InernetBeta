"use client";

import { useState, useTransition } from "react";
import { crearPlan, actualizarPlan, eliminarPlan } from "./actions";

type PlanFila = {
  idPlan: number;
  nombre: string;
  velocidadMbps: number | null;
  precioMensual: number;
  paraTodos: boolean;
  idsAdministradores: number[];
  clientes: number;
};
type Admin = { idUsuario: number; nombre: string };

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30";
const labelClass =
  "block font-mono text-[11px] uppercase tracking-wider text-slate-500 mb-1";

function PlanForm({
  plan,
  administradores,
  onListo,
  onCancelar,
}: {
  plan?: PlanFila;
  administradores: Admin[];
  onListo: (mensaje: string) => void;
  onCancelar: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [alcance, setAlcance] = useState<"todos" | "algunos">(
    plan && !plan.paraTodos ? "algunos" : "todos",
  );

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        const res = plan
          ? await actualizarPlan(plan.idPlan, formData)
          : await crearPlan(formData);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        onListo(res.mensaje ?? "Listo.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar");
      }
    });
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4"
    >
      {error && (
        <p className="rounded-lg border-l-2 border-red-500 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <label className={labelClass}>Nombre *</label>
          <input
            name="nombre"
            required
            maxLength={80}
            defaultValue={plan?.nombre}
            placeholder="Ej: 300 Mbps Promo"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Velocidad (Mbps)</label>
          <input
            name="velocidadMbps"
            type="number"
            min="1"
            step="1"
            defaultValue={plan?.velocidadMbps ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Precio mensual (S/) *</label>
          <input
            name="precioMensual"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={plan?.precioMensual}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>¿Quién puede usar este plan?</label>
        <div className="flex flex-wrap gap-4 text-sm text-slate-300">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="alcance"
              value="todos"
              checked={alcance === "todos"}
              onChange={() => setAlcance("todos")}
            />
            Todos los administradores
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="alcance"
              value="algunos"
              checked={alcance === "algunos"}
              onChange={() => setAlcance("algunos")}
            />
            Solo algunos
          </label>
        </div>

        {alcance === "algunos" && (
          <div className="mt-2 grid gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-3 sm:grid-cols-2">
            {administradores.length === 0 && (
              <p className="text-xs text-slate-500">
                No hay administradores activos.
              </p>
            )}
            {administradores.map((a) => (
              <label
                key={a.idUsuario}
                className="flex items-center gap-2 text-sm text-slate-300"
              >
                <input
                  type="checkbox"
                  name="administradores"
                  value={a.idUsuario}
                  defaultChecked={plan?.idsAdministradores.includes(
                    a.idUsuario,
                  )}
                />
                {a.nombre}
              </label>
            ))}
          </div>
        )}
        <p className="mt-1 text-[11px] text-slate-500">
          Los trabajadores usan los planes de su administrador.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-60"
        >
          {isPending ? "Guardando..." : plan ? "Guardar cambios" : "Crear plan"}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="text-xs text-slate-500 hover:text-slate-400"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function PlanesManager({
  planes,
  administradores,
}: {
  planes: PlanFila[];
  administradores: Admin[];
}) {
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [editando, setEditando] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nombreAdmin = new Map(
    administradores.map((a) => [a.idUsuario, a.nombre]),
  );

  function eliminar(p: PlanFila) {
    if (
      !window.confirm(
        `¿Eliminar el plan «${p.nombre}»? Los clientes que lo tienen o lo tuvieron no se ven afectados.`,
      )
    )
      return;
    setError(null);
    setMensaje(null);
    startTransition(async () => {
      try {
        const res = await eliminarPlan(p.idPlan);
        if (!res.ok) setError(res.error);
        else setMensaje(res.mensaje ?? "Plan eliminado.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo eliminar");
      }
    });
  }

  function disponiblePara(p: PlanFila) {
    if (p.paraTodos) return "Todos los administradores";
    const nombres = p.idsAdministradores
      .map((id) => nombreAdmin.get(id))
      .filter(Boolean);
    return nombres.length > 0 ? nombres.join(", ") : "—";
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-mono uppercase tracking-wider text-amber-500">
          Catálogo de planes ({planes.length})
        </h2>
        {!mostrarNuevo && (
          <button
            onClick={() => {
              setMostrarNuevo(true);
              setEditando(null);
              setMensaje(null);
            }}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-slate-950 hover:bg-amber-400"
          >
            + Nuevo plan
          </button>
        )}
      </div>

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

      {mostrarNuevo && (
        <div className="mb-4">
          <PlanForm
            administradores={administradores}
            onCancelar={() => setMostrarNuevo(false)}
            onListo={(m) => {
              setMensaje(m);
              setMostrarNuevo(false);
            }}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-500">
            <tr className="text-left font-mono text-[11px] uppercase tracking-wider">
              <th className="px-4 py-2.5">Plan</th>
              <th className="px-4 py-2.5">Velocidad</th>
              <th className="px-4 py-2.5">Precio</th>
              <th className="px-4 py-2.5">Disponible para</th>
              <th className="px-4 py-2.5">Clientes</th>
              <th className="px-4 py-2.5">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {planes.map((p) => (
              <tr
                key={p.idPlan}
                className="border-t border-slate-800 align-top text-slate-200"
              >
                {editando === p.idPlan ? (
                  <td colSpan={6} className="p-3">
                    <PlanForm
                      plan={p}
                      administradores={administradores}
                      onCancelar={() => setEditando(null)}
                      onListo={(m) => {
                        setMensaje(m);
                        setEditando(null);
                      }}
                    />
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-2.5">{p.nombre}</td>
                    <td className="px-4 py-2.5 text-slate-400">
                      {p.velocidadMbps ? `${p.velocidadMbps} Mbps` : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      S/ {p.precioMensual.toFixed(2)}
                    </td>
                    <td className="max-w-xs px-4 py-2.5 text-xs text-slate-400">
                      {disponiblePara(p)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400">{p.clientes}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-3 text-xs">
                        <button
                          onClick={() => {
                            setEditando(p.idPlan);
                            setMostrarNuevo(false);
                            setMensaje(null);
                          }}
                          className="text-amber-500 hover:text-amber-400"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => eliminar(p)}
                          disabled={isPending}
                          className="text-red-400 hover:text-red-300"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {planes.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  Aún no hay planes. Crea el primero.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
