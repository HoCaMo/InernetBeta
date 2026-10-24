"use client";

import { useState, useTransition } from "react";
import { crearSolicitudCambioServicio } from "@/app/solicitudes/actions";

type PlanDisp = { idPlan: number; nombre: string; precioMensual: number };
type ServicioActual = {
  idServicio: number;
  idPlan: number | null;
  planNombre: string | null;
  precioMensual: number;
  diaCobro: number;
  diaVencimiento: number | null;
};

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30";
const labelClass =
  "block font-mono text-[11px] uppercase tracking-wider text-slate-500 mb-1";
const DIAS = Array.from({ length: 28 }, (_, i) => i + 1);
const textoVenc = (v: string) =>
  v === "" ? "penúltimo día del mes" : `día ${v}`;

export default function CambiarServicioForm({
  servicio,
  planes,
}: {
  servicio: ServicioActual;
  planes: PlanDisp[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const idActual = servicio.idPlan === null ? "" : String(servicio.idPlan);
  const vencActual =
    servicio.diaVencimiento === null ? "" : String(servicio.diaVencimiento);
  const actualEnLista = planes.some((p) => String(p.idPlan) === idActual);

  const [idPlan, setIdPlan] = useState(idActual);
  const [precio, setPrecio] = useState(String(servicio.precioMensual));
  const [diaCobro, setDiaCobro] = useState(String(servicio.diaCobro));
  const [diaVenc, setDiaVenc] = useState(vencActual);

  const nombrePlan = (id: string) =>
    id === idActual
      ? (servicio.planNombre ?? "—")
      : (planes.find((p) => String(p.idPlan) === id)?.nombre ?? "—");

  const cambios: string[] = [];
  if (idPlan !== idActual)
    cambios.push(`Plan: ${nombrePlan(idActual)} → ${nombrePlan(idPlan)}`);
  if (Number(precio) !== servicio.precioMensual)
    cambios.push(
      `Precio mensual: S/ ${servicio.precioMensual.toFixed(2)} → S/ ${Number(precio || 0).toFixed(2)}`,
    );
  if (Number(diaCobro) !== servicio.diaCobro)
    cambios.push(`Día de cobro: ${servicio.diaCobro} → ${diaCobro}`);
  if (diaVenc !== vencActual)
    cambios.push(
      `Vencimiento: ${textoVenc(vencActual)} → ${textoVenc(diaVenc)}`,
    );

  function handleSubmit(formData: FormData) {
    setError(null);
    setMensaje(null);
    if (cambios.length === 0) {
      setError("No hiciste ningún cambio.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await crearSolicitudCambioServicio(
          servicio.idServicio,
          formData,
        );
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setMensaje(
          "Solicitud enviada. Un administrador o el jefe la revisará.",
        );
        setAbierto(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo enviar la solicitud",
        );
      }
    });
  }

  return (
    <div className="mt-4 border-t border-slate-800 pt-4">
      {mensaje && <p className="mb-2 text-xs text-emerald-400">{mensaje}</p>}
      {!abierto ? (
        <button
          onClick={() => setAbierto(true)}
          className="text-xs text-amber-500 hover:text-amber-400"
        >
          Solicitar cambio de plan, precio o fechas de pago
        </button>
      ) : (
        <form action={handleSubmit} className="space-y-3">
          {error && (
            <p className="rounded-lg border-l-2 border-red-500 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Plan</label>
              <select
                name="idPlan"
                value={idPlan}
                onChange={(e) => {
                  setIdPlan(e.target.value);
                  const p = planes.find(
                    (x) => String(x.idPlan) === e.target.value,
                  );
                  if (p) setPrecio(String(p.precioMensual)); // sugiere el precio del plan elegido
                }}
                className={inputClass}
              >
                {!actualEnLista && (
                  <option value={idActual}>
                    {servicio.planNombre ?? "Sin plan"} (actual)
                  </option>
                )}
                {planes.map((p) => (
                  <option key={p.idPlan} value={p.idPlan}>
                    {p.nombre} — S/ {p.precioMensual.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Precio mensual (S/)</label>
              <input
                name="precioMensual"
                type="number"
                min="1"
                step="0.01"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Día de cobro</label>
              <select
                name="diaCobro"
                value={diaCobro}
                onChange={(e) => setDiaCobro(e.target.value)}
                className={inputClass}
              >
                {DIAS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Vence</label>
              <select
                name="diaVencimiento"
                value={diaVenc}
                onChange={(e) => setDiaVenc(e.target.value)}
                className={inputClass}
              >
                <option value="">Penúltimo día del mes</option>
                {DIAS.map((d) => (
                  <option key={d} value={d}>
                    Día {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {cambios.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="mb-1 text-xs font-medium text-amber-400">
                Se va a solicitar:
              </p>
              <ul className="space-y-0.5 text-xs text-slate-300">
                {cambios.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-slate-500">
                Aplica a los recibos que se emitan desde la aprobación; los ya
                emitidos no cambian.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending || cambios.length === 0}
              className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-medium text-slate-950 hover:bg-amber-400 disabled:opacity-60"
            >
              {isPending ? "Enviando..." : "Enviar solicitud"}
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="text-xs text-slate-500 hover:text-slate-400"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
