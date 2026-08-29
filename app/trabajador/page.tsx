import { auth } from "@/auth";
import { prisma } from "@/app/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import Shell from "@/app/components/Shell";

const badgeColor: Record<string, string> = {
  PENDIENTE: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  ACEPTADO: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  RECHAZADO: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default async function TrabajadorPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.rol !== "TRABAJADOR") redirect("/dashboard");

  const clientes = await prisma.cliente.findMany({
    where: { idAsignadoA: session.user.idUsuario },
    orderBy: { fechaRegistro: "desc" },
  });

  return (
    <Shell nombre={session.user.name ?? ""} rol="TRABAJADOR">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Panel del Trabajador
          </h1>
          <p className="mt-1 text-sm text-slate-400">Tus clientes generados.</p>
        </div>
        <Link
          href="/clientes/nuevo"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-amber-400"
        >
          + Generar cliente
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-4 text-sm font-mono uppercase tracking-wider text-slate-400">
          Mis clientes ({clientes.length})
        </h2>
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-500">
              <tr className="text-left font-mono text-[11px] uppercase tracking-wider">
                <th className="px-4 py-2.5">Nombre</th>
                <th className="px-4 py-2.5">Correo</th>
                <th className="px-4 py-2.5">Estado</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr
                  key={c.idCliente}
                  className="border-t border-slate-800 text-slate-200"
                >
                  <td className="px-4 py-2.5">
                    {c.nombre} {c.apellido ?? ""}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">
                    {c.correo ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs ${badgeColor[c.estadoAprobacion]}`}
                    >
                      {c.estadoAprobacion}
                    </span>
                  </td>
                </tr>
              ))}
              {clientes.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-6 text-center text-slate-500"
                  >
                    Aún no has generado clientes.
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
