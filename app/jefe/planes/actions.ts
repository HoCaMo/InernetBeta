"use server";

import { prisma } from "@/app/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

type Resultado = { ok: true; mensaje?: string } | { ok: false; error: string };

async function soloJefe() {
  const session = await auth();
  if (!session || session.user.rol !== "JEFE") {
    throw new Error("Solo el jefe puede administrar los planes");
  }
  return session;
}

// Devuelve { ok, error } en vez de lanzar: en producción Next.js oculta los errores lanzados.
async function ejecutar(
  etiqueta: string,
  fn: () => Promise<string | void>,
): Promise<Resultado> {
  try {
    const mensaje = await fn();
    return { ok: true, mensaje: mensaje ?? undefined };
  } catch (err) {
    console.error(`${etiqueta} falló:`, err);
    if (err instanceof Error && !err.name.startsWith("PrismaClient")) {
      return { ok: false, error: err.message };
    }
    return {
      ok: false,
      error:
        "No se pudo guardar en la base de datos. Intenta de nuevo o avisa al responsable del sistema.",
    };
  }
}

function leerPlan(formData: FormData) {
  const nombre = ((formData.get("nombre") as string) ?? "").trim();
  if (!nombre) throw new Error("Escribe el nombre del plan");
  if (nombre.length > 80)
    throw new Error("El nombre es muy largo (máximo 80 caracteres)");

  const precio = Number(
    ((formData.get("precioMensual") as string) ?? "").trim(),
  );
  if (Number.isNaN(precio) || precio <= 0)
    throw new Error("Ingresa un precio mensual válido");

  const velTexto = ((formData.get("velocidadMbps") as string) ?? "").trim();
  const velocidadMbps = velTexto ? Number(velTexto) : null;
  if (
    velocidadMbps !== null &&
    (!Number.isInteger(velocidadMbps) || velocidadMbps <= 0)
  ) {
    throw new Error("La velocidad debe ser un número entero de Mbps");
  }

  const paraTodos = formData.get("alcance") !== "algunos";
  const ids = formData
    .getAll("administradores")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  if (!paraTodos && ids.length === 0) {
    throw new Error(
      "Selecciona al menos un administrador, o elige «Todos los administradores»",
    );
  }

  return { nombre, precio, velocidadMbps, paraTodos, ids };
}

// ---------------------------------------------------------
// Crear plan
// ---------------------------------------------------------
export async function crearPlan(formData: FormData): Promise<Resultado> {
  return ejecutar("crearPlan", async () => {
    const session = await soloJefe();
    const p = leerPlan(formData);

    const repetido = await prisma.plan.findFirst({
      where: {
        activo: true,
        nombre: { equals: p.nombre, mode: "insensitive" },
      },
    });
    if (repetido) throw new Error("Ya existe un plan activo con ese nombre");

    await prisma.plan.create({
      data: {
        nombre: p.nombre,
        velocidadMbps: p.velocidadMbps,
        precioMensual: p.precio,
        paraTodos: p.paraTodos,
        idCreadoPor: session.user.idUsuario,
        administradores: p.paraTodos
          ? undefined
          : { create: p.ids.map((id) => ({ idAdministrador: id })) },
      },
    });

    // Avisa a los administradores que ya pueden usarlo
    const destinatarios = await prisma.usuario.findMany({
      where: p.paraTodos
        ? { rol: "ADMINISTRADOR", activo: true }
        : { rol: "ADMINISTRADOR", activo: true, idUsuario: { in: p.ids } },
      select: { idUsuario: true },
    });
    if (destinatarios.length > 0) {
      const mensaje = `El jefe ${session.user.name} creó el plan ${p.nombre} (S/ ${p.precio.toFixed(2)}/mes). Ya lo pueden usar tú y tus trabajadores.`;
      await prisma.notificacion.createMany({
        data: destinatarios.map((d) => ({
          idUsuarioDestino: d.idUsuario,
          mensaje,
        })),
      });
    }

    revalidatePath("/jefe/planes");
    return `Plan «${p.nombre}» creado.`;
  });
}

// ---------------------------------------------------------
// Actualizar plan (no cambia a los clientes que ya lo tienen)
// ---------------------------------------------------------
export async function actualizarPlan(
  idPlan: number,
  formData: FormData,
): Promise<Resultado> {
  return ejecutar("actualizarPlan", async () => {
    await soloJefe();
    const p = leerPlan(formData);

    const plan = await prisma.plan.findUnique({ where: { idPlan } });
    if (!plan || !plan.activo)
      throw new Error("El plan no existe o ya fue eliminado");

    const repetido = await prisma.plan.findFirst({
      where: {
        activo: true,
        idPlan: { not: idPlan },
        nombre: { equals: p.nombre, mode: "insensitive" },
      },
    });
    if (repetido) throw new Error("Ya existe otro plan activo con ese nombre");

    await prisma.$transaction([
      prisma.planAdministrador.deleteMany({ where: { idPlan } }),
      prisma.plan.update({
        where: { idPlan },
        data: {
          nombre: p.nombre,
          velocidadMbps: p.velocidadMbps,
          precioMensual: p.precio,
          paraTodos: p.paraTodos,
          fechaActualizacion: new Date(),
          administradores: p.paraTodos
            ? undefined
            : { create: p.ids.map((id) => ({ idAdministrador: id })) },
        },
      }),
    ]);

    revalidatePath("/jefe/planes");
    return "Plan actualizado. Los clientes que ya lo tienen conservan su precio hasta que los cambies a este plan.";
  });
}

