"use server";

import { prisma } from "@/app/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { PLAN_PRECIOS, LONGITUD_DOCUMENTO } from "@/app/lib/constantes";

// ---------------------------------------------------------
// TRABAJADOR: genera un cliente + solicitud de aprobación
// ---------------------------------------------------------
export async function crearClienteConSolicitud(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "TRABAJADOR") {
    throw new Error("Solo un trabajador puede generar clientes");
  }
  const idUsuario = session.user.idUsuario;

  const tipoDocumento = formData.get("tipoDocumento") as string;
  const numeroDocumento = (formData.get("numeroDocumento") as string).trim();
  const longitudEsperada = LONGITUD_DOCUMENTO[tipoDocumento];
  if (!longitudEsperada) throw new Error("Tipo de documento inválido");
  if (numeroDocumento.length !== longitudEsperada) {
    throw new Error(
      `El número de ${tipoDocumento} debe tener exactamente ${longitudEsperada} caracteres (ingresaste ${numeroDocumento.length}).`,
    );
  }

  const planTarifario = formData.get("planTarifario") as string;
  const pagoMensual = PLAN_PRECIOS[planTarifario];
  if (!pagoMensual) throw new Error("Selecciona un plan tarifario válido");

  const departamento = formData.get("departamento") as string;
  const provincia = formData.get("provincia") as string;
  const distrito = formData.get("distrito") as string;
  const nacionalidad = formData.get("nacionalidad") as string;

  const tipoCliente: "NACIONAL" | "EXTRANJERO" | "EMPRESA" =
    tipoDocumento === "RUC"
      ? "EMPRESA"
      : nacionalidad === "EXTRANJERA"
        ? "EXTRANJERO"
        : "NACIONAL";

  const ahora = new Date();
  const fechaLimite = new Date(ahora);
  fechaLimite.setDate(fechaLimite.getDate() + 1);
  fechaLimite.setHours(17, 0, 0, 0);

  const reactivacionSuspension =
    formData.get("reactivacionSuspension") === "si";
  const activacionSinDeuda = formData.get("activacionSinDeuda") === "si";

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
        nacionalidad,
        representanteLegal:
          (formData.get("representanteLegal") as string) || null,
        usoServicio: formData.get("usoServicio") as never,
        condicionCliente: formData.get("condicionCliente") as never,
        fechaInicio: ahora,
        fechaLimiteInstalacion: fechaLimite,
        planTarifario: planTarifario as never,
        pagoMensual,
        trasladoInterior: formData.get("trasladoInterior") === "si",
        trasladoExterior: formData.get("trasladoExterior") === "si",
        fechaReactivacionSuspension: reactivacionSuspension ? ahora : null,
        fechaActivacionSinDeuda: activacionSinDeuda ? ahora : null,
        idCreadoPor: idUsuario,
        idAsignadoA: idUsuario,
        estadoAprobacion: "PENDIENTE",
        datosCompletos: true,
      },
    });

    await tx.documentoCliente.create({
      data: {
        idCliente: cliente.idCliente,
        tipoDocumento: tipoDocumento as never,
        numeroDocumento,
      },
    });

    const telefono = (formData.get("telefono") as string)?.trim();
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
      },
    });

    let mensaje = `Cliente "${cliente.nombre} ${cliente.apellido}" generado por ${session.user.name}. Plazo de instalación: ${fechaLimite.toLocaleString("es-PE")}. Falta definir el derecho de instalación al aceptar la solicitud.`;
    if (reactivacionSuspension)
      mensaje += ` ⚠ Requiere reactivación por suspensión de deuda (registrada hoy).`;
    if (activacionSinDeuda)
      mensaje += ` ⚠ Requiere activación/reinstalación sin deuda (registrada hoy).`;

    const supervisores = await tx.usuario.findMany({
      where: { rol: { in: ["JEFE", "ADMINISTRADOR"] } },
    });
    for (const s of supervisores) {
      await tx.notificacion.create({
        data: { idUsuarioDestino: s.idUsuario, mensaje },
      });
    }
  });

  revalidatePath("/solicitudes");
  revalidatePath("/trabajador");
}

