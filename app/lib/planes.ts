import { prisma } from "@/app/lib/db";

export type PlanDisponible = {
  idPlan: number;
  nombre: string;
  precioMensual: number;
};

async function idAdministradorDe(
  idUsuario: number,
  rol: string,
): Promise<number | null> {
  if (rol === "ADMINISTRADOR") return idUsuario;
  if (rol === "TRABAJADOR") {
    const u = await prisma.usuario.findUnique({
      where: { idUsuario },
      select: { idSupervisor: true },
    });
    return u?.idSupervisor ?? null;
  }
  return null;
}

// Planes que puede usar cada rol:
// - JEFE: todos los activos
// - ADMINISTRADOR: los "para todos" y los que el jefe le habilitó
// - TRABAJADOR: los de su administrador
export async function planesDisponibles(
  idUsuario: number,
  rol: string,
): Promise<PlanDisponible[]> {
  const idAdmin = await idAdministradorDe(idUsuario, rol);

  const planes = await prisma.plan.findMany({
    where:
      rol === "JEFE"
        ? { activo: true }
        : {
            activo: true,
            OR: idAdmin
              ? [
                  { paraTodos: true },
                  { administradores: { some: { idAdministrador: idAdmin } } },
                ]
              : [{ paraTodos: true }],
          },
    orderBy: [{ precioMensual: "asc" }, { nombre: "asc" }],
  });

  return planes.map((p) => ({
    idPlan: p.idPlan,
    nombre: p.nombre,
    precioMensual: Number(p.precioMensual),
  }));
}

export async function planDisponibleParaUsuario(
  idPlan: number,
  idUsuario: number,
  rol: string,
): Promise<PlanDisponible> {
  const planes = await planesDisponibles(idUsuario, rol);
  const plan = planes.find((p) => p.idPlan === idPlan);
  if (!plan) throw new Error("Ese plan no está disponible para ti");
  return plan;
}
