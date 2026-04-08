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
- Si necesitas abrir PostgreSQL temporalmente para administracion, hazlo con un override puntual y no en la compose principal.

## Credenciales demo

- Admin: `admin@kepedimos.example.com` / `admin1234`
- Comercio demo: `merchant@kepedimos.example.com` / `merchant123`
- Cliente demo: `cliente@kepedimos.example.com` / `cliente123`
- Aspirante comercio: `applicant@kepedimos.example.com` / `applicant123`

## Bootstrap admin

- En cada arranque del backend se verifica si existe algun usuario con rol `admin`.
- Si no existe ninguno y `BOOTSTRAP_ADMIN_ENABLED=true`, se crea un admin inicial con `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD`.
- Si ya existe un admin, no se crea otro ni se pisa ese usuario.
- En `development`, el seed demo reutiliza esos mismos valores para el admin.

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
