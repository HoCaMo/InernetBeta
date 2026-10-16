import { PrismaClient, type RolUsuario } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

// Si defines SEED_PASSWORD en tu .env LOCAL (nunca en Vercel ni en Git),
// todas las cuentas nuevas usarán esa contraseña. Si no, se genera una al azar.
const PASSWORD_FIJA = process.env.SEED_PASSWORD;

function generarPasswordSegura(): string {
  const bloque = () => randomBytes(3).toString("hex");
  return `${bloque()}-${bloque()}-${bloque()}`;
}

const creadas: string[] = [];

// Crea la cuenta SOLO si no existe. Si ya existe, no toca nada (ni la contraseña).
async function asegurarUsuario(correo: string, nombre: string, rol: RolUsuario, idSupervisor?: number) {
  const existente = await prisma.usuario.findUnique({ where: { correo } });
  if (existente) {
    console.log(`Ya existe: ${correo} (no se modifica)`);
    return existente;
  }

  const password = PASSWORD_FIJA ?? generarPasswordSegura();
  const usuario = await prisma.usuario.create({
    data: {
      nombre,
      correo,
      passwordHash: await bcrypt.hash(password, 10),
      rol,
      idSupervisor,
    },
  });
  creadas.push(`${rol.padEnd(13)} ${correo} | ${password}`);
  return usuario;
}

async function main() {
  const jefe = await asegurarUsuario("jefe@internetfibra.com", "Jefe de Prueba", "JEFE");
  const admin = await asegurarUsuario("admin@internetfibra.com", "Administrador de Prueba", "ADMINISTRADOR", jefe.idUsuario);
  await asegurarUsuario("trabajador@internetfibra.com", "Trabajador de Prueba", "TRABAJADOR", admin.idUsuario);

  if (creadas.length > 0) {
    console.log("========================================");
    console.log("Cuentas NUEVAS (guarda estas contraseñas, no se vuelven a mostrar):");
    creadas.forEach((c) => console.log(c));
    console.log("========================================");
  } else {
    console.log("No se creó ninguna cuenta nueva; las contraseñas no cambiaron.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());