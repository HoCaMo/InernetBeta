import { PrismaClient } from "@prisma/client";
import ubigeoPeru from "./data/ubigeo-peru.json";

const prisma = new PrismaClient();

async function main() {
  const filas = (
    ubigeoPeru as {
      departamento: string;
      provincia: string;
      distrito: string;
    }[]
  ).map((u) => ({
    departamento: u.departamento,
    provincia: u.provincia,
    distrito: u.distrito,
    localidad: "",
  }));

  console.log(`Cargando ${filas.length} distritos...`);

  // createMany con skipDuplicates evita error si ya existían algunos registros
  const resultado = await prisma.ubigeo.createMany({
    data: filas,
    skipDuplicates: true,
  });

  console.log(`Insertados: ${resultado.count} nuevos registros de ubigeo.`);

  const total = await prisma.ubigeo.count();
  console.log(`Total de filas en la tabla ubigeo ahora: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
