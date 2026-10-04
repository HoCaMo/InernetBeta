import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import {
  periodoTexto,
  penultimoDiaDeMes,
  mesSiguiente,
  nombreMes,
} from "@/app/lib/facturacion";

// Vercel Cron llama esta ruta una vez al día (ver vercel.json).
// Protegida con CRON_SECRET para que nadie más la pueda disparar.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const hoy = new Date();
  const resultados = { emitidos: 0, vencidos: 0 };

  // --- 1) El día 20: emite el recibo del mes siguiente para clientes activos sin ese recibo ---
  if (hoy.getDate() === 20) {
    const anio = hoy.getFullYear();
    const mes = hoy.getMonth();
    const { anio: anioSig, mes: mesSig } = mesSiguiente(anio, mes);
    const periodoSiguiente = periodoTexto(anioSig, mesSig);

    const clientes = await prisma.cliente.findMany({
      where: {
        estadoAprobacion: "ACEPTADO",
        activo: true,
        pagoMensual: { not: null },
      },
    });

    for (const cliente of clientes) {
      const yaExiste = await prisma.pago.findUnique({
        where: {
          uq_pago_cliente_periodo: {
            idCliente: cliente.idCliente,
            periodo: periodoSiguiente,
          },
        },
      });
      if (yaExiste) continue;

      await prisma.pago.create({
        data: {
          idCliente: cliente.idCliente,
          periodo: periodoSiguiente,
          concepto: `Mensualidad de ${nombreMes(mesSig)}`,
          monto: Number(cliente.pagoMensual),
          descuento: 0,
          montoFinal: Number(cliente.pagoMensual),
          fechaEmision: hoy,
          fechaVencimiento: penultimoDiaDeMes(anioSig, mesSig),
          estado: "PENDIENTE",
        },
      });

      if (cliente.idAsignadoA) {
        await prisma.notificacion.create({
          data: {
            idUsuarioDestino: cliente.idAsignadoA,
            mensaje: `Se emitió el recibo de ${nombreMes(mesSig)} para "${cliente.nombre} ${cliente.apellido}". Debe pagarse antes del ${penultimoDiaDeMes(anioSig, mesSig).toLocaleDateString("es-PE")} para no suspender el servicio.`,
          },
        });
      }

      resultados.emitidos++;
    }
  }

  // --- 2) Marca como VENCIDO cualquier pago PENDIENTE cuya fecha de vencimiento ya pasó ---
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
