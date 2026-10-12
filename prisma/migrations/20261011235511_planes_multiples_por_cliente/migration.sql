/*
  Warnings:

  - A unique constraint covering the columns `[id_servicio,periodo]` on the table `pago` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "tipo_solicitud_enum" ADD VALUE 'CAMBIO_SERVICIO';
ALTER TYPE "tipo_solicitud_enum" ADD VALUE 'NUEVO_SERVICIO';

-- DropIndex
DROP INDEX "pago_id_cliente_periodo_key";

-- AlterTable
ALTER TABLE "pago" ADD COLUMN     "fecha_cobro" TIMESTAMPTZ,
ADD COLUMN     "id_servicio" INTEGER;

-- AlterTable
ALTER TABLE "solicitud" ADD COLUMN     "id_servicio" INTEGER;

-- CreateTable
CREATE TABLE "servicio" (
    "id_servicio" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "plan_tarifario" "plan_tarifario_enum" NOT NULL,
    "precio_mensual" DECIMAL(8,2) NOT NULL,
    "dia_cobro" INTEGER NOT NULL DEFAULT 1,
    "dia_vencimiento" INTEGER,
    "fecha_hora_instalacion" TIMESTAMPTZ,
    "tipo_accion" "tipo_accion_enum",
    "tipo_instalacion" "tipo_instalacion_enum",
    "tiene_costo_instalacion" BOOLEAN NOT NULL DEFAULT false,
    "derecho_instalacion" DECIMAL(8,2),
    "tiene_servicio_adicional" BOOLEAN NOT NULL DEFAULT false,
    "servicio_adicional_detalle" VARCHAR(200),
    "servicio_adicional_precio" DECIMAL(8,2),
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servicio_pkey" PRIMARY KEY ("id_servicio")
);

-- CreateIndex
CREATE INDEX "servicio_id_cliente_idx" ON "servicio"("id_cliente");

-- CreateIndex
CREATE INDEX "pago_id_servicio_idx" ON "pago"("id_servicio");

-- CreateIndex
CREATE UNIQUE INDEX "pago_id_servicio_periodo_key" ON "pago"("id_servicio", "periodo");

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_id_servicio_fkey" FOREIGN KEY ("id_servicio") REFERENCES "servicio"("id_servicio") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicio" ADD CONSTRAINT "servicio_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE CASCADE ON UPDATE CASCADE;
