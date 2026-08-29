-- CreateEnum
CREATE TYPE "tipo_cliente_enum" AS ENUM ('NACIONAL', 'EXTRANJERO', 'EMPRESA');

-- CreateEnum
CREATE TYPE "estado_cliente_enum" AS ENUM ('ACTIVO', 'SUSPENDIDO', 'BAJA');

-- CreateEnum
CREATE TYPE "tipo_documento_enum" AS ENUM ('DNI', 'CE', 'RUC');

-- CreateEnum
CREATE TYPE "tipo_ruc_enum" AS ENUM ('10', '20');

-- CreateTable
CREATE TABLE "ubigeo" (
    "id_ubigeo" SERIAL NOT NULL,
    "departamento" VARCHAR(100) NOT NULL,
    "provincia" VARCHAR(100) NOT NULL,
    "distrito" VARCHAR(100) NOT NULL,
    "localidad" VARCHAR(150) NOT NULL DEFAULT '',

    CONSTRAINT "ubigeo_pkey" PRIMARY KEY ("id_ubigeo")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id_cliente" SERIAL NOT NULL,
    "tipo_cliente" "tipo_cliente_enum" NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "apellido" VARCHAR(80),
    "correo" VARCHAR(150),
    "direccion" VARCHAR(250),
    "id_ubigeo" INTEGER,
    "latitud" DECIMAL(9,6),
    "longitud" DECIMAL(9,6),
    "foto_referencia" TEXT,
    "referencia" TEXT,
    "fecha_registro" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "estado_cliente_enum" NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id_cliente")
);

-- CreateTable
CREATE TABLE "documento_cliente" (
    "id_documento" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "tipo_documento" "tipo_documento_enum" NOT NULL,
    "numero_documento" VARCHAR(20) NOT NULL,
    "tipo_ruc" "tipo_ruc_enum",
    "scanner_documento" TEXT,

    CONSTRAINT "documento_cliente_pkey" PRIMARY KEY ("id_documento")
);

-- CreateTable
CREATE TABLE "telefono" (
    "id_telefono" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "numero" VARCHAR(15) NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "telefono_pkey" PRIMARY KEY ("id_telefono")
);

-- CreateIndex
CREATE UNIQUE INDEX "ubigeo_departamento_provincia_distrito_localidad_key" ON "ubigeo"("departamento", "provincia", "distrito", "localidad");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_correo_key" ON "cliente"("correo");

-- CreateIndex
CREATE INDEX "cliente_nombre_idx" ON "cliente"("nombre");

-- CreateIndex
CREATE INDEX "cliente_apellido_idx" ON "cliente"("apellido");

-- CreateIndex
CREATE INDEX "documento_cliente_numero_documento_idx" ON "documento_cliente"("numero_documento");

-- CreateIndex
CREATE INDEX "documento_cliente_id_cliente_idx" ON "documento_cliente"("id_cliente");

-- CreateIndex
CREATE UNIQUE INDEX "documento_cliente_tipo_documento_numero_documento_key" ON "documento_cliente"("tipo_documento", "numero_documento");

-- CreateIndex
CREATE UNIQUE INDEX "telefono_numero_key" ON "telefono"("numero");

-- CreateIndex
CREATE INDEX "telefono_numero_idx" ON "telefono"("numero");

-- CreateIndex
CREATE INDEX "telefono_id_cliente_idx" ON "telefono"("id_cliente");

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "cliente_id_ubigeo_fkey" FOREIGN KEY ("id_ubigeo") REFERENCES "ubigeo"("id_ubigeo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento_cliente" ADD CONSTRAINT "documento_cliente_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telefono" ADD CONSTRAINT "telefono_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE CASCADE ON UPDATE CASCADE;
