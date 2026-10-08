"use server";

import { prisma } from "@/app/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { PLAN_PRECIOS, LONGITUD_DOCUMENTO } from "@/app/lib/constantes";
import { calcularFacturacionInicial } from "@/app/lib/facturacion";

// ===========================================================
// UTILIDAD INTERNA
// ===========================================================
async function verificarResolutor() {
  const session = await auth();
  if (!session) throw new Error("No tienes una sesión activa");
  if (session.user.rol !== "JEFE" && session.user.rol !== "ADMINISTRADOR") {
    throw new Error("No tienes permisos para resolver solicitudes");
  }
  return session;
}

// Verifica que quien va a editar/eliminar un cliente tenga permiso:
// - TRABAJADOR: solo sobre sus propios clientes
// - ADMINISTRADOR: solo sobre clientes de trabajadores que supervisa
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

// ===========================================================
// CLIENTES — creación (TRABAJADOR)
// ===========================================================
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

  const fechaTexto = formData.get("fechaInstalacion") as string;
  const horaTexto = formData.get("horaInstalacion") as string;
  const minutoTexto = formData.get("minutoInstalacion") as string;
  const periodo = formData.get("periodoInstalacion") as string;

  if (!fechaTexto || !horaTexto || !minutoTexto || !periodo) {
    throw new Error("Completa la fecha y hora de instalación");
  }

  const hora12 = Number(horaTexto);
  if (Number.isNaN(hora12) || hora12 < 1 || hora12 > 12) {
    throw new Error("Hora de instalación inválida");
  }
  let hora24: number;
  if (periodo === "AM") {
    hora24 = hora12 === 12 ? 0 : hora12;
  } else {
    hora24 = hora12 === 12 ? 12 : hora12 + 12;
  }

  const fechaHoraInstalacion = new Date(
    `${fechaTexto}T${String(hora24).padStart(2, "0")}:${minutoTexto}:00`,
  );
  if (Number.isNaN(fechaHoraInstalacion.getTime())) {
    throw new Error("La fecha y hora de instalación no es válida");
  }

  const tipoAccion = formData.get("tipoAccion") as string;
  const tipoInstalacion = formData.get("tipoInstalacion") as string;

  const tieneCostoInstalacion = formData.get("tieneCostoInstalacion") === "si";
  let derechoInstalacion: number | null = null;
  if (tieneCostoInstalacion) {
    derechoInstalacion = Number(formData.get("derechoInstalacion"));
    if (Number.isNaN(derechoInstalacion) || derechoInstalacion < 0) {
      throw new Error("Ingresa un monto válido para el derecho de instalación");
    }
  }

  const latitud = Number(formData.get("latitud"));
  const longitud = Number(formData.get("longitud"));
  if (Number.isNaN(latitud) || Number.isNaN(longitud)) {
    throw new Error("Marca la ubicación exacta del cliente en el mapa");
  }

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
        fechaHoraInstalacion,
        tipoAccion: tipoAccion as never,
        tipoInstalacion: tipoInstalacion as never,
        planTarifario: planTarifario as never,
        pagoMensual,
        tieneCostoInstalacion,
        derechoInstalacion,
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

    const mensaje =
      `Cliente "${cliente.nombre} ${cliente.apellido}" generado por ${session.user.name}. ` +
      `Instalación programada: ${fechaHoraInstalacion.toLocaleString("es-PE")}. ` +
      (tieneCostoInstalacion
        ? `Derecho de instalación: S/ ${derechoInstalacion?.toFixed(2)}.`
        : "Sin cobro de derecho de instalación.");

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

  // Si lo pide un trabajador -> va a administrador/jefe. Si lo pide un administrador -> solo al jefe (no se auto-aprueba).
  const destinatarios = await prisma.usuario.findMany({
    where: {
      rol:
        session.user.rol === "ADMINISTRADOR"
          ? "JEFE"
          : { in: ["JEFE", "ADMINISTRADOR"] },
    },
  });
  const mensaje = `${session.user.name} (${session.user.rol}) solicitó editar al cliente "${cliente.nombre} ${cliente.apellido}".`;
  await prisma.notificacion.createMany({
    data: destinatarios.map((d) => ({
      idUsuarioDestino: d.idUsuario,
      mensaje,
    })),
  });

  revalidatePath("/solicitudes");
  revalidatePath("/trabajador");
  revalidatePath("/administrador");
}

