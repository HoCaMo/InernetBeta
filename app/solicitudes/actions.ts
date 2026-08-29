"use server";

import { prisma } from "@/app/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { PLAN_PRECIOS, LONGITUD_DOCUMENTO } from "@/app/lib/constantes";
import bcrypt from "bcryptjs";
export async function crearClienteConSolicitud(formData: FormData) {
  const session = await auth();
  if (!session || session.user.rol !== "TRABAJADOR") {
    throw new Error("Solo un trabajador puede generar clientes");
  }
  const idUsuario = session.user.idUsuario;

  // --- Validar documento: cantidad exacta de caracteres según el tipo ---
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

  // --- tipoCliente derivado automáticamente, ya no se pide en el formulario ---
  const tipoCliente: "NACIONAL" | "EXTRANJERO" | "EMPRESA" =
    tipoDocumento === "RUC"
      ? "EMPRESA"
      : nacionalidad === "EXTRANJERA"
        ? "EXTRANJERO"
        : "NACIONAL";

  const ahora = new Date();
  const fechaLimite = new Date(ahora);
  fechaLimite.setDate(fechaLimite.getDate() + 1);
  fechaLimite.setHours(17, 0, 0, 0); // mañana a las 5:00 p.m.

  // --- Reactivación / activación: Sí/No -> si es "sí", la fecha es HOY automáticamente ---
  const reactivacionSuspension =
    formData.get("reactivacionSuspension") === "si";
  const activacionSinDeuda = formData.get("activacionSinDeuda") === "si";

  const materialesTipo = formData.getAll("material") as string[];
  const materialesCantidad = formData.getAll("cantidad") as string[];

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
        where: {
          numero: telefono,
        },
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

    for (let i = 0; i < materialesTipo.length; i++) {
      const cantidad = Number(materialesCantidad[i] ?? 0);
      if (materialesTipo[i] && cantidad > 0) {
        await tx.materialInstalacion.create({
          data: {
            idCliente: cliente.idCliente,
            tipo: materialesTipo[i] as never,
            cantidad,
          },
        });
      }
    }

    await tx.solicitud.create({
      data: {
        tipo: "CREACION_CLIENTE",
        idSolicitante: idUsuario,
        idCliente: cliente.idCliente,
      },
    });

    // Mensaje base para jefe/administradores
    let mensaje = `Cliente "${cliente.nombre} ${cliente.apellido}" generado por ${session.user.name}. Datos completos ✓. Plazo de instalación: ${fechaLimite.toLocaleString("es-PE")}. Falta definir derecho de instalación y activación.`;

    if (reactivacionSuspension) {
      mensaje += ` ⚠ Requiere reactivación por suspensión de deuda (registrada hoy).`;
    }
    if (activacionSinDeuda) {
      mensaje += ` ⚠ Requiere activación/reinstalación sin deuda (registrada hoy).`;
    }

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
export async function crearSolicitudTransferencia(
  idTrabajadorOrigen: number,
  idTrabajadorDestino: number,
  comentario?: string,
) {
  const session = await auth();

  // Solo un administrador puede solicitar transferencias
  if (!session || session.user.rol !== "ADMINISTRADOR") {
    throw new Error("Solo un administrador puede solicitar transferencias");
  }

  const idSolicitante = session.user.idUsuario;

  // No permitir transferirse al mismo trabajador
  if (idTrabajadorOrigen === idTrabajadorDestino) {
    throw new Error("El trabajador de origen y destino no pueden ser el mismo");
  }

  // Verificar que ambos trabajadores existan
  const [trabajadorOrigen, trabajadorDestino] = await Promise.all([
    prisma.usuario.findUnique({
      where: {
        idUsuario: idTrabajadorOrigen,
      },
    }),

    prisma.usuario.findUnique({
      where: {
        idUsuario: idTrabajadorDestino,
      },
    }),
  ]);

  if (!trabajadorOrigen) {
    throw new Error("El trabajador de origen no existe");
  }

  if (!trabajadorDestino) {
    throw new Error("El trabajador de destino no existe");
  }

  // Ambos deben ser trabajadores
  if (trabajadorOrigen.rol !== "TRABAJADOR") {
    throw new Error("El usuario de origen no es un trabajador");
  }

  if (trabajadorDestino.rol !== "TRABAJADOR") {
    throw new Error("El usuario de destino no es un trabajador");
  }

  // El trabajador de origen debe pertenecer al administrador
  if (trabajadorOrigen.idSupervisor !== idSolicitante) {
    throw new Error(
      "No puedes solicitar la transferencia de un trabajador que no está bajo tu supervisión",
    );
  }

  // Crear solicitud
  const solicitud = await prisma.solicitud.create({
    data: {
      tipo: "TRANSFERENCIA_CLIENTES",
      idSolicitante,
      idTrabajadorOrigen,
      idTrabajadorDestino,
      comentario: comentario?.trim() || null,
    },
  });

  // Notificar a los jefes
  const jefes = await prisma.usuario.findMany({
    where: {
      rol: "JEFE",
      activo: true,
    },
  });

  const mensaje =
    `El administrador ${session.user.name} solicitó transferir ` +
    `los clientes de ${trabajadorOrigen.nombre} hacia ` +
    `${trabajadorDestino.nombre}.` +
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

  return {
    success: true,
    idSolicitud: solicitud.idSolicitud,
  };
}

export async function crearSolicitudTrabajador(formData: FormData) {
  const session = await auth();

  // Solo un administrador puede solicitar trabajadores
  if (!session || session.user.rol !== "ADMINISTRADOR") {
    throw new Error("Solo un administrador puede solicitar trabajadores");
  }

  const idSolicitante = session.user.idUsuario;

  const nombre = (formData.get("nombre") as string)?.trim();

  const correo = (formData.get("correo") as string)?.trim().toLowerCase();

  const password = formData.get("password") as string;

  // Validaciones
  if (!nombre) {
    throw new Error("El nombre es obligatorio");
  }

  if (!correo) {
    throw new Error("El correo es obligatorio");
  }

  if (!password) {
    throw new Error("La contraseña es obligatoria");
  }

  if (password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres");
  }

  // Verificar que el correo no esté siendo usado
  const usuarioExistente = await prisma.usuario.findUnique({
    where: {
      correo,
    },
  });

  if (usuarioExistente) {
    throw new Error("Ya existe un usuario registrado con ese correo");
  }

  // Verificar que no exista otra solicitud pendiente
  // para el mismo correo
  const solicitudesPendientes = await prisma.solicitud.findMany({
    where: {
      tipo: "CREACION_TRABAJADOR",
      estado: "PENDIENTE",
    },
  });

  const solicitudDuplicada = solicitudesPendientes.find((solicitud) => {
    const datos = solicitud.datosPropuestos as {
      correo?: string;
    } | null;

    return datos?.correo?.toLowerCase() === correo;
  });

  if (solicitudDuplicada) {
    throw new Error("Ya existe una solicitud pendiente para este correo");
  }

  // Crear solicitud
  const solicitud = await prisma.solicitud.create({
    data: {
      tipo: "CREACION_TRABAJADOR",
      idSolicitante,
      datosPropuestos: {
        nombre,
        correo,
        password,
      },
    },
  });

  // Buscar jefes activos
  const jefes = await prisma.usuario.findMany({
    where: {
      rol: "JEFE",
      activo: true,
    },
  });

  const mensaje =
    `El administrador ${session.user.name} ` +
    `solicitó crear un nuevo trabajador: ${nombre} ` +
    `(${correo}).`;

  // Notificar a los jefes
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

  return {
    success: true,
    idSolicitud: solicitud.idSolicitud,
  };
}
async function verificarResolutor() {
  const session = await auth();

  if (!session) {
    throw new Error("No tienes una sesión activa");
  }

  if (session.user.rol !== "JEFE" && session.user.rol !== "ADMINISTRADOR") {
    throw new Error("No tienes permisos para resolver solicitudes");
  }

  return session;
}
export async function resolverSolicitudCliente(
  idSolicitud: number,
  decision: "ACEPTADA" | "RECHAZADA",
  _datos?: unknown,
  _comentario?: string,
) {
  const session = await verificarResolutor();

  const solicitud = await prisma.solicitud.findUnique({
    where: {
      idSolicitud,
    },
    include: {
      cliente: true,
    },
  });

  if (!solicitud) {
    throw new Error("La solicitud no existe");
  }

  if (solicitud.estado !== "PENDIENTE") {
    throw new Error("Esta solicitud ya fue resuelta");
  }

  if (
    solicitud.tipo !== "CREACION_CLIENTE" &&
    solicitud.tipo !== "EDICION_CLIENTE"
  ) {
    throw new Error("El tipo de solicitud no corresponde");
  }

  await prisma.$transaction(async (tx) => {
    // Actualizar solicitud
    await tx.solicitud.update({
      where: {
        idSolicitud,
      },
      data: {
        estado: decision,
        idResolutor: session.user.idUsuario,
        fechaResolucion: new Date(),
      },
    });

    // Si se rechaza una creación de cliente,
    // el cliente puede quedar registrado pero rechazado.
    if (solicitud.tipo === "CREACION_CLIENTE" && solicitud.cliente) {
      await tx.cliente.update({
        where: {
          idCliente: solicitud.cliente.idCliente,
        },
        data: {
          estadoAprobacion: decision === "ACEPTADA" ? "ACEPTADO" : "RECHAZADO",
        },
      });
    }

    // Notificar al solicitante
    await tx.notificacion.create({
      data: {
        idUsuarioDestino: solicitud.idSolicitante,
        mensaje:
          decision === "ACEPTADA"
            ? `La solicitud de cliente #${idSolicitud} fue aceptada por ${session.user.name}.`
            : `La solicitud de cliente #${idSolicitud} fue rechazada por ${session.user.name}.`,
      },
    });
  });

  revalidatePath("/solicitudes");
  revalidatePath("/trabajador");
  revalidatePath("/administrador");

  return {
    success: true,
  };
}
export async function resolverSolicitudTransferencia(
  idSolicitud: number,
  decision: "ACEPTADA" | "RECHAZADA",
) {
  const session = await verificarResolutor();

  // Solo el JEFE puede resolver transferencias
  if (session.user.rol !== "JEFE") {
    throw new Error("Solo un jefe puede resolver transferencias");
  }

  const solicitud = await prisma.solicitud.findUnique({
    where: {
      idSolicitud,
    },
  });

  if (!solicitud) {
    throw new Error("La solicitud no existe");
  }

  if (solicitud.estado !== "PENDIENTE") {
    throw new Error("Esta solicitud ya fue resuelta");
  }

  if (solicitud.tipo !== "TRANSFERENCIA_CLIENTES") {
    throw new Error("Esta solicitud no es una transferencia");
  }

  if (!solicitud.idTrabajadorOrigen || !solicitud.idTrabajadorDestino) {
    throw new Error("La solicitud no tiene trabajadores definidos");
  }

  await prisma.$transaction(async (tx) => {
    if (decision === "ACEPTADA") {
      // Transferir todos los clientes
      // del trabajador origen al trabajador destino
      await tx.cliente.updateMany({
        where: {
          idAsignadoA: solicitud.idTrabajadorOrigen,
        },
        data: {
          idAsignadoA: solicitud.idTrabajadorDestino,
        },
      });
    }

    // Actualizar solicitud
    await tx.solicitud.update({
      where: {
        idSolicitud,
      },
      data: {
        estado: decision,
        idResolutor: session.user.idUsuario,
        fechaResolucion: new Date(),
      },
    });

    // Notificar al administrador que hizo la solicitud
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

  return {
    success: true,
  };
}
export async function resolverSolicitudTrabajador(
  idSolicitud: number,
  decision: "ACEPTADA" | "RECHAZADA",
) {
  const session = await verificarResolutor();

  // Solo el JEFE puede aprobar trabajadores
  if (session.user.rol !== "JEFE") {
    throw new Error("Solo un jefe puede resolver solicitudes de trabajadores");
  }

  const solicitud = await prisma.solicitud.findUnique({
    where: {
      idSolicitud,
    },
  });

  if (!solicitud) {
    throw new Error("La solicitud no existe");
  }

  if (solicitud.estado !== "PENDIENTE") {
    throw new Error("Esta solicitud ya fue resuelta");
  }

  if (solicitud.tipo !== "CREACION_TRABAJADOR") {
    throw new Error("Esta solicitud no es de creación de trabajador");
  }

  const datos = solicitud.datosPropuestos as {
    nombre?: string;
    correo?: string;
    password?: string;
  } | null;

  if (!datos?.nombre || !datos?.correo || !datos?.password) {
    throw new Error("Los datos del trabajador están incompletos");
  }

  // Se extraen a variables locales para que TypeScript no pierda
  // la validación de arriba dentro del closure de la transacción
  const nombreTrabajador = datos.nombre;
  const correoTrabajador = datos.correo;
  const passwordTrabajador = datos.password;

  await prisma.$transaction(async (tx) => {
    if (decision === "ACEPTADA") {
      // Verificar nuevamente que el correo no exista
      const usuarioExistente = await tx.usuario.findUnique({
        where: {
          correo: correoTrabajador,
        },
      });

      if (usuarioExistente) {
        throw new Error("El correo ya pertenece a otro usuario");
      }

      // Crear hash seguro
      const passwordHash = await bcrypt.hash(passwordTrabajador, 10);

      // Crear trabajador
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

    // Resolver solicitud
    await tx.solicitud.update({
      where: {
        idSolicitud,
      },
      data: {
        estado: decision,
        idResolutor: session.user.idUsuario,
        fechaResolucion: new Date(),
      },
    });

    // Notificar al administrador
    await tx.notificacion.create({
      data: {
        idUsuarioDestino: solicitud.idSolicitante,
        mensaje:
          decision === "ACEPTADA"
            ? `La solicitud de creación del trabajador ${datos.nombre} fue aceptada por ${session.user.name}.`
            : `La solicitud de creación del trabajador ${datos.nombre} fue rechazada por ${session.user.name}.`,
      },
    });
  });

  revalidatePath("/solicitudes");
  revalidatePath("/administrador");

  return {
    success: true,
  };
}
