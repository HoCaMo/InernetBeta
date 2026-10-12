import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { PLAN_LABELS } from "@/app/lib/constantes";
import {
  periodoTexto,
  mesSiguiente,
  nombreMes,
  fechaVencimientoDe,
  fechaCobroDe,
} from "@/app/lib/facturacion";

// Vercel Cron llama esta ruta una vez al día (ver vercel.json). Protegida con CRON_SECRET.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const hoy = new Date();
  const resultados = { emitidos: 0, vencidos: 0 };

  // 1) El día 20: emite el recibo del mes siguiente de cada plan que aún no lo tenga
  if (hoy.getDate() === 20) {
    const { anio, mes } = mesSiguiente(hoy.getFullYear(), hoy.getMonth());
    const periodo = periodoTexto(anio, mes);

    const servicios = await prisma.servicio.findMany({
      where: { cliente: { estadoAprobacion: "ACEPTADO", activo: true } },
      include: { cliente: true },
    });

    for (const s of servicios) {
      const yaExiste = await prisma.pago.findFirst({
        where: { idServicio: s.idServicio, periodo },
      });
      if (yaExiste) continue;

      const precio = Number(s.precioMensual);
      const vencimiento = fechaVencimientoDe(anio, mes, s.diaVencimiento);

      await prisma.pago.create({
        data: {
          idCliente: s.idCliente,
          idServicio: s.idServicio,
          periodo,
          concepto: `Mensualidad de ${nombreMes(mes)} — ${PLAN_LABELS[s.planTarifario]}`,
          monto: precio,
          descuento: 0,
          montoFinal: precio,
          fechaEmision: hoy,
          fechaCobro: fechaCobroDe(anio, mes, s.diaCobro),
          fechaVencimiento: vencimiento,
          estado: "PENDIENTE",
        },
      });

      if (s.cliente.idAsignadoA) {
        await prisma.notificacion.create({
          data: {
            idUsuarioDestino: s.cliente.idAsignadoA,
            mensaje: `Se emitió el recibo de ${nombreMes(mes)} (${PLAN_LABELS[s.planTarifario]}) de "${s.cliente.nombre} ${s.cliente.apellido}". Debe pagarse antes del ${vencimiento.toLocaleDateString("es-PE")} para no suspender el servicio.`,
          },
        });
      }
      resultados.emitidos++;
    }
  }

  // 2) Marca como VENCIDO todo pago PENDIENTE cuya fecha de vencimiento ya pasó
  const vencidos = await prisma.pago.updateMany({
    where: { estado: "PENDIENTE", fechaVencimiento: { lt: hoy } },
    data: { estado: "VENCIDO" },
  });
  resultados.vencidos = vencidos.count;

  return NextResponse.json({
    ok: true,
    fecha: hoy.toISOString(),
    ...resultados,
  });
}
