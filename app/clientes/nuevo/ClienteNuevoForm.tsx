"use client";

import { useTransition, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { crearClienteConSolicitud } from "@/app/solicitudes/actions";
import { LONGITUD_DOCUMENTO } from "@/app/lib/constantes";
import Combobox from "@/app/components/Combobox";
import SelectorUbicacionMapa from "@/app/components/SelectorUbicacionMapa";
import CamposServicio from "@/app/components/CamposServicio";

type Ubigeo = {
  idUbigeo: number;
  departamento: string;
  provincia: string;
  distrito: string;
};

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30";
const labelClass =
  "block font-mono text-[11px] uppercase tracking-wider text-slate-500 mb-1.5";
const sectionClass =
  "rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4";
const sectionTitle =
  "text-sm font-mono uppercase tracking-wider text-amber-500";

export default function ClienteNuevoForm({ ubigeos }: { ubigeos: Ubigeo[] }) {
  const [isPending, startTransition] = useTransition();
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reinicio, setReinicio] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const [tipoDocumento, setTipoDocumento] = useState("DNI");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const longitudEsperada = LONGITUD_DOCUMENTO[tipoDocumento];
  const longitudActual = numeroDocumento.length;
  const documentoValido = longitudActual === longitudEsperada;
  const documentoTocado = longitudActual > 0;

  const departamentos = useMemo(
    () => Array.from(new Set(ubigeos.map((u) => u.departamento))).sort(),
    [ubigeos],
  );
  const [departamento, setDepartamento] = useState("");
  const provincias = useMemo(
    () =>
      Array.from(
        new Set(
          ubigeos
            .filter((u) => u.departamento === departamento)
            .map((u) => u.provincia),
        ),
      ).sort(),
    [ubigeos, departamento],
  );
  const [provincia, setProvincia] = useState("");
  const distritos = useMemo(
    () =>
      Array.from(
        new Set(
          ubigeos
            .filter(
              (u) =>
                u.departamento === departamento && u.provincia === provincia,
            )
            .map((u) => u.distrito),
        ),
      ).sort(),
    [ubigeos, departamento, provincia],
  );
  const [distrito, setDistrito] = useState("");

  const [latitud, setLatitud] = useState<number | null>(null);
  const [longitud, setLongitud] = useState<number | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);

    if (!documentoValido) {
      setError(
        `El número de ${tipoDocumento} debe tener exactamente ${longitudEsperada} caracteres (llevas ${longitudActual}).`,
      );
      return;
    }
    if (!departamento || !provincia || !distrito) {
      setError("Selecciona departamento, provincia y distrito de la lista.");
      return;
    }
    if (latitud === null || longitud === null) {
      setError("Marca la ubicación exacta del cliente en el mapa.");
      return;
    }

    startTransition(async () => {
      try {
        const resultado = await crearClienteConSolicitud(formData);
        if (!resultado.ok) {
          setError(resultado.error);
          return;
        }
        setEnviado(true);
        formRef.current?.reset();
        setNumeroDocumento("");
        setTipoDocumento("DNI");
        setDepartamento("");
        setProvincia("");
        setDistrito("");
        setLatitud(null);
        setLongitud(null);
        setReinicio((r) => r + 1); // reinicia los campos del plan
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
        <input type="hidden" name="latitud" value={latitud ?? ""} />
        <input type="hidden" name="longitud" value={longitud ?? ""} />

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
                className={`mt-1 text-xs ${!documentoTocado ? "text-slate-500" : documentoValido ? "text-emerald-400" : "text-red-400"}`}
              >
                {longitudActual}/{longitudEsperada} caracteres exactos para{" "}
                {tipoDocumento}
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

          {ubigeos.length === 0 ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              Aún no hay departamentos/provincias/distritos registrados.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Departamento *</label>
                <Combobox
                  name="departamento"
                  value={departamento}
                  options={departamentos}
                  placeholder="Ej: Lima"
                  onChange={(v) => {
                    setDepartamento(v);
                    setProvincia("");
                    setDistrito("");
                  }}
                />
              </div>
              <div>
                <label className={labelClass}>Provincia *</label>
                <Combobox
                  name="provincia"
                  value={provincia}
                  options={provincias}
                  disabled={!departamento}
                  placeholder="Ej: Lima"
                  onChange={(v) => {
                    setProvincia(v);
                    setDistrito("");
                  }}
                />
              </div>
              <div>
                <label className={labelClass}>Distrito *</label>
                <Combobox
                  name="distrito"
                  value={distrito}
                  options={distritos}
                  disabled={!provincia}
                  placeholder="Ej: Miraflores"
                  onChange={setDistrito}
                />
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Ubicación exacta en el mapa *</label>
            <SelectorUbicacionMapa
              latitud={latitud}
              longitud={longitud}
              onSeleccionar={(lat, lng) => {
                setLatitud(lat);
                setLongitud(lng);
              }}
            />
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
        </section>

        <section className={sectionClass}>
          <h2 className={sectionTitle}>Plan de internet e instalación</h2>
          <CamposServicio key={reinicio} />
          <p className="text-xs text-slate-500">
            Si el cliente necesita más planes, se agregan desde su ficha una vez
            aprobado.
          </p>
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
