"use client";

import { useTransition } from "react";
import {
  agregarTelefono,
  eliminarTelefono,
  agregarDocumento,
  eliminarDocumento,
} from "./actions";

type Telefono = { idTelefono: number; numero: string; principal: boolean };
type Documento = {
  idDocumento: number;
  tipoDocumento: string;
  numeroDocumento: string;
  tipoRuc: string | null;
};

export default function ClienteDetalle({
  idCliente,
  telefonos,
  documentos,
}: {
  idCliente: number;
  telefonos: Telefono[];
  documentos: Documento[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleAgregarTelefono(formData: FormData) {
    startTransition(async () => {
      await agregarTelefono(idCliente, formData);
    });
  }

  function handleAgregarDocumento(formData: FormData) {
    startTransition(async () => {
      await agregarDocumento(idCliente, formData);
    });
  }

  return (
    <div className="mt-6 grid gap-6 md:grid-cols-2">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-3 text-sm font-mono uppercase tracking-wider text-amber-500">
          Teléfonos
        </h2>
        <ul className="space-y-1 text-sm text-slate-300">
          {telefonos.map((t) => (
            <li
              key={t.idTelefono}
              className="flex items-center justify-between"
            >
              <span>
                {t.numero} {t.principal ? "(principal)" : ""}
              </span>
              <button
                onClick={() =>
                  startTransition(async () => {
                    await eliminarTelefono(t.idTelefono, idCliente);
                  })
                }
                disabled={isPending}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Eliminar
              </button>
            </li>
          ))}
          {telefonos.length === 0 && (
            <li className="text-slate-500">Sin teléfonos registrados.</li>
          )}
        </ul>
        <form action={handleAgregarTelefono} className="mt-3 flex gap-2">
          <input
            name="numero"
            placeholder="987654321"
            required
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          />
          <label className="flex items-center gap-1 text-xs text-slate-400">
            <input type="checkbox" name="principal" /> Principal
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-slate-950 hover:bg-amber-400"
          >
            Agregar
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-3 text-sm font-mono uppercase tracking-wider text-amber-500">
          Documentos
        </h2>
        <ul className="space-y-1 text-sm text-slate-300">
          {documentos.map((d) => (
            <li
              key={d.idDocumento}
              className="flex items-center justify-between"
            >
              <span>
                {d.tipoDocumento}: {d.numeroDocumento}{" "}
                {d.tipoRuc ? `(RUC ${d.tipoRuc})` : ""}
              </span>
              <button
                onClick={() =>
                  startTransition(async () => {
                    await eliminarDocumento(d.idDocumento, idCliente);
                  })
                }
                disabled={isPending}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Eliminar
              </button>
            </li>
          ))}
          {documentos.length === 0 && (
            <li className="text-slate-500">Sin documentos registrados.</li>
          )}
        </ul>
        <form
          action={handleAgregarDocumento}
          className="mt-3 flex flex-wrap gap-2"
        >
          <select
            name="tipoDocumento"
            required
            defaultValue="DNI"
            className="rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-2 text-xs text-white outline-none focus:border-amber-500"
          >
            <option value="DNI">DNI</option>
            <option value="CE">CE</option>
            <option value="RUC">RUC</option>
            <option value="PASAPORTE">Pasaporte</option>
          </select>
          <input
            name="numeroDocumento"
            placeholder="Número"
            required
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-slate-950 hover:bg-amber-400"
          >
            Agregar
          </button>
        </form>
      </section>
    </div>
  );
}
