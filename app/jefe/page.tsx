import { auth } from "@/auth";
import { prisma } from "@/app/lib/db";
import { redirect } from "next/navigation";
import Shell from "@/app/components/Shell";
import CrearAdministradorForm from "./CrearAdministradorForm";

export default async function JefePage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.rol !== "JEFE") redirect("/dashboard");

  const [administradores, solicitudesPendientes] = await Promise.all([
    prisma.usuario.findMany({
      where: { rol: "ADMINISTRADOR" },
      orderBy: { fechaCreacion: "desc" },
    }),
    prisma.solicitud.count({ where: { estado: "PENDIENTE" } }),
  ]);

  return (
    <Shell nombre={session.user.name ?? ""} rol="JEFE">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Panel del Jefe</h1>
          <p className="mt-1 text-sm text-slate-400">
            {solicitudesPendientes} solicitud
            {solicitudesPendientes === 1 ? "" : "es"} pendiente
            {solicitudesPendientes === 1 ? "" : "s"} en el sistema.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <CrearAdministradorForm />

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-4 text-sm font-mono uppercase tracking-wider text-slate-400">
            Administradores ({administradores.length})
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
                {administradores.map((a) => (
                  <tr
                    key={a.idUsuario}
                    className="border-t border-slate-800 text-slate-200"
                  >
                    <td className="px-4 py-2.5">{a.nombre}</td>
                    <td className="px-4 py-2.5 text-slate-400">{a.correo}</td>
                  </tr>
                ))}
                {administradores.length === 0 && (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      Aún no hay administradores.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Shell>
  );
}
