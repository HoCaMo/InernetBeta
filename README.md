# Internet Fibra — Sistema de Gestión de Clientes

Sistema interno para una empresa de internet por fibra óptica que gestiona el registro de clientes, instalaciones y personal mediante un flujo de aprobación jerárquico con tres roles: **Jefe**, **Administrador** y **Trabajador**.

Construido con **Next.js (App Router)**, **Prisma ORM**, **PostgreSQL** y **NextAuth (Auth.js)**.

## ¿Qué puede hacer cada rol?

### 👷 Trabajador
- Generar nuevos clientes mediante un formulario completo de instalación (datos personales, documento de identidad con validación exacta de dígitos, ubicación, plan tarifario, materiales usados, traslados y reactivaciones)
- Ver el estado de sus solicitudes (pendiente / aceptado / rechazado)
- Ver la lista de sus propios clientes asignados
- Renovar su contraseña

### 🧑‍💼 Administrador
- Revisar, aceptar, rechazar o editar los clientes generados por sus trabajadores
- Ver quién generó cada solicitud
- Solicitar al jefe la creación de nuevos trabajadores (con contraseña inicial)
- Solicitar al jefe la transferencia de clientes entre trabajadores
- Definir el estado "activo" y el derecho de instalación de un cliente ya aprobado
- Renovar su contraseña (notifica automáticamente al jefe)

### 👑 Jefe
- Ver y resolver **todas** las solicitudes del sistema (auditoría completa)
- Aprobar o rechazar la creación de nuevos administradores (los crea directamente, sin aprobación superior)
- Aprobar, rechazar transferencias de clientes entre trabajadores
- Aprobar o rechazar la creación de nuevos trabajadores solicitada por administradores
- Ver quién hizo cada solicitud y quién la resolvió
- Renovar su contraseña

## Funcionalidades clave

- **Autenticación con roles** (NextAuth + credenciales), sesión con expiración automática
- **Flujo de solicitudes con resolución atómica**: si dos personas intentan aceptar/rechazar la misma solicitud al mismo tiempo, solo la primera tiene efecto (sin condiciones de carrera)
- **Notificaciones en tiempo real** (sin recargar la página) cuando: un cliente es generado, una solicitud es resuelta, una contraseña es renovada, o se completa la activación de un cliente
- **Validación en vivo** del número de documento (DNI, CE, RUC, Pasaporte) según la cantidad exacta de dígitos de cada tipo
- **Cálculo automático** del pago mensual según el plan tarifario elegido, y del plazo de instalación (hoy → mañana 5:00 p.m.)
- **Liquidación de materiales** por instalación (acometida, roseta, router GPON, etc.)
- **Base de datos relacional en PostgreSQL** con restricciones de integridad (formato de documentos, teléfonos, coordenadas, jerarquía de usuarios)

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend / Backend | Next.js 16 (App Router, Server Actions) |
| Base de datos | PostgreSQL |
| ORM | Prisma |
| Autenticación | NextAuth (Auth.js v5) |
| Estilos | Tailwind CSS |

## Cómo correrlo localmente

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno (.env)
DATABASE_URL=postgresql://usuario:password@localhost:5432/internet_fibra?schema=public
AUTH_SECRET=<genera uno con: npx auth secret>

# 3. Crear las tablas
npx prisma migrate dev

# 4. Generar el cliente de Prisma
npx prisma generate

# 5. Cargar usuarios de prueba (jefe, administrador, trabajador)
npx prisma db seed

# 6. Levantar el proyecto
npm run dev
```

Luego entra a `http://localhost:3000` — te redirige automáticamente al login.

## Estructura del proyecto

```
app/
├── jefe/           → Panel del Jefe
├── administrador/  → Panel del Administrador
├── trabajador/     → Panel del Trabajador
├── clientes/       → Creación y gestión de clientes
├── solicitudes/    → Bandeja de solicitudes por rol
├── perfil/         → Cambio de contraseña
├── ubigeo/         → Gestión de ubicaciones
└── components/     → Shell (nav), campana de notificaciones, logout
prisma/
├── schema.prisma   → Modelo de datos completo
└── seed.ts         → Usuarios y datos de ejemplo
```
