"use server";

import { prisma } from "@/app/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma, type Servicio } from "@prisma/client";
import {
  PLAN_PRECIOS,
  PLAN_LABELS,
  LONGITUD_DOCUMENTO,
} from "@/app/lib/constantes";
import { calcularFacturacionInicial } from "@/app/lib/facturacion";
import { leerDatosServicio } from "@/app/lib/servicios";

type Decision = "ACEPTADA" | "RECHAZADA";

// ===========================================================
// UTILIDADES INTERNAS
// ===========================================================

// En producción Next.js oculta los errores lanzados desde una Server Action.
// Por eso las acciones que se llaman desde botones devuelven { ok, error }.
function mensajeDeError(err: unknown): string {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    const campos = (err.meta?.target as string[] | string | undefined) ?? "";
    const texto = Array.isArray(campos) ? campos.join(", ") : String(campos);
    return `Ya existe un registro con ese valor${texto ? ` (${texto})` : ""}.`;
  }
  if (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientValidationError ||
    err instanceof Prisma.PrismaClientInitializationError
  ) {
    return "No se pudo guardar en la base de datos. Revisa los datos o avisa al responsable del sistema.";
  }
  if (err instanceof Error) return err.message;
  return "Ocurrió un error inesperado.";
}

async function conResultado(
  etiqueta: string,
  fn: () => Promise<void>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    console.error(`${etiqueta} falló:`, err);
    return { ok: false, error: mensajeDeError(err) };
  }
}

async function verificarResolutor() {
  const session = await auth();
  if (!session) throw new Error("No tienes una sesión activa");
  if (session.user.rol !== "JEFE" && session.user.rol !== "ADMINISTRADOR") {
    throw new Error("No tienes permisos para resolver solicitudes");
  }
  return session;
}

// TRABAJADOR: solo sobre sus clientes. ADMINISTRADOR: solo sobre clientes de trabajadores que supervisa.
async function verificarAccesoCliente(
  idCliente: number,
  idUsuario: number,
  rol: string,
) {
  const cliente = await prisma.cliente.findUnique({
    where: { idCliente },
    include: { asignadoA: { select: { idSupervisor: true } } },
  });
  if (!cliente) throw new Error("Cliente no encontrado");

  if (rol === "TRABAJADOR" && cliente.idAsignadoA !== idUsuario) {
    throw new Error("Solo puedes solicitar cambios sobre tus propios clientes");
  }
  if (
    rol === "ADMINISTRADOR" &&
    cliente.asignadoA?.idSupervisor !== idUsuario
  ) {
    throw new Error(
      "Solo puedes solicitar cambios sobre clientes de trabajadores que supervisas",
    );
  }
  return cliente;
}

// Nadie aprueba su propia solicitud ni la de su mismo nivel:
// - pedida por ADMINISTRADOR -> solo la resuelve el JEFE
// - pedida por TRABAJADOR -> la resuelve el JEFE o el ADMINISTRADOR que lo supervisa
async function verificarAlcanceResolutor(
  session: { user: { rol: string; idUsuario: number } },
  idSolicitante: number,
  rolSolicitante: string,
) {
  if (rolSolicitante === "ADMINISTRADOR" && session.user.rol !== "JEFE") {
    throw new Error(
      "Una solicitud hecha por un administrador solo puede resolverla el jefe",
    );
  }
  if (rolSolicitante === "TRABAJADOR" && session.user.rol === "ADMINISTRADOR") {
    const solicitante = await prisma.usuario.findUnique({
      where: { idUsuario: idSolicitante },
      select: { idSupervisor: true },
    });
    if (solicitante?.idSupervisor !== session.user.idUsuario) {
      throw new Error(
        "Solo puedes resolver solicitudes de trabajadores que supervisas",
      );
    }
  }
}

// A quién se notifica una solicitud: los jefes y, si la pide un trabajador, su administrador.
async function destinatariosSolicitud(
  idSolicitante: number,
  rolSolicitante: string,
): Promise<number[]> {
  const jefes = await prisma.usuario.findMany({
    where: { rol: "JEFE", activo: true },
    select: { idUsuario: true },
  });
  const ids = jefes.map((j) => j.idUsuario);
  if (rolSolicitante === "TRABAJADOR") {
    const yo = await prisma.usuario.findUnique({
      where: { idUsuario: idSolicitante },
      select: { idSupervisor: true },
    });
    if (yo?.idSupervisor) ids.push(yo.idSupervisor);
  }
  return ids;
}

// Genera los dos primeros recibos de un plan (instalación + mes 1 pagado, y mes 2 con descuento).
async function generarRecibosIniciales(
  db: Prisma.TransactionClient,
  servicio: Servicio,
) {
  if (!servicio.fechaHoraInstalacion) return;
  const existentes = await db.pago.count({
    where: { idServicio: servicio.idServicio },
  });
  if (existentes > 0) return;

  const { recibo1, recibo2 } = calcularFacturacionInicial({
    fechaHoraInstalacion: servicio.fechaHoraInstalacion,
    precioMensual: Number(servicio.precioMensual),
    derechoInstalacion:
      servicio.tieneCostoInstalacion && servicio.derechoInstalacion
        ? Number(servicio.derechoInstalacion)
        : 0,
    servicioAdicionalPrecio:
      servicio.tieneServicioAdicional && servicio.servicioAdicionalPrecio
        ? Number(servicio.servicioAdicionalPrecio)
        : 0,
    servicioAdicionalDetalle: servicio.servicioAdicionalDetalle,
    etiquetaPlan: PLAN_LABELS[servicio.planTarifario],
    diaCobro: servicio.diaCobro,
    diaVencimiento: servicio.diaVencimiento,
  });

  await db.pago.createMany({
    data: [
      {
        idCliente: servicio.idCliente,
        idServicio: servicio.idServicio,
        ...recibo1,
      },
      {
        idCliente: servicio.idCliente,
        idServicio: servicio.idServicio,
        ...recibo2,
      },
    ],
  });
}

// ===========================================================
// CLIENTES — creación (TRABAJADOR)
// ===========================================================
export async function crearClienteConSolicitud(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return conResultado("crearClienteConSolicitud", () =>
    crearClienteInterno(formData),
  );
}

