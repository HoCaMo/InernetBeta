import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ⚠️ EDITA estos 3 valores con los datos reales antes de correr el script
  const nombre = "Beto Gomes";
  const correo = "jefe@tudominio.com";
  const password = "ContrasenaSegura123";

  const passwordHash = await bcrypt.hash(password, 10);

  const jefe = await prisma.usuario.upsert({
    where: { correo },
    update: {},
    create: {
      nombre,
      correo,
      passwordHash,
      rol: "JEFE",
    },
  });

  console.log("Jefe creado/confirmado:");
  console.log(`  ID: ${jefe.idUsuario}`);
  console.log(`  Correo: ${jefe.correo}`);
  console.log(
    `  Contraseña: ${password}  <- guárdala en un lugar seguro, no queda en la BD en texto plano`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
