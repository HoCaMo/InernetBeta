"use client";

import { useTransition, useState, useRef } from "react";
import { crearAdministrador } from "./actions";

export default function CrearAdministradorForm() {
  const [isPending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    setMensaje(null);
    startTransition(async () => {
      try {
        await crearAdministrador(formData);
        setMensaje("Administrador creado correctamente.");
        formRef.current?.reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al crear");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="mb-4 text-sm font-mono uppercase tracking-wider text-slate-400">
        Crear administrador
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

      <form ref={formRef} action={handleSubmit} className="space-y-3">
        <input
          name="nombre"
          placeholder="Nombre"
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
        />
        <input
          name="correo"
          type="email"
          placeholder="Correo"
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
        />
        <input
          name="password"
          type="password"
          placeholder="Contraseña inicial"
          required
          className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
        />
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Creando..." : "Crear administrador"}
        </button>
      </form>
    </section>
  );
}
