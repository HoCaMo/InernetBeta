-- AlterTable
ALTER TABLE "servicio" ADD COLUMN     "id_plan" INTEGER,
ADD COLUMN     "plan_nombre" VARCHAR(80);

-- CreateTable
CREATE TABLE "plan" (
    "id_plan" SERIAL NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "velocidad_mbps" INTEGER,
    "precio_mensual" DECIMAL(8,2) NOT NULL,
    "para_todos" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "id_creado_por" INTEGER,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_pkey" PRIMARY KEY ("id_plan")
);

-- CreateTable
CREATE TABLE "plan_administrador" (
    "id_plan" INTEGER NOT NULL,
    "id_administrador" INTEGER NOT NULL,

    CONSTRAINT "plan_administrador_pkey" PRIMARY KEY ("id_plan","id_administrador")
);

-- CreateIndex
CREATE INDEX "servicio_id_plan_idx" ON "servicio"("id_plan");

-- AddForeignKey
ALTER TABLE "servicio" ADD CONSTRAINT "servicio_id_plan_fkey" FOREIGN KEY ("id_plan") REFERENCES "plan"("id_plan") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan" ADD CONSTRAINT "plan_id_creado_por_fkey" FOREIGN KEY ("id_creado_por") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_administrador" ADD CONSTRAINT "plan_administrador_id_plan_fkey" FOREIGN KEY ("id_plan") REFERENCES "plan"("id_plan") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_administrador" ADD CONSTRAINT "plan_administrador_id_administrador_fkey" FOREIGN KEY ("id_administrador") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;
