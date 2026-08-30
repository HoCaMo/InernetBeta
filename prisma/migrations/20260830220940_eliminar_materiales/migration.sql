/*
  Warnings:

  - You are about to drop the `material_instalacion` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "material_instalacion" DROP CONSTRAINT "material_instalacion_id_cliente_fkey";

-- DropTable
DROP TABLE "material_instalacion";

-- DropEnum
DROP TYPE "tipo_material_enum";
