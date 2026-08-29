import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("cambiar123", 10);

  const jefe = await prisma.usuario.upsert({
    where: { correo: "jefe@internetfibra.com" },
    update: {},
    create: {
      nombre: "Jefe Principal",
      correo: "jefe@internetfibra.com",
      passwordHash,
      rol: "JEFE",
    },
  });

  const administrador = await prisma.usuario.upsert({
    where: { correo: "admin@internetfibra.com" },
    update: {},
    create: {
      nombre: "Administrador de Prueba",
      correo: "admin@internetfibra.com",
      passwordHash,
      rol: "ADMINISTRADOR",
      idSupervisor: jefe.idUsuario,
    },
  });

  const trabajador = await prisma.usuario.upsert({
    where: { correo: "trabajador@internetfibra.com" },
    update: {},
    create: {
      nombre: "Trabajador de Prueba",
      correo: "trabajador@internetfibra.com",
      passwordHash,
      rol: "TRABAJADOR",
      idSupervisor: administrador.idUsuario,
    },
  });

  // ---------------------------------------------------------
  // EJEMPLO: simula que el trabajador y el administrador
  // renovaron su contraseña, para comprobar que la notificación
  // al supervisor funciona (revísalo en /perfil del jefe y del admin,
  // o directamente en la tabla "notificacion" con Prisma Studio).
  // ---------------------------------------------------------
  const nuevoHashTrabajador = await bcrypt.hash("nuevaClave123", 10);
  await prisma.usuario.update({
    where: { idUsuario: trabajador.idUsuario },
    data: { passwordHash: nuevoHashTrabajador },
  });
  await prisma.notificacion.create({
    data: {
      idUsuarioDestino: administrador.idUsuario,
      mensaje: `${trabajador.nombre} (TRABAJADOR) actualizó su contraseña (ejemplo generado por el seed).`,
    },
  });

  const nuevoHashAdmin = await bcrypt.hash("nuevaClave456", 10);
  await prisma.usuario.update({
    where: { idUsuario: administrador.idUsuario },
    data: { passwordHash: nuevoHashAdmin },
  });
  await prisma.notificacion.create({
    data: {
      idUsuarioDestino: jefe.idUsuario,
      mensaje: `${administrador.nombre} (ADMINISTRADOR) actualizó su contraseña (ejemplo generado por el seed).`,
    },
  });

  console.log("Usuarios creados:");
  console.log("- jefe@internetfibra.com          | contraseña: cambiar123");
  console.log(
    "- admin@internetfibra.com         | contraseña: nuevaClave456 (se cambió por el ejemplo)",
  );
  console.log(
    "- trabajador@internetfibra.com     | contraseña: nuevaClave123 (se cambió por el ejemplo)",
  );
  console.log("");
  console.log(
    "Revisa /perfil como jefe y como admin -> deberías ver la notificación del cambio.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
