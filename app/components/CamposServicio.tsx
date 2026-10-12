"use client";

import { useState } from "react";
import {
  PLAN_LABELS,
  PLAN_PRECIOS,
  TIPO_ACCION_LABELS,
  TIPO_INSTALACION_LABELS,
} from "@/app/lib/constantes";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30";
const labelClass =
  "block font-mono text-[11px] uppercase tracking-wider text-slate-500 mb-1.5";

const HORAS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTOS = [
  "00",
  "05",
  "10",
  "15",
  "20",
  "25",
  "30",
  "35",
  "40",
  "45",
  "50",
  "55",
];

// Campos de UN plan de internet. Se usa al crear un cliente y al agregarle otro plan.
// Para reiniciarlo después de enviar, vuelve a montarlo cambiándole la prop "key".
export default function CamposServicio() {
  const [plan, setPlan] = useState("MBPS_200");
  const [tieneCosto, setTieneCosto] = useState("no");
  const [tieneAdicional, setTieneAdicional] = useState("no");

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Plan tarifario *</label>
        <select
          name="planTarifario"
          required
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          className={inputClass}
        >
          {Object.entries(PLAN_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm font-medium text-amber-400">
          Pago mensual: S/ {PLAN_PRECIOS[plan].toFixed(2)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Tipo de acción *</label>
          <select
            name="tipoAccion"
            required
            defaultValue="INSTALACION_NUEVA"
            className={inputClass}
          >
            {Object.entries(TIPO_ACCION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Fijo / No fijo *</label>
          <select
            name="tipoInstalacion"
            required
            defaultValue="FIJO"
            className={inputClass}
          >
            {Object.entries(TIPO_INSTALACION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Fecha y hora de instalación *</label>
        <div className="grid gap-3 sm:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
          <input
            name="fechaInstalacion"
            type="date"
            required
            className={inputClass}
          />
          <select
            name="horaInstalacion"
            defaultValue="9"
            className={inputClass}
          >
            {HORAS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <select
            name="minutoInstalacion"
            defaultValue="00"
            className={inputClass}
          >
            {MINUTOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            name="periodoInstalacion"
            defaultValue="AM"
            className={inputClass}
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </div>

      {/* --- Derecho de instalación (opcional) --- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>
            ¿Se cobrará derecho de instalación?
          </label>
          <select
            name="tieneCostoInstalacion"
            value={tieneCosto}
            onChange={(e) => setTieneCosto(e.target.value)}
            className={inputClass}
          >
            <option value="no">No</option>
            <option value="si">Sí</option>
          </select>
        </div>
        {tieneCosto === "si" && (
          <div>
            <label className={labelClass}>Monto (S/) *</label>
            <input
              name="derechoInstalacion"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="200.00"
              className={inputClass}
            />
          </div>
        )}
      </div>

      {/* --- Servicio adicional (opcional): el trabajador escribe el tipo y el precio --- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>¿Se hará un servicio adicional?</label>
          <select
            name="tieneServicioAdicional"
            value={tieneAdicional}
            onChange={(e) => setTieneAdicional(e.target.value)}
            className={inputClass}
          >
            <option value="no">No</option>
            <option value="si">Sí</option>
          </select>
        </div>
      </div>
      {tieneAdicional === "si" && (
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <div>
            <label className={labelClass}>¿Qué servicio adicional? *</label>
            <input
              name="servicioAdicionalDetalle"
              required
              maxLength={120}
              placeholder="Ej: punto de red adicional, extensión de cable, repetidor WiFi"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Precio (S/) *</label>
            <input
              name="servicioAdicionalPrecio"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="50.00"
              className={inputClass}
            />
          </div>
        </div>
      )}
    </div>
  );
}
