INSERT INTO servicio (
  id_cliente, plan_tarifario, precio_mensual, dia_cobro,
  fecha_hora_instalacion, tipo_accion, tipo_instalacion,
  tiene_costo_instalacion, derecho_instalacion
)
SELECT
  c.id_cliente, c.plan_tarifario, c.pago_mensual, 1,
  c.fecha_hora_instalacion, c.tipo_accion, c.tipo_instalacion,
  c.tiene_costo_instalacion, c.derecho_instalacion
FROM cliente c
WHERE c.plan_tarifario IS NOT NULL
  AND c.pago_mensual IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM servicio s WHERE s.id_cliente = c.id_cliente);
 
UPDATE pago p
SET id_servicio = s.id_servicio
FROM servicio s
WHERE s.id_cliente = p.id_cliente
  AND p.id_servicio IS NULL;
 
UPDATE pago
SET fecha_cobro = date_trunc('month', fecha_vencimiento)
WHERE fecha_cobro IS NULL;