async function crearClienteInterno(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "TRABAJADOR") {
    throw new Error("Solo un trabajador puede generar clientes");
  }
  const idUsuario = session.user.idUsuario;

  const tipoDocumento = formData.get("tipoDocumento") as string;
  const numeroDocumento = (
    (formData.get("numeroDocumento") as string) ?? ""
  ).trim();
  const longitudEsperada = LONGITUD_DOCUMENTO[tipoDocumento];
  if (!longitudEsperada) throw new Error("Tipo de documento inválido");
  if (numeroDocumento.length !== longitudEsperada) {
    throw new Error(
      `El número de ${tipoDocumento} debe tener exactamente ${longitudEsperada} caracteres (ingresaste ${numeroDocumento.length}).`,
    );
  }

  const departamento = formData.get("departamento") as string;
  const provincia = formData.get("provincia") as string;
  const distrito = formData.get("distrito") as string;
  if (!departamento || !provincia || !distrito) {
    throw new Error("Selecciona departamento, provincia y distrito");
  }
  const nacionalidad = formData.get("nacionalidad") as string;

  const tipoCliente: "NACIONAL" | "EXTRANJERO" | "EMPRESA" =
    tipoDocumento === "RUC"
      ? "EMPRESA"
      : nacionalidad === "EXTRANJERA"
        ? "EXTRANJERO"
        : "NACIONAL";

  const servicio = leerDatosServicio(formData);

  const latTexto = ((formData.get("latitud") as string) ?? "").trim();
  const lngTexto = ((formData.get("longitud") as string) ?? "").trim();
  const latitud = Number(latTexto);
  const longitud = Number(lngTexto);
  if (
    !latTexto ||
    !lngTexto ||
    Number.isNaN(latitud) ||
    Number.isNaN(longitud)
  ) {
    throw new Error("Marca la ubicación exacta del cliente en el mapa");
  }

  const documentoExistente = await prisma.documentoCliente.findFirst({
    where: { tipoDocumento: tipoDocumento as never, numeroDocumento },
  });
  if (documentoExistente) {
    throw new Error(
      "Ya existe un cliente con ese documento. Si es el mismo cliente, abre su ficha y usa «Agregar otro plan».",
    );
  }

  const destinatarios = await destinatariosSolicitud(idUsuario, "TRABAJADOR");
  const ahora = new Date();

  await prisma.$transaction(async (tx) => {
    let ubigeo = await tx.ubigeo.findFirst({
      where: { departamento, provincia, distrito, localidad: "" },
    });
    if (!ubigeo) {
      ubigeo = await tx.ubigeo.create({
        data: { departamento, provincia, distrito, localidad: "" },
      });
    }

    const cliente = await tx.cliente.create({
      data: {
        nombre: formData.get("nombre") as string,
        apellido: formData.get("apellido") as string,
        tipoCliente,
        correo: (formData.get("correo") as string) || null,
        direccion: formData.get("domicilioInstalacion") as string,
        idUbigeo: ubigeo.idUbigeo,
        latitud,
        longitud,
        nacionalidad,
        representanteLegal:
          (formData.get("representanteLegal") as string) || null,
        usoServicio: formData.get("usoServicio") as never,
        condicionCliente: formData.get("condicionCliente") as never,
        fechaInicio: ahora,
        idCreadoPor: idUsuario,
        idAsignadoA: idUsuario,
        estadoAprobacion: "PENDIENTE",
        datosCompletos: true,
      },
    });

    const nuevoServicio = await tx.servicio.create({
      data: {
        idCliente: cliente.idCliente,
        planTarifario: servicio.planTarifario as never,
        precioMensual: servicio.precioMensual,
        fechaHoraInstalacion: servicio.fechaHoraInstalacion,
        tipoAccion: servicio.tipoAccion as never,
        tipoInstalacion: servicio.tipoInstalacion as never,
        tieneCostoInstalacion: servicio.tieneCostoInstalacion,
        derechoInstalacion: servicio.derechoInstalacion,
        tieneServicioAdicional: servicio.tieneServicioAdicional,
        servicioAdicionalDetalle: servicio.servicioAdicionalDetalle,
        servicioAdicionalPrecio: servicio.servicioAdicionalPrecio,
      },
    });

    await tx.documentoCliente.create({
      data: {
        idCliente: cliente.idCliente,
        tipoDocumento: tipoDocumento as never,
        numeroDocumento,
      },
    });

    const telefono = ((formData.get("telefono") as string) ?? "").trim();
    if (telefono) {
      const telefonoExistente = await tx.telefono.findUnique({
        where: { numero: telefono },
      });
      if (telefonoExistente) {
        throw new Error(
          `El número de teléfono ${telefono} ya está registrado.`,
        );
      }
      await tx.telefono.create({
        data: {
          idCliente: cliente.idCliente,
          numero: telefono,
          principal: true,
        },
      });
    }

    await tx.solicitud.create({
      data: {
        tipo: "CREACION_CLIENTE",
        idSolicitante: idUsuario,
        idCliente: cliente.idCliente,
        idServicio: nuevoServicio.idServicio,
      },
    });

    const mensaje =
      `Cliente "${cliente.nombre} ${cliente.apellido}" generado por ${session.user.name}. ` +
      `Plan ${PLAN_LABELS[servicio.planTarifario]} (S/ ${servicio.precioMensual.toFixed(2)}/mes). ` +
      `Instalación programada: ${servicio.fechaHoraInstalacion.toLocaleString("es-PE")}. ` +
      (servicio.tieneCostoInstalacion
        ? `Derecho de instalación: S/ ${servicio.derechoInstalacion?.toFixed(2)}. `
        : "Sin cobro de derecho de instalación. ") +
      (servicio.tieneServicioAdicional
        ? `Servicio adicional: ${servicio.servicioAdicionalDetalle} (S/ ${servicio.servicioAdicionalPrecio?.toFixed(2)}).`
        : "");

    if (destinatarios.length > 0) {
      await tx.notificacion.createMany({
        data: destinatarios.map((id) => ({ idUsuarioDestino: id, mensaje })),
      });
    }
  });

  revalidatePath("/solicitudes");
  revalidatePath("/trabajador");
}

