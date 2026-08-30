"use client";

import { useTransition, useState, useRef } from "react";
import Link from "next/link";
import { crearClienteConSolicitud } from "@/app/solicitudes/actions";
import { PLAN_LABELS, LONGITUD_DOCUMENTO } from "@/app/lib/constantes";

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30";
const labelClass =
  "block font-mono text-[11px] uppercase tracking-wider text-slate-500 mb-1.5";
const sectionClass =
  "rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4";
const sectionTitle =
  "text-sm font-mono uppercase tracking-wider text-amber-500";

export default function ClienteNuevoForm() {
  const [isPending, startTransition] = useTransition();
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [tipoDocumento, setTipoDocumento] = useState("DNI");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const longitudEsperada = LONGITUD_DOCUMENTO[tipoDocumento];
  const longitudActual = numeroDocumento.length;
  const documentoValido = longitudActual === longitudEsperada;
  const documentoTocado = longitudActual > 0;

  function handleSubmit(formData: FormData) {
    setError(null);

    if (!documentoValido) {
      setError(
        `El número de ${tipoDocumento} debe tener exactamente ${longitudEsperada} caracteres (llevas ${longitudActual}).`,
      );
      return;
    }

    startTransition(async () => {
      try {
        await crearClienteConSolicitud(formData);
        setEnviado(true);
        formRef.current?.reset();
        setNumeroDocumento("");
        setTipoDocumento("DNI");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al crear el cliente",
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      {enviado && (
        <p className="rounded-lg border-l-2 border-emerald-500 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          Cliente enviado a revisión.{" "}
          <Link href="/solicitudes" className="underline">
            Ver estado en Solicitudes →
          </Link>
        </p>
      )}
      {error && (
        <p className="rounded-lg border-l-2 border-red-500 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <form ref={formRef} action={handleSubmit} className="space-y-6">
        {/* DATOS PERSONALES */}
        <section className={sectionClass}>
          <h2 className={sectionTitle}>Datos del cliente</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Nombres *</label>
              <input name="nombre" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Apellidos *</label>
              <input name="apellido" required className={inputClass} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Tipo de identificación *</label>
              <select
                name="tipoDocumento"
                required
                value={tipoDocumento}
                onChange={(e) => {
                  setTipoDocumento(e.target.value);
                  setNumeroDocumento("");
                }}
                className={inputClass}
              >
                <option value="DNI">DNI</option>
                <option value="PASAPORTE">Pasaporte</option>
                <option value="CE">Carné de Extranjería</option>
                <option value="RUC">RUC</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Número *</label>
              <input
                name="numeroDocumento"
                required
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                maxLength={longitudEsperada}
                className={`${inputClass} ${
                  documentoTocado
                    ? documentoValido
                      ? "border-emerald-600 focus:border-emerald-500"
                      : "border-red-600 focus:border-red-500"
                    : ""
                }`}
              />
              <p
                className={`mt-1 text-xs ${
                  !documentoTocado
                    ? "text-slate-500"
                    : documentoValido
                      ? "text-emerald-400"
                      : "text-red-400"
                }`}
              >
                {longitudActual}/{longitudEsperada} caracteres exactos para{" "}
                {tipoDocumento}
                {documentoTocado &&
                  !documentoValido &&
                  longitudActual > longitudEsperada &&
                  " — sobran caracteres"}
                {documentoTocado &&
                  !documentoValido &&
                  longitudActual < longitudEsperada &&
                  " — faltan caracteres"}
              </p>
            </div>
          </div>

          <div>
            <label className={labelClass}>Domicilio de la instalación *</label>
            <input
              name="domicilioInstalacion"
              required
              className={inputClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Nacionalidad *</label>
              <select
                name="nacionalidad"
                required
                defaultValue="PERUANA"
                className={inputClass}
              >
                <option value="PERUANA">Peruana</option>
                <option value="EXTRANJERA">Extranjera</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>
                Representante legal (si aplica)
              </label>
              <input name="representanteLegal" className={inputClass} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Departamento *</label>
              <input name="departamento" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Provincia *</label>
              <input name="provincia" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Distrito *</label>
              <input name="distrito" required className={inputClass} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>N.° Celular / Fijo</label>
              <input name="telefono" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input name="correo" type="email" className={inputClass} />
            </div>
          </div>
        </section>

        {/* DATOS DEL SERVICIO */}
        <section className={sectionClass}>
          <h2 className={sectionTitle}>Datos del servicio</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Uso del servicio *</label>
              <select
                name="usoServicio"
                required
                defaultValue="HOGAR"
                className={inputClass}
              >
                <option value="HOGAR">Uso del hogar</option>
                <option value="RESIDENCIAL">Uso residencial</option>
                <option value="COMERCIAL">Uso comercial</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Condición del cliente *</label>
              <select
                name="condicionCliente"
                required
                defaultValue="INTEGRACION"
                className={inputClass}
              >
                <option value="INTEGRACION">Integración</option>
                <option value="MIGRACION">Migración</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Fecha de inicio: hoy. Plazo de instalación: mañana hasta las 5:00
            p.m. (se calcula automáticamente al enviar).
          </p>

          <div>
            <label className={labelClass}>Plan tarifario *</label>
            <select
              name="planTarifario"
              required
              defaultValue="MBPS_200"
              className={inputClass}
            >
              {Object.entries(PLAN_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              El pago mensual se calcula automáticamente según el plan. El
              derecho de instalación lo define el administrador o el jefe al
              aceptar tu solicitud.
            </p>
          </div>
        </section>

        {/* TRASLADOS Y REACTIVACIONES */}
        <section className={sectionClass}>
          <h2 className={sectionTitle}>Traslados y reactivaciones</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                Traslado interior (cambio de sitio)
              </label>
              <select
                name="trasladoInterior"
                defaultValue="no"
                className={inputClass}
              >
                <option value="no">No</option>
                <option value="si">Sí</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Traslado externo</label>
              <select
                name="trasladoExterior"
                defaultValue="no"
                className={inputClass}
              >
                <option value="no">No</option>
                <option value="si">Sí</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                Reactivación de suspensión por deuda
              </label>
              <select
                name="reactivacionSuspension"
                defaultValue="no"
                className={inputClass}
              >
                <option value="no">No</option>
                <option value="si">Sí</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Si eliges "Sí", se registra hoy automáticamente y se notifica al
                jefe y administradores.
              </p>
            </div>
            <div>
              <label className={labelClass}>
                Activación (reinstalación) sin deuda
              </label>
              <select
                name="activacionSinDeuda"
                defaultValue="no"
                className={inputClass}
              >
                <option value="no">No</option>
                <option value="si">Sí</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Si eliges "Sí", se registra hoy automáticamente y se notifica al
                jefe y administradores.
              </p>
            </div>
          </div>
        </section>

        <button
          type="submit"
          disabled={isPending || !documentoValido}
          className="w-full rounded-lg bg-amber-500 py-3 text-sm font-medium text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? "Enviando..."
            : !documentoValido
              ? "Corrige el número de documento para continuar"
              : "Generar cliente"}
        </button>
      </form>
    </div>
  );
}
