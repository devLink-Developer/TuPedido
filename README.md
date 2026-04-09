# Kepedimos

Plataforma multi-comercio tipo delivery, con SPA React como interfaz principal y backend FastAPI + PostgreSQL para clientes, comercios y admin.

## Servicios

- Frontend SPA: http://localhost:8015
- Backend API: http://localhost:8016
- Docs API: http://localhost:8016/docs

## Arranque con Docker

```bash
docker compose up --build
```

Notas de despliegue:

- El proyecto Compose queda fijado como `tupedido`, asi el nombre no cambia segun la carpeta del servidor.
- PostgreSQL no se publica al host por defecto; solo queda accesible para `backend` y `worker` dentro de la red Docker.
- `frontend` se sirve como build estatico con Nginx y hace reverse proxy de `/api/v1` y `/media` hacia `backend`.
- Nginx resuelve dinamicamente `backend` dentro de la red Docker para tolerar recreaciones del contenedor sin quedar apuntando a una IP vieja.
- `frontend` espera a que `backend` quede healthy antes de arrancar, y `backend` corre sin `--reload` en esta compose para evitar reinicios del upstream durante el deploy.
- Si necesitas abrir PostgreSQL temporalmente para administracion, hazlo con un override puntual y no en la compose principal.

## Credenciales demo

- Admin: `admin@kepedimos.com` / `admin1234`
- Comercio demo: `merchant@kepedimos.example.com` / `merchant123`
- Cliente demo: `cliente@kepedimos.example.com` / `cliente123`
- Aspirante comercio: `applicant@kepedimos.example.com` / `applicant123`

## Bootstrap admin

- En cada arranque del backend se evalua el bootstrap del admin canonico, aunque ya existan otros admins.
- En cada arranque, si `BOOTSTRAP_ADMIN_ENABLED=true`, se garantiza el admin configurado por `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD`.
- El admin demo canonico por defecto es `admin@kepedimos.com` / `admin1234`.
- Los admins demo legacy se migran o desactivan para evitar duplicados activos.
- En `development`, el seed demo completa solo los faltantes y no reescribe los datos demo existentes, salvo la garantia de acceso del admin.

## Estructura

- `frontend/`: SPA React/Vite/PWA ahora usada como interfaz principal.
- `backend/`: API FastAPI con auth, catálogo, onboarding merchant, admin, carrito, checkout y pagos simulados.
- `docker-compose.yml`: frontend, backend y PostgreSQL para desarrollo.
- `*.html` en la raíz: prototipos heredados, ya no son la interfaz productiva principal.

## Alcance implementado

- Auth con roles `customer | merchant | admin`
- Catálogo multi-rubro y stores aprobados
- Postulación de comercios y aprobación admin
- Panel merchant para store, categorías, horarios, delivery, pagos y productos
- Carrito por comercio y checkout con `delivery | pickup`
- Mercado Pago simulado por store y webhook de actualización de pago
- Historial y detalle de pedidos del cliente

## Notas

- Los datos demo se cargan solo cuando `APP_ENV=development` y `SEED_DEMO_DATA=true`.
- `MERCADOPAGO_SIMULATED=true` mantiene el flujo local con simulador y webhook manual.
- Para usar Checkout Pro real debes configurar `BACKEND_BASE_URL` y `FRONTEND_BASE_URL` publicos, y poner `MERCADOPAGO_SIMULATED=false`.
- Los HTML raíz se conservan como referencia visual, pero el deploy local ya sirve la SPA React.