// ===========================================================
// CLIENTES — solicitar eliminación (TRABAJADOR o ADMINISTRADOR, con el mismo alcance que arriba)
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

  const destinatarios = await prisma.usuario.findMany({
    where: {
      rol:
        session.user.rol === "ADMINISTRADOR"
          ? "JEFE"
          : { in: ["JEFE", "ADMINISTRADOR"] },
    },
  });
  const mensaje = `${session.user.name} (${session.user.rol}) solicitó ELIMINAR al cliente "${cliente.nombre} ${cliente.apellido}".`;
  await prisma.notificacion.createMany({
    data: destinatarios.map((d) => ({
      idUsuarioDestino: d.idUsuario,
      mensaje,
    })),
  });

  revalidatePath("/solicitudes");
  revalidatePath("/trabajador");
  revalidatePath("/administrador");
}

// ===========================================================
// CLIENTES — resolver CREACION / EDICION / ELIMINACION
// Regla: nadie aprueba su propia solicitud ni la de su mismo nivel.
// - Si lo pidió un TRABAJADOR -> puede resolver ADMINISTRADOR o JEFE
// - Si lo pidió un ADMINISTRADOR -> solo puede resolver JEFE
// ===========================================================
export async function resolverSolicitudCliente(
  idSolicitud: number,
  decision: "ACEPTADA" | "RECHAZADA",
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
    solicitud.tipo !== "CREACION_CLIENTE" &&
    solicitud.tipo !== "EDICION_CLIENTE" &&
    solicitud.tipo !== "ELIMINACION_CLIENTE"
  ) {
    throw new Error("El tipo de solicitud no corresponde");
  }
  if (
    solicitud.solicitante.rol === "ADMINISTRADOR" &&
    session.user.rol !== "JEFE"
  ) {
    throw new Error(
      "Una solicitud hecha por un administrador solo puede resolverla el jefe",
    );
  }

  const resultado = await prisma.solicitud.updateMany({
    where: { idSolicitud, estado: "PENDIENTE" },
    data: {
      estado: decision,
      idResolutor: session.user.idUsuario,
      fechaResolucion: new Date(),
    },
  });
  if (resultado.count === 0)
    throw new Error("Esta solicitud ya fue resuelta por otro usuario");

  if (solicitud.cliente) {
    if (solicitud.tipo === "CREACION_CLIENTE") {
      await prisma.cliente.update({
        where: { idCliente: solicitud.cliente.idCliente },
        data: {
          estadoAprobacion: decision === "ACEPTADA" ? "ACEPTADO" : "RECHAZADO",
        },
      });

      // Al aceptar, se generan los 2 primeros recibos: instalación + mes 1 (pagado),
      // y mes 2 con el descuento prorrateado por los días no usados del mes 1.
      if (
        decision === "ACEPTADA" &&
        solicitud.cliente.fechaHoraInstalacion &&
        solicitud.cliente.pagoMensual
      ) {
        const { recibo1, recibo2 } = calcularFacturacionInicial(
          solicitud.cliente.fechaHoraInstalacion,
          Number(solicitud.cliente.pagoMensual),
          solicitud.cliente.tieneCostoInstalacion &&
            solicitud.cliente.derechoInstalacion
            ? Number(solicitud.cliente.derechoInstalacion)
            : 0,
        );
        await prisma.pago.createMany({
          data: [
            { idCliente: solicitud.cliente.idCliente, ...recibo1 },
            { idCliente: solicitud.cliente.idCliente, ...recibo2 },
          ],
        });
      }
    } else if (
      solicitud.tipo === "EDICION_CLIENTE" &&
      decision === "ACEPTADA"
    ) {
      const cambios = (solicitud.datosPropuestos ?? {}) as Record<
        string,
        string
      >;
      await prisma.cliente.update({
        where: { idCliente: solicitud.cliente.idCliente },
        data: cambios,
      });
    } else if (
      solicitud.tipo === "ELIMINACION_CLIENTE" &&
      decision === "ACEPTADA"
    ) {
      await prisma.cliente.delete({
        where: { idCliente: solicitud.cliente.idCliente },
      });
    }
  }

  await prisma.notificacion.create({
    data: {
      idUsuarioDestino: solicitud.idSolicitante,
      mensaje:
        decision === "ACEPTADA"
          ? `Tu solicitud sobre "${solicitud.cliente?.nombre ?? "el cliente"}" fue aceptada por ${session.user.name}.`
          : `Tu solicitud sobre "${solicitud.cliente?.nombre ?? "el cliente"}" fue rechazada por ${session.user.name}.`,
    },
  });

  revalidatePath("/solicitudes");
  revalidatePath("/trabajador");
  revalidatePath("/administrador");

  return { success: true };
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
  if (!solicitud.idTrabajadorDestino)
    throw new Error("La solicitud no tiene trabajador destino");

  await prisma.$transaction(async (tx) => {
    if (decision === "ACEPTADA") {
      await tx.cliente.updateMany({
        where: { idCliente: { in: solicitud.idsClientesTransferir } },
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
            ? `La transferencia de ${solicitud.idsClientesTransferir.length} cliente(s) fue aceptada por ${session.user.name}.`
            : `La transferencia de clientes fue rechazada por ${session.user.name}.`,
      },
    });
  });

  revalidatePath("/solicitudes");
  revalidatePath("/administrador");
  revalidatePath("/trabajador");
  return { success: true };
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

