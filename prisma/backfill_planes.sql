INSERT INTO plan (nombre, velocidad_mbps, precio_mensual, para_todos, activo)
SELECT v.nombre, v.vel, v.precio, true, true
FROM (VALUES
  ('200 Mbps', 200, 50.00),
  ('400 Mbps', 400, 60.00),
  ('600 Mbps', 600, 70.00),
  ('800 Mbps', 800, 90.00),
  ('1 Gbps', 1000, 120.00)
) AS v(nombre, vel, precio)
WHERE NOT EXISTS (SELECT 1 FROM plan);
UPDATE servicio s
SET id_plan = p.id_plan, plan_nombre = p.nombre
FROM plan p
WHERE s.id_plan IS NULL
  AND s.plan_tarifario IS NOT NULL
  AND p.nombre = CASE s.plan_tarifario::text
    WHEN 'MBPS_200' THEN '200 Mbps'
    WHEN 'MBPS_400' THEN '400 Mbps'
    WHEN 'MBPS_600' THEN '600 Mbps'
    WHEN 'MBPS_800' THEN '800 Mbps'
    WHEN 'GBPS_1' THEN '1 Gbps'
  END;