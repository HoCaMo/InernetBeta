
-- Formato de correo
ALTER TABLE cliente
  ADD CONSTRAINT ck_correo_formato
  CHECK (correo IS NULL OR correo ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Rango de coordenadas
ALTER TABLE cliente
  ADD CONSTRAINT ck_latitud CHECK (latitud IS NULL OR latitud BETWEEN -90 AND 90);
ALTER TABLE cliente
  ADD CONSTRAINT ck_longitud CHECK (longitud IS NULL OR longitud BETWEEN -180 AND 180);

-- tipo_ruc solo puede existir si el documento es RUC
ALTER TABLE documento_cliente
  ADD CONSTRAINT ck_ruc_coherente
  CHECK (
    (tipo_documento = 'RUC' AND tipo_ruc IS NOT NULL)
    OR (tipo_documento <> 'RUC' AND tipo_ruc IS NULL)
  );

-- Formato de documento según su tipo
ALTER TABLE documento_cliente
  ADD CONSTRAINT ck_numero_documento_formato
  CHECK (
    (tipo_documento = 'DNI' AND numero_documento ~ '^[0-9]{8}$')
    OR (tipo_documento = 'RUC' AND numero_documento ~ '^[0-9]{11}$')
    OR (tipo_documento = 'CE'  AND numero_documento ~ '^[A-Za-z0-9]{6,20}$')
  );

-- Formato de teléfono
ALTER TABLE telefono
  ADD CONSTRAINT ck_numero_formato CHECK (numero ~ '^[0-9]{7,15}$');

-- Un cliente no puede tener dos teléfonos marcados como "principal"
CREATE UNIQUE INDEX uq_telefono_principal_por_cliente
  ON telefono (id_cliente)
  WHERE principal = TRUE;