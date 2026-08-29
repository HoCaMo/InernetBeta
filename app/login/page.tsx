"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError("");
    setIsPending(true);

    const res = await signIn("credentials", {
      correo: formData.get("correo"),
      password: formData.get("password"),
      redirect: false,
    });

    setIsPending(false);

    if (res?.error) {
      setError("Correo o contraseña incorrectos.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="relative min-h-full flex items-center justify-center bg-slate-950 px-4 py-16 overflow-hidden">
      {/* Resplandor ambiental sutil, como luz de fibra dispersándose en el fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-amber-500/10 blur-[120px]"
      />

      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-sm shadow-2xl shadow-black/40 p-8">
          {/* Encabezado */}
          <div className="mb-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-amber-500">
              Internet Fibra
            </p>

            {/* Elemento distintivo: línea de pulso, como una señal viajando por la fibra */}
            <div className="relative mt-3 h-px w-full overflow-hidden bg-slate-800">
              <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-amber-500 to-transparent animate-[pulse-line_2.4s_ease-in-out_infinite]" />
            </div>

            <h1 className="mt-5 text-2xl font-semibold text-white">
              Acceder al sistema
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Panel interno de gestión de clientes.
            </p>
          </div>

          {/* Formulario */}
          <form action={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="correo"
                className="block font-mono text-[11px] uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Correo
              </label>
              <input
                id="correo"
                name="correo"
                type="email"
                required
                placeholder="nombre@internetfibra.com"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block font-mono text-[11px] uppercase tracking-wider text-slate-500 mb-1.5"
              >
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            {error && (
              <p className="rounded-lg border-l-2 border-red-500 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Verificando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center font-mono text-[11px] tracking-wide text-slate-600">
          Acceso restringido a personal autorizado
        </p>
      </div>

      <style>{`
        @keyframes pulse-line {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
