import { prisma } from "@/app/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Shell from "@/app/components/Shell";
import Link from "next/link";

const estadoBadge: Record<string, string> = {
  PENDIENTE: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  ACEPTADO: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  RECHAZADO: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default async function GestionClientesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.rol === "TRABAJADOR") redirect("/trabajador");

  const where =
    session.user.rol === "ADMINISTRADOR"
      ? { asignadoA: { idSupervisor: session.user.idUsuario } }
      : {}; // JEFE ve todos

  const clientes = await prisma.cliente.findMany({
    where,
    include: {
      asignadoA: { select: { nombre: true } },
      telefonos: { where: { principal: true }, take: 1 },
    },
    orderBy: { fechaRegistro: "desc" },
  });

  return (
    <Shell nombre={session.user.name ?? ""} rol={session.user.rol}>
      <h1 className="mb-1 text-2xl font-semibold text-white">Clientes</h1>
      <p className="mb-8 text-sm text-slate-400">
        Clic en un cliente para ver el detalle completo (pagos, documentos,
        etc.) y solicitar cambios.
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-500">
            <tr className="text-left font-mono text-[11px] uppercase tracking-wider">
              <th className="px-4 py-2.5">Nombre</th>
              <th className="px-4 py-2.5">Teléfono</th>
              <th className="px-4 py-2.5">Trabajador</th>
              <th className="px-4 py-2.5">Instalación</th>
              <th className="px-4 py-2.5">Derecho instal.</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5">Activo</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr
                key={c.idCliente}
                className="border-t border-slate-800 text-slate-200"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/clientes/${c.idCliente}`}
                    className="text-amber-400 hover:underline"
                  >
                    {c.nombre} {c.apellido ?? ""}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-400">
                  {c.telefonos[0]?.numero ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-400">
                  {c.asignadoA?.nombre ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-400">
                  {c.fechaHoraInstalacion
                    ? new Date(c.fechaHoraInstalacion).toLocaleDateString(
                        "es-PE",
                      )
                    : "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-400">
                  {c.tieneCostoInstalacion
                    ? `Sí (S/ ${Number(c.derechoInstalacion).toFixed(2)})`
                    : "No"}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${estadoBadge[c.estadoAprobacion]}`}
                  >
                    {c.estadoAprobacion}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-400">
                  {c.activo === null ? "Sin definir" : c.activo ? "Sí" : "No"}
                </td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-slate-500"
                >
                  No hay clientes para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
