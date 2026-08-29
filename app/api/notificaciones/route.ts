import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/app/lib/db";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const notificaciones = await prisma.notificacion.findMany({
    where: { idUsuarioDestino: session.user.idUsuario },
    orderBy: { fecha: "desc" },
    take: 20,
  });

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  return NextResponse.json({ notificaciones, noLeidas });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json();

  if (body.marcarTodas) {
    await prisma.notificacion.updateMany({
      where: { idUsuarioDestino: session.user.idUsuario, leida: false },
      data: { leida: true },
    });
  } else if (body.idNotificacion) {
    await prisma.notificacion.updateMany({
      where: {
        idNotificacion: body.idNotificacion,
        idUsuarioDestino: session.user.idUsuario,
      },
      data: { leida: true },
    });
  }

  return NextResponse.json({ ok: true });
}
