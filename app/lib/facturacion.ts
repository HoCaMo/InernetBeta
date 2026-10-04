// Utilidades de facturación para el ciclo de pagos de un cliente.
// Reglas de negocio:
// - El primer mes (instalación) se paga completo por adelantado, junto con el derecho de instalación.
// - El segundo mes recibe un descuento prorrateado por los días del primer mes que no se usaron
//   (los días antes de la fecha de instalación dentro de ese mes).
// - El cobro de cada mes corresponde al día 1; vence el penúltimo día de ese mes.
// - El recibo del mes siguiente se emite el día 20 del mes anterior.

export function diasDelMes(anio: number, mesIndiceCero: number): number {
  // Día 0 del mes siguiente = último día del mes actual
  return new Date(anio, mesIndiceCero + 1, 0).getDate();
}

export function penultimoDiaDeMes(anio: number, mesIndiceCero: number): Date {
  const totalDias = diasDelMes(anio, mesIndiceCero);
  return new Date(anio, mesIndiceCero, totalDias - 1, 23, 59, 59);
}

export function periodoTexto(anio: number, mesIndiceCero: number): string {
  return `${anio}-${String(mesIndiceCero + 1).padStart(2, "0")}`;
}

export function mesSiguiente(
  anio: number,
  mesIndiceCero: number,
): { anio: number; mes: number } {
  if (mesIndiceCero === 11) return { anio: anio + 1, mes: 0 };
  return { anio, mes: mesIndiceCero + 1 };
}

/**
 * Calcula los montos del primer y segundo recibo a partir de la fecha de instalación.
 */
export function calcularFacturacionInicial(
  fechaHoraInstalacion: Date,
  pagoMensual: number,
  derechoInstalacion: number,
) {
  const anio = fechaHoraInstalacion.getFullYear();
  const mes = fechaHoraInstalacion.getMonth(); // 0-indexado
  const diaInstalacion = fechaHoraInstalacion.getDate();

  const totalDiasMes1 = diasDelMes(anio, mes);
  const diasNoUsadosMes1 = diaInstalacion - 1; // días antes de la instalación, no se usó el servicio

  // --- Recibo 1: instalación + mes completo, pagado de inmediato ---
  const recibo1 = {
    periodo: periodoTexto(anio, mes),
    concepto: `Instalación + mensualidad de ${nombreMes(mes)}`,
    monto: pagoMensual,
    descuento: 0,
    montoFinal: pagoMensual + derechoInstalacion,
    fechaEmision: fechaHoraInstalacion,
    fechaVencimiento: penultimoDiaDeMes(anio, mes),
    fechaPago: fechaHoraInstalacion, // se paga en el momento, por adelantado
    estado: "PAGADO" as const,
  };

  // --- Recibo 2: mes siguiente, con descuento prorrateado por días no usados del mes 1 ---
  const { anio: anio2, mes: mes2 } = mesSiguiente(anio, mes);
  const descuentoProrrateo = Number(
    ((pagoMensual / totalDiasMes1) * diasNoUsadosMes1).toFixed(2),
  );

  const fechaEmisionRecibo2 = new Date(anio, mes, 20); // día 20 del mes 1

  const recibo2 = {
    periodo: periodoTexto(anio2, mes2),
    concepto: `Mensualidad de ${nombreMes(mes2)}${descuentoProrrateo > 0 ? " (con descuento por días no usados en " + nombreMes(mes) + ")" : ""}`,
    monto: pagoMensual,
    descuento: descuentoProrrateo,
    montoFinal: Number((pagoMensual - descuentoProrrateo).toFixed(2)),
    fechaEmision: fechaEmisionRecibo2,
    fechaVencimiento: penultimoDiaDeMes(anio2, mes2),
    fechaPago: null,
    estado: "PENDIENTE" as const,
  };

  return { recibo1, recibo2 };
}

const NOMBRES_MES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function nombreMes(mesIndiceCero: number): string {
  return NOMBRES_MES[mesIndiceCero];
}