// ===========================================================
// CLIENTES — solicitar edición (TRABAJADOR sobre sus clientes, o
// ADMINISTRADOR sobre clientes de trabajadores que supervisa)
// ===========================================================
export async function crearSolicitudEdicionCliente(
  idCliente: number,
  formData: FormData,
) {
  const session = await auth();
  if (
    !session ||
    (session.user.rol !== "TRABAJADOR" && session.user.rol !== "ADMINISTRADOR")
  ) {
    throw new Error(
      "No tienes permiso para solicitar la edición de un cliente",
    );
  }

  const cliente = await verificarAccesoCliente(
    idCliente,
    session.user.idUsuario,
    session.user.rol,
  );

  const cambios: Record<string, string> = {};
  const nombre = (formData.get("nombre") as string)?.trim();
  const apellido = (formData.get("apellido") as string)?.trim();
  const correo = (formData.get("correo") as string)?.trim();
  const domicilioInstalacion = (
    formData.get("domicilioInstalacion") as string
  )?.trim();

  if (nombre && nombre !== cliente.nombre) cambios.nombre = nombre;
  if (apellido && apellido !== cliente.apellido) cambios.apellido = apellido;
  if (correo && correo !== cliente.correo) cambios.correo = correo;
  if (domicilioInstalacion && domicilioInstalacion !== cliente.direccion)
    cambios.direccion = domicilioInstalacion;

  if (Object.keys(cambios).length === 0) {
    throw new Error("No hiciste ningún cambio respecto a los datos actuales");
  }

  await prisma.solicitud.create({
    data: {
      tipo: "EDICION_CLIENTE",
      idSolicitante: session.user.idUsuario,
      idCliente,
      datosPropuestos: cambios,
    },
  });

  const destinatarios = await destinatariosSolicitud(
    session.user.idUsuario,
    session.user.rol,
  );
  const mensaje = `${session.user.name} (${session.user.rol}) solicitó editar al cliente "${cliente.nombre} ${cliente.apellido}".`;
  await prisma.notificacion.createMany({
    data: destinatarios.map((id) => ({ idUsuarioDestino: id, mensaje })),
  });

  revalidatePath("/solicitudes");
  revalidatePath("/trabajador");
  revalidatePath("/administrador");
}

// ===========================================================
// CLIENTES — solicitar eliminación (mismo alcance que la edición)
// ===========================================================
export async function crearSolicitudEliminacionCliente(
  idCliente: number,
  comentario?: string,
) {
  const session = await auth();
  if (
    !session ||
    (session.user.rol !== "TRABAJADOR" && session.user.rol !== "ADMINISTRADOR")
  ) {
    throw new Error(
      "No tienes permiso para solicitar la eliminación de un cliente",
    );
  }

  const cliente = await verificarAccesoCliente(
    idCliente,
    session.user.idUsuario,
    session.user.rol,
  );

  await prisma.solicitud.create({
    data: {
      tipo: "ELIMINACION_CLIENTE",
      idSolicitante: session.user.idUsuario,
      idCliente,
      comentario: comentario?.trim() || null,
    },
  });

  const destinatarios = await destinatariosSolicitud(
    session.user.idUsuario,
    session.user.rol,
  );
  const mensaje = `${session.user.name} (${session.user.rol}) solicitó ELIMINAR al cliente "${cliente.nombre} ${cliente.apellido}".`;
  await prisma.notificacion.createMany({
    data: destinatarios.map((id) => ({ idUsuarioDestino: id, mensaje })),
  });

  revalidatePath("/solicitudes");
  revalidatePath("/trabajador");
  revalidatePath("/administrador");
}

// ===========================================================
// PLANES — solicitar cambio de plan / precio / fechas de pago de UN plan del cliente
// (lo piden TRABAJADOR o ADMINISTRADOR; lo aprueban ADMINISTRADOR o JEFE)
// ===========================================================
export async function crearSolicitudCambioServicio(
  idServicio: number,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return conResultado("crearSolicitudCambioServicio", async () => {
    const session = await auth();
    if (
      !session ||
      (session.user.rol !== "TRABAJADOR" &&
        session.user.rol !== "ADMINISTRADOR")
    ) {
      throw new Error(
        "Solo un trabajador o un administrador puede solicitar este cambio",
      );
    }

    const servicio = await prisma.servicio.findUnique({
      where: { idServicio },
    });
    if (!servicio) throw new Error("Plan no encontrado");

    const cliente = await verificarAccesoCliente(
      servicio.idCliente,
      session.user.idUsuario,
      session.user.rol,
    );
    if (cliente.estadoAprobacion !== "ACEPTADO") {
      throw new Error(
        "Solo se pueden modificar planes de clientes ya aceptados",
      );
    }

    const cambios: Record<string, string | number | null> = {};

    const plan = formData.get("planTarifario") as string;
    if (plan && plan !== servicio.planTarifario) {
      if (!PLAN_PRECIOS[plan]) throw new Error("Plan tarifario inválido");
      cambios.planTarifario = plan;
    }

    const precioTexto = (
      (formData.get("precioMensual") as string) ?? ""
    ).trim();
    if (precioTexto) {
      const precio = Number(precioTexto);
      if (Number.isNaN(precio) || precio <= 0)
        throw new Error("Ingresa un precio mensual válido");
      if (precio !== Number(servicio.precioMensual))
        cambios.precioMensual = precio;
    }

    const diaCobro = Number(formData.get("diaCobro"));
    if (!Number.isInteger(diaCobro) || diaCobro < 1 || diaCobro > 28) {
      throw new Error("El día de cobro debe estar entre 1 y 28");
    }
    if (diaCobro !== servicio.diaCobro) cambios.diaCobro = diaCobro;

    const vencTexto = ((formData.get("diaVencimiento") as string) ?? "").trim();
    const diaVencimiento = vencTexto === "" ? null : Number(vencTexto);
    if (
      diaVencimiento !== null &&
      (!Number.isInteger(diaVencimiento) ||
        diaVencimiento < 1 ||
        diaVencimiento > 28)
    ) {
      throw new Error(
        "El día de vencimiento debe estar entre 1 y 28 (o el penúltimo día del mes)",
      );
    }
    if (diaVencimiento !== servicio.diaVencimiento)
      cambios.diaVencimiento = diaVencimiento;

    if (Object.keys(cambios).length === 0) {
      throw new Error(
        "No hiciste ningún cambio respecto a los datos actuales del plan",
      );
    }

    await prisma.solicitud.create({
      data: {
        tipo: "CAMBIO_SERVICIO",
        idSolicitante: session.user.idUsuario,
        idCliente: cliente.idCliente,
        idServicio,
        datosPropuestos: cambios,
      },
    });

    const destinatarios = await destinatariosSolicitud(
      session.user.idUsuario,
      session.user.rol,
    );
    const mensaje = `${session.user.name} (${session.user.rol}) solicitó cambiar el plan/precio/fechas de pago de "${cliente.nombre} ${cliente.apellido}".`;
    await prisma.notificacion.createMany({
      data: destinatarios.map((id) => ({ idUsuarioDestino: id, mensaje })),
    });

    revalidatePath("/solicitudes");
    revalidatePath(`/clientes/${cliente.idCliente}`);
  });
}

