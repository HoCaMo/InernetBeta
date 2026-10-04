/*
  Warnings:

  - You are about to drop the column `fecha_activacion_sin_deuda` on the `cliente` table. All the data in the column will be lost.
  - You are about to drop the column `fecha_reactivacion_suspension` on the `cliente` table. All the data in the column will be lost.
  - You are about to drop the column `traslado_exterior` on the `cliente` table. All the data in the column will be lost.
  - You are about to drop the column `traslado_interior` on the `cliente` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "tipo_accion_enum" AS ENUM ('INSTALACION_NUEVA', 'TRASLADO', 'REACTIVACION');

-- CreateEnum
CREATE TYPE "tipo_instalacion_enum" AS ENUM ('FIJO', 'NO_FIJO');

-- AlterTable
ALTER TABLE "cliente" DROP COLUMN "fecha_activacion_sin_deuda",
DROP COLUMN "fecha_reactivacion_suspension",
DROP COLUMN "traslado_exterior",
DROP COLUMN "traslado_interior",
ADD COLUMN     "fecha_hora_instalacion" TIMESTAMPTZ,
ADD COLUMN     "tiene_costo_instalacion" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tipo_accion" "tipo_accion_enum",
ADD COLUMN     "tipo_instalacion" "tipo_instalacion_enum";
