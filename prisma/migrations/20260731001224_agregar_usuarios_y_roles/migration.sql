-- CreateEnum
CREATE TYPE "rol_usuario_enum" AS ENUM ('JEFE', 'ADMINISTRADOR', 'TRABAJADOR');

-- CreateEnum
CREATE TYPE "estado_aprobacion_cliente_enum" AS ENUM ('PENDIENTE', 'ACEPTADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "tipo_solicitud_enum" AS ENUM ('CREACION_CLIENTE', 'EDICION_CLIENTE', 'TRANSFERENCIA_CLIENTES', 'CREACION_TRABAJADOR');

-- CreateEnum
CREATE TYPE "estado_solicitud_enum" AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA');

-- AlterTable
ALTER TABLE "cliente" ADD COLUMN     "estado_aprobacion" "estado_aprobacion_cliente_enum" NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "id_asignado_a" INTEGER,
ADD COLUMN     "id_creado_por" INTEGER;

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "correo" VARCHAR(150) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "rol_usuario_enum" NOT NULL,
    "id_supervisor" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "solicitud" (
    "id_solicitud" SERIAL NOT NULL,
    "tipo" "tipo_solicitud_enum" NOT NULL,
    "estado" "estado_solicitud_enum" NOT NULL DEFAULT 'PENDIENTE',
    "id_solicitante" INTEGER NOT NULL,
    "id_resolutor" INTEGER,
    "id_cliente" INTEGER,
    "id_trabajador_origen" INTEGER,
    "id_trabajador_destino" INTEGER,
    "datos_propuestos" JSONB,
    "comentario" TEXT,
    "fecha_solicitud" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_resolucion" TIMESTAMPTZ,

    CONSTRAINT "solicitud_pkey" PRIMARY KEY ("id_solicitud")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- CreateIndex
CREATE INDEX "usuario_id_supervisor_idx" ON "usuario"("id_supervisor");

-- CreateIndex
CREATE INDEX "solicitud_estado_idx" ON "solicitud"("estado");

-- CreateIndex
CREATE INDEX "solicitud_id_solicitante_idx" ON "solicitud"("id_solicitante");

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_id_creado_por_fkey" FOREIGN KEY ("id_creado_por") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_id_asignado_a_fkey" FOREIGN KEY ("id_asignado_a") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_id_supervisor_fkey" FOREIGN KEY ("id_supervisor") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_id_solicitante_fkey" FOREIGN KEY ("id_solicitante") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_id_resolutor_fkey" FOREIGN KEY ("id_resolutor") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE SET NULL ON UPDATE CASCADE;
