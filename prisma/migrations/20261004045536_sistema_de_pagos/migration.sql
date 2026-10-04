-- CreateEnum
CREATE TYPE "estado_pago_enum" AS ENUM ('PENDIENTE', 'PAGADO', 'VENCIDO');

-- CreateTable
CREATE TABLE "pago" (
    "id_pago" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "concepto" VARCHAR(150) NOT NULL,
    "monto" DECIMAL(8,2) NOT NULL,
    "descuento" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "monto_final" DECIMAL(8,2) NOT NULL,
    "fecha_emision" TIMESTAMPTZ NOT NULL,
    "fecha_vencimiento" TIMESTAMPTZ NOT NULL,
    "fecha_pago" TIMESTAMPTZ,
    "estado" "estado_pago_enum" NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "pago_pkey" PRIMARY KEY ("id_pago")
);

-- CreateIndex
CREATE INDEX "pago_id_cliente_idx" ON "pago"("id_cliente");

-- CreateIndex
CREATE INDEX "pago_estado_idx" ON "pago"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "pago_id_cliente_periodo_key" ON "pago"("id_cliente", "periodo");

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE CASCADE ON UPDATE CASCADE;