// ===========================================================
// PLANES — solicitar agregar OTRO plan a un cliente existente (mismo DNI y teléfono)
// ===========================================================
export async function crearSolicitudNuevoServicio(
  idCliente: number,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return conResultado("crearSolicitudNuevoServicio", async () => {
    const session = await auth();
    if (
      !session ||
      (session.user.rol !== "TRABAJADOR" &&
        session.user.rol !== "ADMINISTRADOR")
    ) {
      throw new Error(
        "Solo un trabajador o un administrador puede solicitar un nuevo plan",
      );
    }

    const cliente = await verificarAccesoCliente(
      idCliente,
      session.user.idUsuario,
      session.user.rol,
    );
    if (cliente.estadoAprobacion !== "ACEPTADO") {
      throw new Error("Solo se puede agregar un plan a un cliente ya aceptado");
    }

    const s = leerDatosServicio(formData);

    await prisma.solicitud.create({
      data: {
        tipo: "NUEVO_SERVICIO",
        idSolicitante: session.user.idUsuario,
        idCliente,
        datosPropuestos: {
          planTarifario: s.planTarifario,
          precioMensual: s.precioMensual,
          fechaHoraInstalacion: s.fechaHoraInstalacion.toISOString(),
          tipoAccion: s.tipoAccion,
          tipoInstalacion: s.tipoInstalacion,
          tieneCostoInstalacion: s.tieneCostoInstalacion,
          derechoInstalacion: s.derechoInstalacion,
          tieneServicioAdicional: s.tieneServicioAdicional,
          servicioAdicionalDetalle: s.servicioAdicionalDetalle,
          servicioAdicionalPrecio: s.servicioAdicionalPrecio,
        },
      },
    });

    const destinatarios = await destinatariosSolicitud(
      session.user.idUsuario,
      session.user.rol,
    );
    const mensaje = `${session.user.name} (${session.user.rol}) solicitó agregar el plan ${PLAN_LABELS[s.planTarifario]} a "${cliente.nombre} ${cliente.apellido}".`;
    await prisma.notificacion.createMany({
      data: destinatarios.map((id) => ({ idUsuarioDestino: id, mensaje })),
    });

    revalidatePath("/solicitudes");
    revalidatePath(`/clientes/${idCliente}`);
  });
}

// ===========================================================
// PLANES — resolver CAMBIO_SERVICIO / NUEVO_SERVICIO (ADMINISTRADOR o JEFE)
// ===========================================================
async function resolverServicioInterno(
  idSolicitud: number,
  decision: Decision,
) {
  const session = await verificarResolutor();

  const solicitud = await prisma.solicitud.findUnique({
    where: { idSolicitud },
    include: { cliente: true, solicitante: { select: { rol: true } } },
  });
  if (!solicitud) throw new Error("La solicitud no existe");
  if (solicitud.estado !== "PENDIENTE")
    throw new Error("Esta solicitud ya fue resuelta");
  if (
    solicitud.tipo !== "CAMBIO_SERVICIO" &&
    solicitud.tipo !== "NUEVO_SERVICIO"
  ) {
    throw new Error("El tipo de solicitud no corresponde");
  }
  await verificarAlcanceResolutor(
    session,
    solicitud.idSolicitante,
    solicitud.solicitante.rol,
  );

  await prisma.$transaction(async (tx) => {
    // Solo gana quien llegue primero
    const r = await tx.solicitud.updateMany({
      where: { idSolicitud, estado: "PENDIENTE" },
      data: {
        estado: decision,
        idResolutor: session.user.idUsuario,
        fechaResolucion: new Date(),
      },
    });
    if (r.count === 0)
      throw new Error("Esta solicitud ya fue resuelta por otro usuario");

    if (decision === "ACEPTADA") {
      const datos = (solicitud.datosPropuestos ?? {}) as Record<
        string,
        unknown
      >;

      if (solicitud.tipo === "CAMBIO_SERVICIO") {
        if (!solicitud.idServicio)
          throw new Error("La solicitud no indica a qué plan corresponde");
        const data: Prisma.ServicioUpdateInput = {};
        if (typeof datos.planTarifario === "string")
          data.planTarifario = datos.planTarifario as never;
        if (typeof datos.precioMensual === "number")
          data.precioMensual = datos.precioMensual;
        if (typeof datos.diaCobro === "number") data.diaCobro = datos.diaCobro;
        if ("diaVencimiento" in datos) {
          data.diaVencimiento =
            typeof datos.diaVencimiento === "number"
              ? datos.diaVencimiento
              : null;
        }
        await tx.servicio.update({
          where: { idServicio: solicitud.idServicio },
          data,
        });
      } else {
        if (!solicitud.idCliente)
          throw new Error("La solicitud no indica a qué cliente corresponde");
        const nuevo = await tx.servicio.create({
          data: {
            idCliente: solicitud.idCliente,
            planTarifario: String(datos.planTarifario) as never,
            precioMensual: Number(datos.precioMensual),
            fechaHoraInstalacion: new Date(String(datos.fechaHoraInstalacion)),
            tipoAccion: datos.tipoAccion as never,
            tipoInstalacion: datos.tipoInstalacion as never,
            tieneCostoInstalacion: Boolean(datos.tieneCostoInstalacion),
            derechoInstalacion:
              datos.derechoInstalacion == null
                ? null
                : Number(datos.derechoInstalacion),
            tieneServicioAdicional: Boolean(datos.tieneServicioAdicional),
            servicioAdicionalDetalle:
              datos.servicioAdicionalDetalle == null
                ? null
                : String(datos.servicioAdicionalDetalle),
            servicioAdicionalPrecio:
              datos.servicioAdicionalPrecio == null
                ? null
                : Number(datos.servicioAdicionalPrecio),
          },
        });
        await generarRecibosIniciales(tx, nuevo);
      }
    }

    const que =
      solicitud.tipo === "CAMBIO_SERVICIO"
        ? "el cambio de plan/precio/fechas de pago"
        : "el nuevo plan";
    await tx.notificacion.create({
      data: {
        idUsuarioDestino: solicitud.idSolicitante,
        mensaje:
          decision === "ACEPTADA"
            ? `Tu solicitud de ${que} de "${solicitud.cliente?.nombre ?? "el cliente"}" fue aceptada por ${session.user.name}.`
            : `Tu solicitud de ${que} de "${solicitud.cliente?.nombre ?? "el cliente"}" fue rechazada por ${session.user.name}.`,
      },
    });
  });

  revalidatePath("/solicitudes");
  if (solicitud.idCliente) revalidatePath(`/clientes/${solicitud.idCliente}`);
}

