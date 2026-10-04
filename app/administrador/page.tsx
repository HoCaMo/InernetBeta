import { auth } from "@/auth";
import { prisma } from "@/app/lib/db";
import { redirect } from "next/navigation";
import Shell from "@/app/components/Shell";
import SolicitarTrabajadorForm from "./SolicitarTrabajadorForm";
import SolicitarTransferenciaForm from "./SolicitarTransferenciaForm";
import GestionTrabajadorItem from "./GestionTrabajadorItem";

export default async function AdministradorPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.rol !== "ADMINISTRADOR") redirect("/dashboard");

  const [
    trabajadoresPropios,
    todosTrabajadores,
    otrosAdministradores,
    clientesDeMisTrabajadores,
  ] = await Promise.all([
    prisma.usuario.findMany({
      where: {
        rol: "TRABAJADOR",
        idSupervisor: session.user.idUsuario,
        activo: true,
      },
      orderBy: { fechaCreacion: "desc" },
    }),
    prisma.usuario.findMany({
      where: { rol: "TRABAJADOR", activo: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.usuario.findMany({
      where: {
        rol: "ADMINISTRADOR",
        activo: true,
        idUsuario: { not: session.user.idUsuario },
      },
      orderBy: { nombre: "asc" },
    }),
    prisma.cliente.findMany({
      where: { asignadoA: { idSupervisor: session.user.idUsuario } },
      select: {
        idCliente: true,
        nombre: true,
        apellido: true,
        idAsignadoA: true,
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
          clientes={clientesDeMisTrabajadores}
        />
      </div>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="mb-2 text-sm font-mono uppercase tracking-wider text-slate-400">
          Mis trabajadores ({trabajadoresPropios.length})
        </h2>
        {trabajadoresPropios.length === 0 && (
          <p className="text-sm text-slate-500">
            Aún no tienes trabajadores asignados.
          </p>
        )}
        {trabajadoresPropios.map((t) => (
          <GestionTrabajadorItem
            key={t.idUsuario}
            trabajador={t}
            otrosAdministradores={otrosAdministradores}
          />
        ))}
      </section>
    </Shell>
  );
}
