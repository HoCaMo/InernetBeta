import { PLAN_PRECIOS } from "@/app/lib/constantes";

export type DatosServicio = {
  planTarifario: string;
  precioMensual: number;
  fechaHoraInstalacion: Date;
  tipoAccion: string;
  tipoInstalacion: string;
  tieneCostoInstalacion: boolean;
  derechoInstalacion: number | null;
  tieneServicioAdicional: boolean;
  servicioAdicionalDetalle: string | null;
  servicioAdicionalPrecio: number | null;
};

function leerMonto(formData: FormData, campo: string, mensaje: string): number {
  const texto = ((formData.get(campo) as string) ?? "").trim();
  const valor = Number(texto);
  if (!texto || Number.isNaN(valor) || valor < 0) throw new Error(mensaje);
  return valor;
}

export function leerDatosServicio(formData: FormData): DatosServicio {
  // --- Plan: el precio sale de la tabla de planes ---
  const planTarifario = formData.get("planTarifario") as string;
  const precioMensual = PLAN_PRECIOS[planTarifario];
  if (!precioMensual) throw new Error("Selecciona un plan tarifario válido");

  // --- Fecha y hora de instalación (hora 1-12 + AM/PM) ---
  const fechaTexto = formData.get("fechaInstalacion") as string;
  const horaTexto = formData.get("horaInstalacion") as string;
  const minutoTexto = formData.get("minutoInstalacion") as string;
  const periodo = formData.get("periodoInstalacion") as string;
  if (!fechaTexto || !horaTexto || !minutoTexto || !periodo) {
    throw new Error("Completa la fecha y hora de instalación");
  }

  const hora12 = Number(horaTexto);
  if (Number.isNaN(hora12) || hora12 < 1 || hora12 > 12)
    throw new Error("Hora de instalación inválida");
  const hora24 =
    periodo === "AM"
      ? hora12 === 12
        ? 0
        : hora12
      : hora12 === 12
        ? 12
        : hora12 + 12;

  const fechaHoraInstalacion = new Date(
    `${fechaTexto}T${String(hora24).padStart(2, "0")}:${minutoTexto}:00`,
  );
  if (Number.isNaN(fechaHoraInstalacion.getTime()))
    throw new Error("La fecha y hora de instalación no es válida");

  const tipoAccion = formData.get("tipoAccion") as string;
  const tipoInstalacion = formData.get("tipoInstalacion") as string;
  if (!tipoAccion || !tipoInstalacion)
    throw new Error("Indica el tipo de acción y si es fijo o no fijo");

  // --- Derecho de instalación (opcional) ---
  const tieneCostoInstalacion = formData.get("tieneCostoInstalacion") === "si";
  const derechoInstalacion = tieneCostoInstalacion
    ? leerMonto(
        formData,
        "derechoInstalacion",
        "Ingresa un monto válido para el derecho de instalación",
      )
    : null;

  // --- Servicio adicional (opcional): el trabajador escribe el tipo y el precio ---
  const tieneServicioAdicional =
    formData.get("tieneServicioAdicional") === "si";
  let servicioAdicionalDetalle: string | null = null;
  let servicioAdicionalPrecio: number | null = null;
  if (tieneServicioAdicional) {
    servicioAdicionalDetalle = (
      (formData.get("servicioAdicionalDetalle") as string) ?? ""
    ).trim();
    if (!servicioAdicionalDetalle)
      throw new Error("Escribe qué servicio adicional se realizará");
    if (servicioAdicionalDetalle.length > 120)
      throw new Error(
        "El detalle del servicio adicional es muy largo (máximo 120 caracteres)",
      );
    servicioAdicionalPrecio = leerMonto(
      formData,
      "servicioAdicionalPrecio",
      "Ingresa un precio válido para el servicio adicional",
    );
  }

  return {
    planTarifario,
    precioMensual,
    fechaHoraInstalacion,
    tipoAccion,
    tipoInstalacion,
    tieneCostoInstalacion,
    derechoInstalacion,
    tieneServicioAdicional,
    servicioAdicionalDetalle,
    servicioAdicionalPrecio,
  };
}
