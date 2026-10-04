import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

// Genera una contraseña aleatoria legible, ej: "Xk29-Qp7m-Rt4v"
function generarPasswordSegura(): string {
  const bloque = () => randomBytes(3).toString("hex");
  return `${bloque()}-${bloque()}-${bloque()}`;
}

async function main() {
  const passwordJefe = generarPasswordSegura();
  const passwordAdmin = generarPasswordSegura();
  const passwordTrabajador = generarPasswordSegura();

  const jefe = await prisma.usuario.upsert({
    where: { correo: "jefe@internetfibra.com" },
    update: { passwordHash: await bcrypt.hash(passwordJefe, 10) },
    create: {
      nombre: "Jefe de Prueba",
      correo: "jefe@internetfibra.com",
      passwordHash: await bcrypt.hash(passwordJefe, 10),
      rol: "JEFE",
    },
  });

  const administrador = await prisma.usuario.upsert({
    where: { correo: "admin@internetfibra.com" },
    update: { passwordHash: await bcrypt.hash(passwordAdmin, 10) },
    create: {
      nombre: "Administrador de Prueba",
      correo: "admin@internetfibra.com",
      passwordHash: await bcrypt.hash(passwordAdmin, 10),
      rol: "ADMINISTRADOR",
      idSupervisor: jefe.idUsuario,
    },
  });

  await prisma.usuario.upsert({
    where: { correo: "trabajador@internetfibra.com" },
    update: { passwordHash: await bcrypt.hash(passwordTrabajador, 10) },
    create: {
      nombre: "Trabajador de Prueba",
      correo: "trabajador@internetfibra.com",
      passwordHash: await bcrypt.hash(passwordTrabajador, 10),
      rol: "TRABAJADOR",
      idSupervisor: administrador.idUsuario,
    },
  });

  console.log("========================================");
  console.log("Usuarios de prueba listos. GUARDA estas contraseñas ahora,");
  console.log(
    "no se te van a volver a mostrar (no quedan en texto plano en la BD):",
  );
  console.log("========================================");
  console.log(
    `Jefe          -> jefe@internetfibra.com        | ${passwordJefe}`,
  );
  console.log(
    `Administrador -> admin@internetfibra.com       | ${passwordAdmin}`,
  );
  console.log(
    `Trabajador    -> trabajador@internetfibra.com  | ${passwordTrabajador}`,
  );
  console.log("========================================");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
