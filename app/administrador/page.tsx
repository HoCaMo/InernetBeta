import { auth } from "@/auth";
import { prisma } from "@/app/lib/db";
import { redirect } from "next/navigation";
import Shell from "@/app/components/Shell";

import SolicitarTrabajadorForm from "./SolicitarTrabajadorForm";
import SolicitarTransferenciaForm from "./SolicitarTransferenciaForm";

export default async function AdministradorPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.rol !== "ADMINISTRADOR") {
    redirect("/dashboard");
  }

  const [trabajadoresPropios, todosTrabajadores] = await Promise.all([
    prisma.usuario.findMany({
      where: {
        rol: "TRABAJADOR",
        idSupervisor: session.user.idUsuario,
      },
      orderBy: {
        fechaCreacion: "desc",
      },
    }),

    prisma.usuario.findMany({
      where: {
        rol: "TRABAJADOR",
      },
      orderBy: {
        nombre: "asc",
      },
    }),
  ]);

  return (
    <Shell nombre={session.user.name ?? ""} rol="ADMINISTRADOR">
      <h1 className="mb-1 text-2xl font-semibold text-white">
        Panel del Administrador
      </h1>

      <p className="mb-8 text-sm text-slate-400">
        Gestiona tus trabajadores y solicitudes.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <SolicitarTrabajadorForm />

        <SolicitarTransferenciaForm
          trabajadoresPropios={trabajadoresPropios}
          todosTrabajadores={todosTrabajadores}
        />
      </div>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-4 text-sm font-mono uppercase tracking-wider text-slate-400">
          Mis trabajadores ({trabajadoresPropios.length})
        </h2>

        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-500">
              <tr className="text-left font-mono text-[11px] uppercase tracking-wider">
                <th className="px-4 py-2.5">Nombre</th>

                <th className="px-4 py-2.5">Correo</th>
              </tr>
            </thead>

            <tbody>
              {trabajadoresPropios.map((t) => (
                <tr
                  key={t.idUsuario}
                  className="border-t border-slate-800 text-slate-200"
                >
                  <td className="px-4 py-2.5">{t.nombre}</td>

                  <td className="px-4 py-2.5 text-slate-400">{t.correo}</td>
                </tr>
              ))}

              {trabajadoresPropios.length === 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Aún no tienes trabajadores asignados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}