// ---------------------------------------------------------
// ADMINISTRADOR: solicita transferir clientes de un trabajador a otro
// ---------------------------------------------------------
export async function crearSolicitudTransferencia(
  idTrabajadorOrigen: number,
  idTrabajadorDestino: number,
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

  const solicitud = await prisma.solicitud.create({
    data: {
      tipo: "TRANSFERENCIA_CLIENTES",
      idSolicitante,
      idTrabajadorOrigen,
      idTrabajadorDestino,
      comentario: comentario?.trim() || null,
    },
  });

  const jefes = await prisma.usuario.findMany({
    where: { rol: "JEFE", activo: true },
  });

  const mensaje =
    `El administrador ${session.user.name} solicitó transferir ` +
    `los clientes de ${trabajadorOrigen.nombre} hacia ${trabajadorDestino.nombre}.` +
    (comentario?.trim() ? ` Motivo: ${comentario.trim()}` : "");

  if (jefes.length > 0) {
    await prisma.notificacion.createMany({
      data: jefes.map((jefe) => ({
        idUsuarioDestino: jefe.idUsuario,
        mensaje,
      })),
    });
  }

  revalidatePath("/solicitudes");
  revalidatePath("/administrador");

  return { success: true, idSolicitud: solicitud.idSolicitud };
}

// ---------------------------------------------------------
// ADMINISTRADOR: solicita crear un trabajador nuevo
// ---------------------------------------------------------
export async function crearSolicitudTrabajador(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "ADMINISTRADOR") {
    throw new Error("Solo un administrador puede solicitar trabajadores");
  }

  const idSolicitante = session.user.idUsuario;
  const nombre = (formData.get("nombre") as string)?.trim();
  const correo = (formData.get("correo") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!nombre) throw new Error("El nombre es obligatorio");
  if (!correo) throw new Error("El correo es obligatorio");
  if (!password) throw new Error("La contraseña es obligatoria");
  if (password.length < 6)
    throw new Error("La contraseña debe tener al menos 6 caracteres");

  const usuarioExistente = await prisma.usuario.findUnique({
    where: { correo },
  });
  if (usuarioExistente)
    throw new Error("Ya existe un usuario registrado con ese correo");

  const solicitudesPendientes = await prisma.solicitud.findMany({
    where: { tipo: "CREACION_TRABAJADOR", estado: "PENDIENTE" },
  });
  const solicitudDuplicada = solicitudesPendientes.find((solicitud) => {
    const datos = solicitud.datosPropuestos as { correo?: string } | null;
    return datos?.correo?.toLowerCase() === correo;
  });
  if (solicitudDuplicada)
    throw new Error("Ya existe una solicitud pendiente para este correo");

  const solicitud = await prisma.solicitud.create({
    data: {
      tipo: "CREACION_TRABAJADOR",
      idSolicitante,
      datosPropuestos: { nombre, correo, password },
    },
  });

  const jefes = await prisma.usuario.findMany({
    where: { rol: "JEFE", activo: true },
  });
  const mensaje = `El administrador ${session.user.name} solicitó crear un nuevo trabajador: ${nombre} (${correo}).`;

  if (jefes.length > 0) {
    await prisma.notificacion.createMany({
      data: jefes.map((jefe) => ({
        idUsuarioDestino: jefe.idUsuario,
        mensaje,
      })),
    });
  }

  revalidatePath("/solicitudes");
  revalidatePath("/administrador");

  return { success: true, idSolicitud: solicitud.idSolicitud };
}

// ---------------------------------------------------------
// Utilidad interna: valida que quien resuelve sea Jefe o Administrador
// ---------------------------------------------------------
async function verificarResolutor() {
  const session = await auth();
  if (!session) throw new Error("No tienes una sesión activa");
  if (session.user.rol !== "JEFE" && session.user.rol !== "ADMINISTRADOR") {
    throw new Error("No tienes permisos para resolver solicitudes");
  }
  return session;
}