export async function resolverSolicitudServicio(
  idSolicitud: number,
  decision: Decision,
) {
  return conResultado("resolverSolicitudServicio", () =>
    resolverServicioInterno(idSolicitud, decision),
  );
}

// ===========================================================
// CLIENTES — resolver CREACION / EDICION / ELIMINACION
// ===========================================================
async function resolverClienteInterno(idSolicitud: number, decision: Decision) {
  const session = await verificarResolutor();

  const solicitud = await prisma.solicitud.findUnique({
    where: { idSolicitud },
    include: { cliente: true, solicitante: { select: { rol: true } } },
  });
  if (!solicitud) throw new Error("La solicitud no existe");
  if (solicitud.estado !== "PENDIENTE")
    throw new Error("Esta solicitud ya fue resuelta");
  if (
    solicitud.tipo !== "CREACION_CLIENTE" &&
    solicitud.tipo !== "EDICION_CLIENTE" &&
    solicitud.tipo !== "ELIMINACION_CLIENTE"
  ) {
    throw new Error("El tipo de solicitud no corresponde");
  }
  await verificarAlcanceResolutor(
    session,
    solicitud.idSolicitante,
    solicitud.solicitante.rol,
  );

  await prisma.$transaction(async (tx) => {
    const r = await tx.solicitud.updateMany({
      where: { idSolicitud, estado: "PENDIENTE" },
      data: {
        estado: decision,
        idResolutor: session.user.idUsuario,
        fechaResolucion: new Date(),
      },
    });
    if (r.count === 0)
      throw new Error("Esta solicitud ya fue resuelta por otro usuario");

    const cliente = solicitud.cliente;
    if (cliente) {
      if (solicitud.tipo === "CREACION_CLIENTE") {
        await tx.cliente.update({
          where: { idCliente: cliente.idCliente },
          data: {
            estadoAprobacion:
              decision === "ACEPTADA" ? "ACEPTADO" : "RECHAZADO",
          },
        });

        // Al aceptar: recibos iniciales de cada plan del cliente
        if (decision === "ACEPTADA") {
          const servicios = await tx.servicio.findMany({
            where: solicitud.idServicio
              ? { idServicio: solicitud.idServicio }
              : { idCliente: cliente.idCliente },
          });
          for (const s of servicios) await generarRecibosIniciales(tx, s);
        }
      } else if (
        solicitud.tipo === "EDICION_CLIENTE" &&
        decision === "ACEPTADA"
      ) {
        const cambios = (solicitud.datosPropuestos ?? {}) as Record<
          string,
          string
        >;
        await tx.cliente.update({
          where: { idCliente: cliente.idCliente },
          data: cambios as never,
        });
      } else if (
        solicitud.tipo === "ELIMINACION_CLIENTE" &&
        decision === "ACEPTADA"
      ) {
        await tx.cliente.delete({ where: { idCliente: cliente.idCliente } });
      }
    }

    await tx.notificacion.create({
      data: {
        idUsuarioDestino: solicitud.idSolicitante,
        mensaje:
          decision === "ACEPTADA"
            ? `Tu solicitud sobre "${solicitud.cliente?.nombre ?? "el cliente"}" fue aceptada por ${session.user.name}.`
            : `Tu solicitud sobre "${solicitud.cliente?.nombre ?? "el cliente"}" fue rechazada por ${session.user.name}.`,
      },
    });
  });

  revalidatePath("/solicitudes");
  revalidatePath("/trabajador");
  revalidatePath("/administrador");
}

export async function resolverSolicitudCliente(
  idSolicitud: number,
  decision: Decision,
) {
  return conResultado("resolverSolicitudCliente", () =>
    resolverClienteInterno(idSolicitud, decision),
  );
}

// ===========================================================
// CLIENTES — transferir uno o varios clientes a otro trabajador (ADMINISTRADOR)
// ===========================================================
export async function crearSolicitudTransferencia(
  idTrabajadorOrigen: number,
  idTrabajadorDestino: number,
  idsClientes: number[],
  comentario?: string,
) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") {
    throw new Error("Solo un administrador puede solicitar transferencias");
  }
  const idSolicitante = session.user.idUsuario;

  if (idTrabajadorOrigen === idTrabajadorDestino) {
    throw new Error("El trabajador de origen y destino no pueden ser el mismo");
  }
  if (!idsClientes || idsClientes.length === 0) {
    throw new Error("Selecciona al menos un cliente para transferir");
  }

  const [trabajadorOrigen, trabajadorDestino] = await Promise.all([
    prisma.usuario.findUnique({ where: { idUsuario: idTrabajadorOrigen } }),
    prisma.usuario.findUnique({ where: { idUsuario: idTrabajadorDestino } }),
  ]);
  if (!trabajadorOrigen) throw new Error("El trabajador de origen no existe");
  if (!trabajadorDestino) throw new Error("El trabajador de destino no existe");
  if (trabajadorOrigen.rol !== "TRABAJADOR")
    throw new Error("El usuario de origen no es un trabajador");
  if (trabajadorDestino.rol !== "TRABAJADOR")
    throw new Error("El usuario de destino no es un trabajador");
  if (trabajadorOrigen.idSupervisor !== idSolicitante) {
    throw new Error(
      "No puedes solicitar la transferencia de un trabajador que no está bajo tu supervisión",
    );
  }

  const clientesValidos = await prisma.cliente.findMany({
    where: { idCliente: { in: idsClientes }, idAsignadoA: idTrabajadorOrigen },
  });
  if (clientesValidos.length !== idsClientes.length) {
    throw new Error(
      "Alguno de los clientes seleccionados no pertenece a ese trabajador",
    );
  }

  const solicitud = await prisma.solicitud.create({
    data: {
      tipo: "TRANSFERENCIA_CLIENTES",
      idSolicitante,
      idTrabajadorOrigen,
      idTrabajadorDestino,
      idsClientesTransferir: idsClientes,
      comentario: comentario?.trim() || null,
    },
  });

  const jefes = await prisma.usuario.findMany({
    where: { rol: "JEFE", activo: true },
  });
  const mensaje =
    `El administrador ${session.user.name} solicitó transferir ${idsClientes.length} cliente(s) ` +
    `de ${trabajadorOrigen.nombre} hacia ${trabajadorDestino.nombre}.` +
    (comentario?.trim() ? ` Motivo: ${comentario.trim()}` : "");
  if (jefes.length > 0) {
    await prisma.notificacion.createMany({
      data: jefes.map((j) => ({ idUsuarioDestino: j.idUsuario, mensaje })),
    });
  }

  revalidatePath("/solicitudes");
  revalidatePath("/administrador");
  return { success: true, idSolicitud: solicitud.idSolicitud };
}