// ---------------------------------------------------------
// Eliminar plan (baja lógica: los clientes que lo tuvieron lo conservan)
// ---------------------------------------------------------
export async function eliminarPlan(idPlan: number): Promise<Resultado> {
  return ejecutar("eliminarPlan", async () => {
    await soloJefe();
    const plan = await prisma.plan.findUnique({ where: { idPlan } });
    if (!plan || !plan.activo)
      throw new Error("El plan no existe o ya fue eliminado");

    await prisma.plan.update({
      where: { idPlan },
      data: { activo: false, fechaActualizacion: new Date() },
    });

    revalidatePath("/jefe/planes");
    return `Plan «${plan.nombre}» eliminado. Los clientes que lo tuvieron no se ven afectados.`;
  });
}

// ---------------------------------------------------------
// Pasar uno o varios clientes a un plan del catálogo y avisar
// a sus administradores y trabajadores
// ---------------------------------------------------------
export async function migrarClientesAPlan(
  idPlan: number,
  idsServicios: number[],
): Promise<Resultado> {
  return ejecutar("migrarClientesAPlan", async () => {
    const session = await soloJefe();

    const plan = await prisma.plan.findUnique({ where: { idPlan } });
    if (!plan || !plan.activo)
      throw new Error("El plan no existe o fue eliminado");
    if (!idsServicios || idsServicios.length === 0)
      throw new Error("Selecciona al menos un cliente");

    const servicios = await prisma.servicio.findMany({
      where: {
        idServicio: { in: idsServicios },
        cliente: { estadoAprobacion: "ACEPTADO" },
      },
      include: {
        cliente: {
          select: {
            nombre: true,
            apellido: true,
            idAsignadoA: true,
            asignadoA: { select: { idSupervisor: true } },
          },
        },
      },
    });
    if (servicios.length === 0)
      throw new Error("Ninguno de los clientes seleccionados se puede cambiar");

    const precio = Number(plan.precioMensual);

    await prisma.$transaction(async (tx) => {
      await tx.servicio.updateMany({
        where: { idServicio: { in: servicios.map((s) => s.idServicio) } },
        data: {
          idPlan: plan.idPlan,
          planNombre: plan.nombre,
          precioMensual: precio,
        },
      });

      const porTrabajador = new Map<number, string[]>();
      const porAdmin = new Map<number, string[]>();
      for (const s of servicios) {
        const nombre = `${s.cliente.nombre} ${s.cliente.apellido ?? ""}`.trim();
        if (s.cliente.idAsignadoA) {
          porTrabajador.set(s.cliente.idAsignadoA, [
            ...(porTrabajador.get(s.cliente.idAsignadoA) ?? []),
            nombre,
          ]);
        }
        const admin = s.cliente.asignadoA?.idSupervisor;
        if (admin)
          porAdmin.set(admin, [...(porAdmin.get(admin) ?? []), nombre]);
      }

      const lista = (n: string[]) =>
        n.length <= 8
          ? n.join(", ")
          : `${n.slice(0, 8).join(", ")} y ${n.length - 8} más`;
      const base = `El jefe ${session.user.name} cambió`;
      const destino = `al plan ${plan.nombre} (S/ ${precio.toFixed(2)}/mes)`;

      const notificaciones = [
        ...Array.from(porTrabajador.entries()).map(([id, n]) => ({
          idUsuarioDestino: id,
          mensaje: `${base} ${n.length} cliente(s) tuyo(s) ${destino}: ${lista(n)}. El nuevo precio aplica a los recibos que se emitan desde ahora.`,
        })),
        ...Array.from(porAdmin.entries()).map(([id, n]) => ({
          idUsuarioDestino: id,
          mensaje: `${base} ${n.length} cliente(s) de tu equipo ${destino}: ${lista(n)}.`,
        })),
      ];
      if (notificaciones.length > 0)
        await tx.notificacion.createMany({ data: notificaciones });
    });

    revalidatePath("/jefe/planes");
    revalidatePath("/clientes/gestion");
    return `${servicios.length} cliente(s) cambiados al plan ${plan.nombre}. Se notificó a sus administradores y trabajadores.`;
  });
}
