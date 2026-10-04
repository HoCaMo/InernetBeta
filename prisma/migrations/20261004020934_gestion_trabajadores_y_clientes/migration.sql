/*
  Warnings:

  - A unique constraint covering the columns `[numero_documento]` on the table `usuario` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[telefono]` on the table `usuario` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "tipo_solicitud_enum" ADD VALUE 'ELIMINACION_CLIENTE';
ALTER TYPE "tipo_solicitud_enum" ADD VALUE 'EDICION_TRABAJADOR';
ALTER TYPE "tipo_solicitud_enum" ADD VALUE 'ELIMINACION_TRABAJADOR';
ALTER TYPE "tipo_solicitud_enum" ADD VALUE 'CAMBIO_SUPERVISOR_TRABAJADOR';

-- AlterTable
ALTER TABLE "solicitud" ADD COLUMN     "id_nuevo_supervisor" INTEGER,
ADD COLUMN     "ids_clientes_transferir" INTEGER[];

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "numero_documento" TEXT,
ADD COLUMN     "telefono" TEXT,
ADD COLUMN     "tipo_documento" "tipo_documento_enum";

-- CreateIndex
CREATE UNIQUE INDEX "usuario_numero_documento_key" ON "usuario"("numero_documento");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_telefono_key" ON "usuario"("telefono");