async function resolverTransferenciaInterno(
  idSolicitud: number,
  decision: Decision,
) {
  const session = await verificarResolutor();
  if (session.user.rol !== "JEFE")
    throw new Error("Solo un jefe puede resolver transferencias");

  const solicitud = await prisma.solicitud.findUnique({
    where: { idSolicitud },
  });
  if (!solicitud) throw new Error("La solicitud no existe");
  if (solicitud.estado !== "PENDIENTE")
    throw new Error("Esta solicitud ya fue resuelta");
  if (solicitud.tipo !== "TRANSFERENCIA_CLIENTES")
    throw new Error("Esta solicitud no es una transferencia");
  if (!solicitud.idTrabajadorDestino)
    throw new Error("La solicitud no tiene trabajador destino");

  await prisma.$transaction(async (tx) => {
    const r = await tx.solicitud.updateMany({
      where: { idSolicitud, estado: "PENDIENTE" },
      data: {
        estado: decision,
        idResolutor: session.user.idUsuario,
        fechaResolucion: new Date(),
      },
    });
    if (r.count === 0)
      throw new Error("Esta solicitud ya fue resuelta por otro usuario");

    if (decision === "ACEPTADA") {
      await tx.cliente.updateMany({
        where: { idCliente: { in: solicitud.idsClientesTransferir } },
        data: { idAsignadoA: solicitud.idTrabajadorDestino },
      });
    }
    await tx.notificacion.create({
      data: {
        idUsuarioDestino: solicitud.idSolicitante,
        mensaje:
          decision === "ACEPTADA"
            ? `La transferencia de ${solicitud.idsClientesTransferir.length} cliente(s) fue aceptada por ${session.user.name}.`
            : `La transferencia de clientes fue rechazada por ${session.user.name}.`,
      },
    });
  });

  revalidatePath("/solicitudes");
  revalidatePath("/administrador");
  revalidatePath("/trabajador");
}

export async function resolverSolicitudTransferencia(
  idSolicitud: number,
  decision: Decision,
) {
  return conResultado("resolverSolicitudTransferencia", () =>
    resolverTransferenciaInterno(idSolicitud, decision),
  );
}

// ===========================================================
// TRABAJADORES — solicitar creación (ADMINISTRADOR), con más datos
// ===========================================================
export async function crearSolicitudTrabajador(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") {
    throw new Error("Solo un administrador puede solicitar trabajadores");
  }
  const idSolicitante = session.user.idUsuario;

  const nombre = (formData.get("nombre") as string)?.trim();
  const correo = (formData.get("correo") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const tipoDocumento = formData.get("tipoDocumento") as string;
  const numeroDocumento = (formData.get("numeroDocumento") as string)?.trim();
  const telefono = (formData.get("telefono") as string)?.trim();

  if (!nombre) throw new Error("El nombre es obligatorio");
  if (!correo) throw new Error("El correo es obligatorio");
  if (!password || password.length < 6)
    throw new Error("La contraseña debe tener al menos 6 caracteres");
  if (!tipoDocumento) throw new Error("Selecciona el tipo de identificación");
  if (!numeroDocumento)
    throw new Error("El número de identificación es obligatorio");
  const longitudEsperada = LONGITUD_DOCUMENTO[tipoDocumento];
  if (longitudEsperada && numeroDocumento.length !== longitudEsperada) {
    throw new Error(
      `El número de ${tipoDocumento} debe tener exactamente ${longitudEsperada} caracteres`,
    );
  }
  if (!telefono) throw new Error("El número de celular es obligatorio");

  const [correoExistente, documentoExistente, telefonoExistente] =
    await Promise.all([
      prisma.usuario.findUnique({ where: { correo } }),
      prisma.usuario.findUnique({ where: { numeroDocumento } }),
      prisma.usuario.findUnique({ where: { telefono } }),
    ]);
  if (correoExistente)
    throw new Error("Ya existe un usuario registrado con ese correo");
  if (documentoExistente)
    throw new Error(
      "Ya existe un usuario registrado con ese número de identificación",
    );
  if (telefonoExistente)
    throw new Error(
      "Ya existe un usuario registrado con ese número de celular",
    );

  const solicitudesPendientes = await prisma.solicitud.findMany({
    where: { tipo: "CREACION_TRABAJADOR", estado: "PENDIENTE" },
  });
  const duplicada = solicitudesPendientes.find((s) => {
    const datos = s.datosPropuestos as { correo?: string } | null;
    return datos?.correo?.toLowerCase() === correo;
  });
  if (duplicada)
    throw new Error("Ya existe una solicitud pendiente para este correo");

  const solicitud = await prisma.solicitud.create({
    data: {
      tipo: "CREACION_TRABAJADOR",
      idSolicitante,
      datosPropuestos: {
        nombre,
        correo,
        password,
        tipoDocumento,
        numeroDocumento,
        telefono,
      },
    },
  });

  const jefes = await prisma.usuario.findMany({
    where: { rol: "JEFE", activo: true },
  });
  const mensaje = `El administrador ${session.user.name} solicitó crear un nuevo trabajador: ${nombre} (${correo}).`;
  if (jefes.length > 0) {
    await prisma.notificacion.createMany({
      data: jefes.map((j) => ({ idUsuarioDestino: j.idUsuario, mensaje })),
    });
  }

  revalidatePath("/solicitudes");
  revalidatePath("/administrador");
  return { success: true, idSolicitud: solicitud.idSolicitud };
}

