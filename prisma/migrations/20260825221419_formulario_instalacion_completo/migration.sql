-- CreateEnum
CREATE TYPE "nacionalidad_enum" AS ENUM ('PERUANA', 'EXTRANJERA');

-- CreateEnum
CREATE TYPE "uso_servicio_enum" AS ENUM ('HOGAR', 'RESIDENCIAL', 'COMERCIAL');

-- CreateEnum
CREATE TYPE "condicion_cliente_enum" AS ENUM ('INTEGRACION', 'MIGRACION');

-- CreateEnum
CREATE TYPE "plan_tarifario_enum" AS ENUM ('MBPS_200', 'MBPS_400', 'MBPS_600', 'MBPS_800', 'GBPS_1');

-- CreateEnum
CREATE TYPE "tipo_material_enum" AS ENUM ('ACOMETIDA', 'ROSETA', 'ROUTER_GPON', 'PIG_TAIL', 'CONTENEDOR_MECANICO', 'GRAPAS', 'FUSION', 'PARCH_CORD', 'SMOOT');

-- AlterEnum
ALTER TYPE "tipo_documento_enum" ADD VALUE 'PASAPORTE';

-- AlterTable
ALTER TABLE "cliente" ADD COLUMN     "activo" BOOLEAN,
ADD COLUMN     "condicion_cliente" "condicion_cliente_enum",
ADD COLUMN     "datos_admin_completos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "datos_completos" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "derecho_instalacion" DECIMAL(6,2),
ADD COLUMN     "fecha_activacion_sin_deuda" TIMESTAMPTZ,
ADD COLUMN     "fecha_inicio" TIMESTAMPTZ,
ADD COLUMN     "fecha_limite_instalacion" TIMESTAMPTZ,
ADD COLUMN     "fecha_reactivacion_suspension" TIMESTAMPTZ,
ADD COLUMN     "nacionalidad" VARCHAR(50),
ADD COLUMN     "pago_mensual" DECIMAL(6,2),
ADD COLUMN     "plan_tarifario" "plan_tarifario_enum",
ADD COLUMN     "representante_legal" VARCHAR(150),
ADD COLUMN     "traslado_exterior" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "traslado_interior" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "uso_servicio" "uso_servicio_enum";

-- CreateTable
CREATE TABLE "material_instalacion" (
    "id_material" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "tipo" "tipo_material_enum" NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "material_instalacion_pkey" PRIMARY KEY ("id_material")
);

-- CreateIndex
CREATE INDEX "material_instalacion_id_cliente_idx" ON "material_instalacion"("id_cliente");

-- AddForeignKey
ALTER TABLE "material_instalacion" ADD CONSTRAINT "material_instalacion_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE CASCADE ON UPDATE CASCADE;
