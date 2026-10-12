// Utilidades de facturación por plan (servicio) de un cliente.
// Reglas:
// - El primer recibo cobra por adelantado: instalación (si aplica) + mes completo + servicio adicional (si aplica).
// - El segundo mes lleva un descuento prorrateado por los días del primer mes anteriores a la instalación.
// - Cada plan tiene su día de cobro (por defecto 1) y su día de vencimiento (por defecto, el penúltimo del mes).
// - El recibo del mes siguiente se emite el día 20 del mes anterior.

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

export function diasDelMes(anio: number, mesIndiceCero: number): number {
  return new Date(anio, mesIndiceCero + 1, 0).getDate();
}

export function penultimoDiaDeMes(anio: number, mesIndiceCero: number): Date {
  return new Date(
    anio,
    mesIndiceCero,
    diasDelMes(anio, mesIndiceCero) - 1,
    23,
    59,
    59,
  );
}

// null/undefined = penúltimo día del mes
export function fechaVencimientoDe(
  anio: number,
  mesIndiceCero: number,
  diaVencimiento?: number | null,
): Date {
  if (diaVencimiento == null) return penultimoDiaDeMes(anio, mesIndiceCero);
  const dia = Math.min(
    Math.max(diaVencimiento, 1),
    diasDelMes(anio, mesIndiceCero),
  );
  return new Date(anio, mesIndiceCero, dia, 23, 59, 59);
}

export function fechaCobroDe(
  anio: number,
  mesIndiceCero: number,
  diaCobro: number,
): Date {
  const dia = Math.min(Math.max(diaCobro, 1), diasDelMes(anio, mesIndiceCero));
  return new Date(anio, mesIndiceCero, dia);
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

const redondear = (n: number) => Number(n.toFixed(2));
const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const limitar = (t: string) => (t.length > 150 ? t.slice(0, 149) + "…" : t);

export type ParametrosFacturacion = {
  fechaHoraInstalacion: Date;
  precioMensual: number;
  derechoInstalacion: number;
  servicioAdicionalPrecio: number;
  servicioAdicionalDetalle?: string | null;
  etiquetaPlan?: string;
  diaCobro: number;
  diaVencimiento: number | null;
};

export function calcularFacturacionInicial(p: ParametrosFacturacion) {
  const anio = p.fechaHoraInstalacion.getFullYear();
  const mes = p.fechaHoraInstalacion.getMonth();
  const diaInstalacion = p.fechaHoraInstalacion.getDate();
  const sufijoPlan = p.etiquetaPlan ? ` — ${p.etiquetaPlan}` : "";

  // --- Recibo 1: pagado de inmediato, por adelantado ---
  const partes: string[] = [];
  if (p.derechoInstalacion > 0) partes.push("instalación");
  partes.push(`mensualidad de ${nombreMes(mes)}`);
  if (p.servicioAdicionalPrecio > 0) {
    partes.push(
      `servicio adicional${p.servicioAdicionalDetalle ? ` (${p.servicioAdicionalDetalle})` : ""}`,
    );
  }
  const total1 = redondear(
    p.precioMensual + p.derechoInstalacion + p.servicioAdicionalPrecio,
  );

  const recibo1 = {
    periodo: periodoTexto(anio, mes),
    concepto: limitar(capitalizar(partes.join(" + ")) + sufijoPlan),
    monto: total1,
    descuento: 0,
    montoFinal: total1,
    fechaEmision: p.fechaHoraInstalacion,
    fechaCobro: p.fechaHoraInstalacion,
    fechaVencimiento: fechaVencimientoDe(anio, mes, p.diaVencimiento),
    fechaPago: p.fechaHoraInstalacion as Date | null,
    estado: "PAGADO" as const,
  };

  // --- Recibo 2: mes siguiente con descuento por días no usados del mes 1 ---
  const { anio: anio2, mes: mes2 } = mesSiguiente(anio, mes);
  const diasNoUsados = diaInstalacion - 1;
  const descuento = redondear(
    (p.precioMensual / diasDelMes(anio, mes)) * diasNoUsados,
  );

  const recibo2 = {
    periodo: periodoTexto(anio2, mes2),
    concepto: limitar(
      `Mensualidad de ${nombreMes(mes2)}${descuento > 0 ? ` (descuento por días no usados en ${nombreMes(mes)})` : ""}` +
        sufijoPlan,
    ),
    monto: p.precioMensual,
    descuento,
    montoFinal: redondear(p.precioMensual - descuento),
    fechaEmision: new Date(anio, mes, 20),
    fechaCobro: fechaCobroDe(anio2, mes2, p.diaCobro),
    fechaVencimiento: fechaVencimientoDe(anio2, mes2, p.diaVencimiento),
    fechaPago: null as Date | null,
    estado: "PENDIENTE" as const,
  };

  return { recibo1, recibo2 };
}