async function resolverTrabajadorInterno(
  idSolicitud: number,
  decision: Decision,
) {
  const session = await verificarResolutor();
  if (session.user.rol !== "JEFE")
    throw new Error("Solo un jefe puede resolver solicitudes de trabajadores");

  const solicitud = await prisma.solicitud.findUnique({
    where: { idSolicitud },
  });
  if (!solicitud) throw new Error("La solicitud no existe");
  if (solicitud.estado !== "PENDIENTE")
    throw new Error("Esta solicitud ya fue resuelta");
  if (solicitud.tipo !== "CREACION_TRABAJADOR")
    throw new Error("Esta solicitud no es de creación de trabajador");

  const datos = solicitud.datosPropuestos as {
    nombre?: string;
    correo?: string;
    password?: string;
    tipoDocumento?: string;
    numeroDocumento?: string;
    telefono?: string;
  } | null;
  if (!datos?.nombre || !datos?.correo || !datos?.password) {
    throw new Error("Los datos del trabajador están incompletos");
  }

  const nombreTrabajador = datos.nombre;
  const correoTrabajador = datos.correo;
  const passwordTrabajador = datos.password;
  const tipoDocTrabajador = datos.tipoDocumento;
  const numeroDocTrabajador = datos.numeroDocumento;
  const telefonoTrabajador = datos.telefono;

  await prisma.$transaction(async (tx) => {
    const r = await tx.solicitud.updateMany({
      where: { idSolicitud, estado: "PENDIENTE" },
      data: {
        estado: decision,
        idResolutor: session.user.idUsuario,
        fechaResolucion: new Date(),
      },
    });
    if (r.count === 0)
      throw new Error("Esta solicitud ya fue resuelta por otro usuario");

    if (decision === "ACEPTADA") {
      const usuarioExistente = await tx.usuario.findUnique({
        where: { correo: correoTrabajador },
      });
      if (usuarioExistente)
        throw new Error("El correo ya pertenece a otro usuario");

      const passwordHash = await bcrypt.hash(passwordTrabajador, 10);
      await tx.usuario.create({
        data: {
          nombre: nombreTrabajador,
          correo: correoTrabajador,
          passwordHash,
          rol: "TRABAJADOR",
          idSupervisor: solicitud.idSolicitante,
          tipoDocumento: tipoDocTrabajador as never,
          numeroDocumento: numeroDocTrabajador,
          telefono: telefonoTrabajador,
        },
      });
    }

    await tx.notificacion.create({
      data: {
        idUsuarioDestino: solicitud.idSolicitante,
        mensaje:
          decision === "ACEPTADA"
            ? `La solicitud de creación del trabajador ${nombreTrabajador} fue aceptada por ${session.user.name}.`
            : `La solicitud de creación del trabajador ${nombreTrabajador} fue rechazada por ${session.user.name}.`,
      },
    });
  });

  revalidatePath("/solicitudes");
  revalidatePath("/administrador");
}

export async function resolverSolicitudTrabajador(
  idSolicitud: number,
  decision: Decision,
) {
  return conResultado("resolverSolicitudTrabajador", () =>
    resolverTrabajadorInterno(idSolicitud, decision),
  );
}

// ===========================================================
// TRABAJADORES — solicitar edición COMPLETA (ADMINISTRADOR, sobre su propio trabajador)
// nombre, correo, tipo y número de documento, celular
// ===========================================================
export async function crearSolicitudEditarTrabajador(
  idTrabajador: number,
  formData: FormData,
) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") {
    throw new Error(
      "Solo un administrador puede solicitar editar un trabajador",
    );
  }

  const trabajador = await prisma.usuario.findUnique({
    where: { idUsuario: idTrabajador },
  });
  if (!trabajador) throw new Error("Trabajador no encontrado");
  if (trabajador.idSupervisor !== session.user.idUsuario) {
    throw new Error(
      "Solo puedes editar trabajadores que están bajo tu supervisión",
    );
  }

  const cambios: Record<string, string> = {};
  const nombre = (formData.get("nombre") as string)?.trim();
  const correo = (formData.get("correo") as string)?.trim().toLowerCase();
  const tipoDocumento = (formData.get("tipoDocumento") as string)?.trim();
  const numeroDocumento = (formData.get("numeroDocumento") as string)?.trim();
  const telefono = (formData.get("telefono") as string)?.trim();

  if (nombre && nombre !== trabajador.nombre) cambios.nombre = nombre;
  if (correo && correo !== trabajador.correo) cambios.correo = correo;
  if (tipoDocumento && tipoDocumento !== trabajador.tipoDocumento)
    cambios.tipoDocumento = tipoDocumento;
  if (numeroDocumento && numeroDocumento !== trabajador.numeroDocumento)
    cambios.numeroDocumento = numeroDocumento;
  if (telefono && telefono !== trabajador.telefono) cambios.telefono = telefono;

  if (Object.keys(cambios).length === 0) {
    throw new Error("No hiciste ningún cambio respecto a los datos actuales");
  }

  const tipoFinal = cambios.tipoDocumento ?? trabajador.tipoDocumento;
  const numeroFinal = cambios.numeroDocumento ?? trabajador.numeroDocumento;
  const longitudEsperada = tipoFinal
    ? LONGITUD_DOCUMENTO[tipoFinal]
    : undefined;
  if (
    longitudEsperada &&
    numeroFinal &&
    numeroFinal.length !== longitudEsperada
  ) {
    throw new Error(
      `El número de ${tipoFinal} debe tener exactamente ${longitudEsperada} caracteres`,
    );
  }

  if (cambios.correo) {
    const existe = await prisma.usuario.findUnique({
      where: { correo: cambios.correo },
    });
    if (existe && existe.idUsuario !== idTrabajador)
      throw new Error("Ese correo ya pertenece a otro usuario");
  }
  if (cambios.numeroDocumento) {
    const existe = await prisma.usuario.findUnique({
      where: { numeroDocumento: cambios.numeroDocumento },
    });
    if (existe && existe.idUsuario !== idTrabajador)
      throw new Error("Ese número de documento ya pertenece a otro usuario");
  }
  if (cambios.telefono) {
    const existe = await prisma.usuario.findUnique({
      where: { telefono: cambios.telefono },
    });
    if (existe && existe.idUsuario !== idTrabajador)
      throw new Error("Ese número de celular ya pertenece a otro usuario");
  }

  await prisma.solicitud.create({
    data: {
      tipo: "EDICION_TRABAJADOR",
      idSolicitante: session.user.idUsuario,
      idTrabajadorOrigen: idTrabajador,
      datosPropuestos: cambios,
    },
  });

  const jefes = await prisma.usuario.findMany({
    where: { rol: "JEFE", activo: true },
  });
  const mensaje = `El administrador ${session.user.name} solicitó editar los datos del trabajador ${trabajador.nombre}.`;
  await prisma.notificacion.createMany({
    data: jefes.map((j) => ({ idUsuarioDestino: j.idUsuario, mensaje })),
  });

  revalidatePath("/solicitudes");
  revalidatePath("/administrador");
}

