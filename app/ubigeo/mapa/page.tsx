import { auth } from "@/auth";
import { prisma } from "@/app/lib/db";
import { redirect } from "next/navigation";
import Shell from "@/app/components/Shell";
import MapaClientes from "./MapaClientes";

const PALETA_COLORES = [
  "#f59e0b",
  "#3b82f6",
  "#10b981",
  "#ef4444",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

function colorPara(id: number) {
  return PALETA_COLORES[id % PALETA_COLORES.length];
}

export default async function MapaUbigeoPage() {
  const session = await auth();
  if (!session) redirect("/login");

  let clientes;
  let leyenda: { color: string; etiqueta: string }[] = [];

  if (session.user.rol === "JEFE") {
    // El jefe ve todo, coloreado por administrador (de quién es la zona)
    clientes = await prisma.cliente.findMany({
      where: { latitud: { not: null }, longitud: { not: null } },
      include: {
        asignadoA: {
          include: {
            supervisor: { select: { idUsuario: true, nombre: true } },
          },
        },
      },
    });

    const administradores = new Map<number, string>();
    clientes.forEach((c) => {
      const admin = c.asignadoA?.supervisor;
      if (admin) administradores.set(admin.idUsuario, admin.nombre);
    });
    leyenda = Array.from(administradores.entries()).map(([id, nombre]) => ({
      color: colorPara(id),
      etiqueta: nombre,
    }));
  } else if (session.user.rol === "ADMINISTRADOR") {
    // El administrador ve las zonas de los clientes de sus trabajadores
    clientes = await prisma.cliente.findMany({
      where: {
        latitud: { not: null },
        longitud: { not: null },
        asignadoA: { idSupervisor: session.user.idUsuario },
      },
      include: { asignadoA: { select: { idUsuario: true, nombre: true } } },
    });
  } else {
    // El trabajador ve la ubicación de sus propios clientes
    clientes = await prisma.cliente.findMany({
      where: {
        latitud: { not: null },
        longitud: { not: null },
        idAsignadoA: session.user.idUsuario,
      },
    });
  }

  const marcadores = clientes.map((c) => {
    const admin =
      session.user.rol === "JEFE"
        ? (
            c as (typeof clientes)[number] & {
              asignadoA?: {
                supervisor?: { idUsuario: number; nombre: string } | null;
              };
            }
          ).asignadoA?.supervisor
        : null;
    return {
      id: c.idCliente,
      lat: Number(c.latitud),
      lng: Number(c.longitud),
      color: admin ? colorPara(admin.idUsuario) : undefined,
      popup: `
        <strong>${c.nombre} ${c.apellido ?? ""}</strong><br/>
        ${c.direccion ?? ""}<br/>
        ${"asignadoA" in c && c.asignadoA ? `Trabajador: ${(c.asignadoA as { nombre: string }).nombre}<br/>` : ""}
        ${admin ? `Administrador: ${admin.nombre}<br/>` : ""}
        <a href="/clientes/${c.idCliente}" style="color:#f59e0b">Ver detalle →</a>
      `,
    };
  });

  return (
    <Shell nombre={session.user.name ?? ""} rol={session.user.rol}>
      <h1 className="mb-1 text-2xl font-semibold text-white">Mapa de zonas</h1>
      <p className="mb-6 text-sm text-slate-400">
        {session.user.rol === "JEFE" &&
          "Todas las zonas, coloreadas por administrador."}
        {session.user.rol === "ADMINISTRADOR" &&
          "Zonas de los clientes de tu equipo."}
        {session.user.rol === "TRABAJADOR" && "Ubicación de tus clientes."}
      </p>

      {session.user.rol === "JEFE" && leyenda.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          {leyenda.map((l) => (
            <span
              key={l.etiqueta}
              className="flex items-center gap-1.5 text-xs text-slate-400"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: l.color }}
              />
              {l.etiqueta}
            </span>
          ))}
        </div>
      )}

      <MapaClientes marcadores={marcadores} />
    </Shell>
  );
}