export async function resolverSolicitudTrabajador(
  idSolicitud: number,
  decision: "ACEPTADA" | "RECHAZADA",
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

// ===========================================================
// TRABAJADORES — solicitar edición (ADMINISTRADOR, sobre su propio trabajador)
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
  const telefono = (formData.get("telefono") as string)?.trim();

  if (nombre && nombre !== trabajador.nombre) cambios.nombre = nombre;
  if (telefono && telefono !== trabajador.telefono) cambios.telefono = telefono;

  if (Object.keys(cambios).length === 0) {
    throw new Error("No hiciste ningún cambio respecto a los datos actuales");
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
export async function resolverSolicitudTrabajadorGestion(
  idSolicitud: number,
  decision: "ACEPTADA" | "RECHAZADA",
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

  await prisma.$transaction(async (tx) => {
    await tx.solicitud.update({
      where: { idSolicitud },
      data: {
        estado: decision,
        idResolutor: session.user.idUsuario,
        fechaResolucion: new Date(),
      },
    });

    if (decision === "ACEPTADA") {
      if (solicitud.tipo === "EDICION_TRABAJADOR") {
        const cambios = (solicitud.datosPropuestos ?? {}) as Record<
          string,
          string
        >;
        await tx.usuario.update({
          where: { idUsuario: solicitud.idTrabajadorOrigen! },
          data: cambios as never,
        });
      } else if (solicitud.tipo === "ELIMINACION_TRABAJADOR") {
        await tx.usuario.update({
          where: { idUsuario: solicitud.idTrabajadorOrigen! },
          data: { activo: false },
        });
      } else if (solicitud.tipo === "CAMBIO_SUPERVISOR_TRABAJADOR") {
        if (!solicitud.idNuevoSupervisor)
          throw new Error("Falta el nuevo supervisor");
        await tx.usuario.update({
          where: { idUsuario: solicitud.idTrabajadorOrigen! },
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
  return { success: true };
}