// ===========================================================
// TRABAJADORES — solicitar eliminación (ADMINISTRADOR)
// ===========================================================
export async function crearSolicitudEliminarTrabajador(
  idTrabajador: number,
  comentario?: string,
) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") {
    throw new Error(
      "Solo un administrador puede solicitar eliminar un trabajador",
    );
  }

  const trabajador = await prisma.usuario.findUnique({
    where: { idUsuario: idTrabajador },
  });
  if (!trabajador) throw new Error("Trabajador no encontrado");
  if (trabajador.idSupervisor !== session.user.idUsuario) {
    throw new Error(
      "Solo puedes eliminar trabajadores que están bajo tu supervisión",
    );
  }

  await prisma.solicitud.create({
    data: {
      tipo: "ELIMINACION_TRABAJADOR",
      idSolicitante: session.user.idUsuario,
      idTrabajadorOrigen: idTrabajador,
      comentario: comentario?.trim() || null,
    },
  });

  const jefes = await prisma.usuario.findMany({
    where: { rol: "JEFE", activo: true },
  });
  const mensaje = `El administrador ${session.user.name} solicitó ELIMINAR al trabajador ${trabajador.nombre}.`;
  await prisma.notificacion.createMany({
    data: jefes.map((j) => ({ idUsuarioDestino: j.idUsuario, mensaje })),
  });

  revalidatePath("/solicitudes");
  revalidatePath("/administrador");
}

// ===========================================================
// TRABAJADORES — solicitar cambio de supervisor / administrador (ADMINISTRADOR)
// ===========================================================
export async function crearSolicitudCambiarSupervisor(
  idTrabajador: number,
  idNuevoAdministrador: number,
  comentario?: string,
) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") {
    throw new Error("Solo un administrador puede solicitar este cambio");
  }

  const trabajador = await prisma.usuario.findUnique({
    where: { idUsuario: idTrabajador },
  });
  if (!trabajador) throw new Error("Trabajador no encontrado");
  if (trabajador.idSupervisor !== session.user.idUsuario) {
    throw new Error(
      "Solo puedes transferir trabajadores que están bajo tu supervisión",
    );
  }

  const nuevoAdministrador = await prisma.usuario.findUnique({
    where: { idUsuario: idNuevoAdministrador },
  });
  if (!nuevoAdministrador || nuevoAdministrador.rol !== "ADMINISTRADOR") {
    throw new Error("El nuevo administrador no es válido");
  }

  await prisma.solicitud.create({
    data: {
      tipo: "CAMBIO_SUPERVISOR_TRABAJADOR",
      idSolicitante: session.user.idUsuario,
      idTrabajadorOrigen: idTrabajador,
      idNuevoSupervisor: idNuevoAdministrador,
      comentario: comentario?.trim() || null,
    },
  });

  const jefes = await prisma.usuario.findMany({
    where: { rol: "JEFE", activo: true },
  });
  const mensaje =
    `El administrador ${session.user.name} solicitó pasar al trabajador ${trabajador.nombre} ` +
    `hacia el administrador ${nuevoAdministrador.nombre}.`;
  await prisma.notificacion.createMany({
    data: jefes.map((j) => ({ idUsuarioDestino: j.idUsuario, mensaje })),
  });

  revalidatePath("/solicitudes");
  revalidatePath("/administrador");
}

// ===========================================================
// TRABAJADORES — resolver EDICION / ELIMINACION / CAMBIO_SUPERVISOR (siempre JEFE)
// ===========================================================
async function resolverTrabajadorGestionInterno(
  idSolicitud: number,
  decision: Decision,
) {
  const session = await verificarResolutor();
  if (session.user.rol !== "JEFE")
    throw new Error("Solo un jefe puede resolver este tipo de solicitud");

  const solicitud = await prisma.solicitud.findUnique({
    where: { idSolicitud },
  });
  if (!solicitud) throw new Error("La solicitud no existe");
  if (solicitud.estado !== "PENDIENTE")
    throw new Error("Esta solicitud ya fue resuelta");
  if (
    solicitud.tipo !== "EDICION_TRABAJADOR" &&
    solicitud.tipo !== "ELIMINACION_TRABAJADOR" &&
    solicitud.tipo !== "CAMBIO_SUPERVISOR_TRABAJADOR"
  ) {
    throw new Error("El tipo de solicitud no corresponde");
  }
  if (!solicitud.idTrabajadorOrigen)
    throw new Error("La solicitud no tiene trabajador asociado");
  const idTrabajador = solicitud.idTrabajadorOrigen;

  await prisma.$transaction(async (tx) => {
    const r = await tx.solicitud.updateMany({
      where: { idSolicitud, estado: "PENDIENTE" },
      data: {
        estado: decision,
        idResolutor: session.user.idUsuario,
        fechaResolucion: new Date(),
      },
    });
    if (r.count === 0)
      throw new Error("Esta solicitud ya fue resuelta por otro usuario");

    if (decision === "ACEPTADA") {
      if (solicitud.tipo === "EDICION_TRABAJADOR") {
        const cambios = (solicitud.datosPropuestos ?? {}) as Record<
          string,
          string
        >;
        await tx.usuario.update({
          where: { idUsuario: idTrabajador },
          data: cambios as never,
        });
      } else if (solicitud.tipo === "ELIMINACION_TRABAJADOR") {
        // Baja lógica: se desactiva en vez de borrar (conserva el historial de clientes y solicitudes)
        await tx.usuario.update({
          where: { idUsuario: idTrabajador },
          data: { activo: false },
        });
      } else if (solicitud.tipo === "CAMBIO_SUPERVISOR_TRABAJADOR") {
        if (!solicitud.idNuevoSupervisor)
          throw new Error("Falta el nuevo supervisor");
        await tx.usuario.update({
          where: { idUsuario: idTrabajador },
          data: { idSupervisor: solicitud.idNuevoSupervisor },
        });
      }
    }

    const etiqueta =
      solicitud.tipo === "EDICION_TRABAJADOR"
        ? "editar"
        : solicitud.tipo === "ELIMINACION_TRABAJADOR"
          ? "eliminar"
          : "cambiar de administrador a";

    await tx.notificacion.create({
      data: {
        idUsuarioDestino: solicitud.idSolicitante,
        mensaje:
          decision === "ACEPTADA"
            ? `Tu solicitud para ${etiqueta} al trabajador fue aceptada por ${session.user.name}.`
            : `Tu solicitud para ${etiqueta} al trabajador fue rechazada por ${session.user.name}.`,
      },
    });
  });

  revalidatePath("/solicitudes");
  revalidatePath("/administrador");
  revalidatePath("/jefe");
}

export async function resolverSolicitudTrabajadorGestion(
  idSolicitud: number,
  decision: Decision,
) {
  return conResultado("resolverSolicitudTrabajadorGestion", () =>
    resolverTrabajadorGestionInterno(idSolicitud, decision),
  );
}