// ---------------------------------------------------------
// ADMINISTRADOR / JEFE: resolver solicitud de cliente
// Al ACEPTAR una CREACION_CLIENTE, es obligatorio indicar el
// derecho de instalación en ese mismo momento.
// ---------------------------------------------------------
export async function resolverSolicitudCliente(
  idSolicitud: number,
  decision: "ACEPTADA" | "RECHAZADA",
  derechoInstalacion?: number,
) {
  const session = await verificarResolutor();

  const solicitud = await prisma.solicitud.findUnique({
    where: { idSolicitud },
    include: { cliente: true },
  });

  if (!solicitud) throw new Error("La solicitud no existe");
  if (solicitud.estado !== "PENDIENTE")
    throw new Error("Esta solicitud ya fue resuelta");
  if (
    solicitud.tipo !== "CREACION_CLIENTE" &&
    solicitud.tipo !== "EDICION_CLIENTE"
  ) {
    throw new Error("El tipo de solicitud no corresponde");
  }

  if (decision === "ACEPTADA" && solicitud.tipo === "CREACION_CLIENTE") {
    if (
      derechoInstalacion === undefined ||
      Number.isNaN(derechoInstalacion) ||
      derechoInstalacion < 0
    ) {
      throw new Error(
        "Debes indicar un derecho de instalación válido para aceptar este cliente",
      );
    }
  }

  // Actualización atómica: solo gana quien llegue primero
  const resultado = await prisma.solicitud.updateMany({
    where: { idSolicitud, estado: "PENDIENTE" },
    data: {
      estado: decision,
      idResolutor: session.user.idUsuario,
      fechaResolucion: new Date(),
    },
  });

  if (resultado.count === 0) {
    throw new Error("Esta solicitud ya fue resuelta por otro usuario");
  }

  if (solicitud.tipo === "CREACION_CLIENTE" && solicitud.cliente) {
    await prisma.cliente.update({
      where: { idCliente: solicitud.cliente.idCliente },
      data:
        decision === "ACEPTADA"
          ? {
              estadoAprobacion: "ACEPTADO",
              derechoInstalacion,
              datosAdminCompletos: true,
            }
          : { estadoAprobacion: "RECHAZADO" },
    });
  }

  await prisma.notificacion.create({
    data: {
      idUsuarioDestino: solicitud.idSolicitante,
      mensaje:
        decision === "ACEPTADA"
          ? `Tu solicitud de cliente "${solicitud.cliente?.nombre ?? ""}" fue aceptada por ${session.user.name}. Derecho de instalación: S/ ${derechoInstalacion?.toFixed(2)}.`
          : `Tu solicitud de cliente "${solicitud.cliente?.nombre ?? ""}" fue rechazada por ${session.user.name}.`,
    },
  });

  revalidatePath("/solicitudes");
  revalidatePath("/trabajador");
  revalidatePath("/administrador");

  return { success: true };
}

// ---------------------------------------------------------
// JEFE: resolver transferencia de clientes
// ---------------------------------------------------------
export async function resolverSolicitudTransferencia(
  idSolicitud: number,
  decision: "ACEPTADA" | "RECHAZADA",
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
  if (!solicitud.idTrabajadorOrigen || !solicitud.idTrabajadorDestino) {
    throw new Error("La solicitud no tiene trabajadores definidos");
  }

  await prisma.$transaction(async (tx) => {
    if (decision === "ACEPTADA") {
      await tx.cliente.updateMany({
        where: { idAsignadoA: solicitud.idTrabajadorOrigen },
        data: { idAsignadoA: solicitud.idTrabajadorDestino },
      });
    }

    await tx.solicitud.update({
      where: { idSolicitud },
      data: {
        estado: decision,
        idResolutor: session.user.idUsuario,
        fechaResolucion: new Date(),
      },
    });

    await tx.notificacion.create({
      data: {
        idUsuarioDestino: solicitud.idSolicitante,
        mensaje:
          decision === "ACEPTADA"
            ? `La transferencia de clientes fue aceptada por ${session.user.name}.`
            : `La transferencia de clientes fue rechazada por ${session.user.name}.`,
      },
    });
  });

  revalidatePath("/solicitudes");
  revalidatePath("/administrador");
  revalidatePath("/trabajador");

  return { success: true };
}

// ---------------------------------------------------------
// JEFE: resolver la creación de un trabajador
// ---------------------------------------------------------
export async function resolverSolicitudTrabajador(
  idSolicitud: number,
  decision: "ACEPTADA" | "RECHAZADA",
) {
  const session = await verificarResolutor();
  if (session.user.rol !== "JEFE") {
    throw new Error("Solo un jefe puede resolver solicitudes de trabajadores");
  }

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
  } | null;

  if (!datos?.nombre || !datos?.correo || !datos?.password) {
    throw new Error("Los datos del trabajador están incompletos");
  }

  const nombreTrabajador = datos.nombre;
  const correoTrabajador = datos.correo;
  const passwordTrabajador = datos.password;

  await prisma.$transaction(async (tx) => {
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
        },
      });
    }

    await tx.solicitud.update({
      where: { idSolicitud },
      data: {
        estado: decision,
        idResolutor: session.user.idUsuario,
        fechaResolucion: new Date(),
      },
    });

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

  return { success: true };
}
