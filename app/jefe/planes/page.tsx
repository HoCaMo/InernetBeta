import { auth } from "@/auth";
import { prisma } from "@/app/lib/db";
import { redirect } from "next/navigation";
import Shell from "@/app/components/Shell";
import PlanesManager from "./PlanesManager";
import MigrarClientes from "./MigrarClientes";

export default async function PlanesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.rol !== "JEFE") redirect("/dashboard");

  const [planes, administradores, servicios] = await Promise.all([
    prisma.plan.findMany({
      where: { activo: true },
      include: {
        administradores: { select: { idAdministrador: true } },
        _count: { select: { servicios: true } },
      },
      orderBy: [{ precioMensual: "asc" }, { nombre: "asc" }],
    }),
    prisma.usuario.findMany({
      where: { rol: "ADMINISTRADOR", activo: true },
      select: { idUsuario: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.servicio.findMany({
      where: { cliente: { estadoAprobacion: "ACEPTADO" } },
      include: {
        cliente: {
          select: {
            nombre: true,
            apellido: true,
            asignadoA: { select: { nombre: true, supervisor: { select: { nombre: true } } } },
          },
        },
      },
      orderBy: { idServicio: "asc" },
    }),
  ]);

  return (
    <Shell nombre={session.user.name ?? ""} rol="JEFE">
      <h1 className="mb-1 text-2xl font-semibold text-white">Planes</h1>
      <p className="mb-8 text-sm text-slate-400">
        Crea y edita los planes, elige qué administradores los pueden usar y pasa clientes a un plan actualizado.
      </p>

      <PlanesManager
        administradores={administradores}
        planes={planes.map((p) => ({
          idPlan: p.idPlan,
          nombre: p.nombre,
          velocidadMbps: p.velocidadMbps,
          precioMensual: Number(p.precioMensual),
          paraTodos: p.paraTodos,
          idsAdministradores: p.administradores.map((a) => a.idAdministrador),
          clientes: p._count.servicios,
        }))}
      />

      <MigrarClientes
        planes={planes.map((p) => ({ idPlan: p.idPlan, nombre: p.nombre, precioMensual: Number(p.precioMensual) }))}
        servicios={servicios.map((s) => ({
          idServicio: s.idServicio,
          idPlan: s.idPlan,
          cliente: `${s.cliente.nombre} ${s.cliente.apellido ?? ""}`.trim(),
          planActual: s.planNombre,
          precioActual: Number(s.precioMensual),
          trabajador: s.cliente.asignadoA?.nombre ?? null,
          administrador: s.cliente.asignadoA?.supervisor?.nombre ?? null,
        }))}
      />
    </Shell>
  );
}