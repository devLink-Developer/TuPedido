# Especificacion API para app movil

Este documento resume los endpoints necesarios para conectar una app movil al backend de TuPedido/Kepedimos.

El backend es una API FastAPI. El contrato completo tambien se puede consultar en runtime desde:

- OpenAPI JSON: `GET /api/v1/openapi.json`
- Swagger UI: `GET /docs`
- Healthcheck: `GET /health`

## Base URL

En produccion:

```txt
https://kepedimos.com/api/v1
```

En desarrollo local con Docker:

```txt
http://localhost:8016/api/v1
```

En Android Emulator:

```txt
http://10.0.2.2:8016/api/v1
```

En un celular fisico conectado a la misma red que la PC:

```txt
http://<IP_DE_TU_PC>:8016/api/v1
```

Los archivos estaticos subidos se sirven fuera del prefijo `/api/v1`:

```txt
https://kepedimos.com/media/...
```

En desarrollo local, usar el mismo host local o de emulador del backend, por ejemplo `http://10.0.2.2:8016/media/...`.

## Convenciones

La API usa JSON para requests y responses, salvo uploads `multipart/form-data`.

Headers recomendados:

```http
Accept: application/json
Content-Type: application/json
```

Para endpoints protegidos:

```http
Authorization: Bearer <access_token>
```

Fechas y horas se devuelven como strings ISO 8601.

Roles de usuario:

```txt
customer
merchant
delivery
admin
```

## Errores

Formato habitual:

```json
{
  "detail": "Mensaje de error"
}
```

Codigos relevantes:

| Codigo | Significado |
| --- | --- |
| `400` | Request invalido o regla de negocio incumplida |
| `401` | Token faltante, expirado o invalido |
| `403` | Rol sin permisos |
| `404` | Recurso no encontrado |
| `409` | Conflicto de estado, carrito, checkout o duplicado |
| `422` | Error de validacion de campos |
| `502` | Error externo, por ejemplo proveedor de pago |

## Autenticacion

### Login

```http
POST /auth/login
```

Body:

```json
{
  "email": "cliente@example.com",
  "password": "password"
}
```

Response:

```json
{
  "access_token": "jwt",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "full_name": "Cliente Demo",
    "email": "cliente@example.com",
    "role": "customer",
    "is_active": true,
    "must_change_password": false
  }
}
```

### Registro de cliente

```http
POST /auth/register
```

Body:

```json
{
  "full_name": "Cliente Demo",
  "email": "cliente@example.com",
  "password": "password"
}
```

Response: igual a login.

### Usuario actual

```http
GET /auth/me
Authorization: Bearer <access_token>
```

Response:

```json
{
  "id": 1,
  "full_name": "Cliente Demo",
  "email": "cliente@example.com",
  "role": "customer",
  "is_active": true,
  "must_change_password": false
}
```

### Cambio de password

```http
POST /auth/change-password
Authorization: Bearer <access_token>
```

Body:

```json
{
  "current_password": "password",
  "new_password": "nuevo-password"
}
```

### Eliminar cuenta actual

```http
DELETE /auth/me
Authorization: Bearer <access_token>
```

Response: `204 No Content`.

El backend elimina direcciones, carrito, notificaciones y tokens push; tambien anonimiza datos personales en pedidos/perfiles que deban conservarse por trazabilidad legal o contable.

## Catalogo publico

Estos endpoints no requieren token.

### Categorias

```http
GET /catalog/categories
```

Response:

```json
[
  {
    "id": 1,
    "name": "Comida",
    "slug": "comida",
    "description": null,
    "color": "#F97316",
    "color_light": "#FFEDD5",
    "icon": "utensils",
    "is_active": true,
    "sort_order": 0
  }
]
```

### Branding de plataforma

```http
GET /catalog/platform-branding
```

Response:

```json
{
  "platform_logo_url": "/media/platform-branding/logo.png",
  "platform_wordmark_url": null,
  "platform_favicon_url": null,
  "platform_use_logo_as_favicon": false,
  "resolved_favicon_url": null
}
```

### Banner de catalogo

```http
GET /catalog/platform-banner
```

Response:

```json
{
  "catalog_banner_image_url": "/media/platform-branding/banner.png",
  "catalog_banner_width": 1200,
  "catalog_banner_height": 360
}
```

### Listar comercios

```http
GET /catalog/stores
```

Query params opcionales:

| Parametro | Tipo | Descripcion |
| --- | --- | --- |
| `category_slug` | string | Filtra por rubro |
| `search` | string | Busca por nombre, descripcion o direccion |
| `delivery_mode` | `delivery` o `pickup` | Filtra por modalidad soportada |

Ejemplo:

```http
GET /catalog/stores?category_slug=comida&delivery_mode=delivery
```

Response:

```json
[
  {
    "id": 1,
    "slug": "demo-store",
    "name": "Demo Store",
    "description": "Descripcion",
    "address": "Av Siempre Viva 123",
    "postal_code": "5000",
    "province": "Cordoba",
    "locality": "Cordoba",
    "phone": "3510000000",
    "latitude": -31.42,
    "longitude": -64.18,
    "logo_url": "/media/stores/logo.png",
    "cover_image_url": "/media/stores/cover.png",
    "status": "approved",
    "accepting_orders": true,
    "is_open": true,
    "opening_note": null,
    "min_delivery_minutes": 20,
    "max_delivery_minutes": 45,
    "rating": 4.8,
    "rating_count": 10,
    "category_ids": [1],
    "primary_category_id": 1,
    "primary_category": "Comida",
    "primary_category_slug": "comida",
    "categories": ["Comida"],
    "delivery_settings": {
      "delivery_enabled": true,
      "pickup_enabled": true,
      "delivery_fee": 500,
      "free_delivery_min_order": null,
      "rider_fee": 400,
      "min_order": 0
    },
    "payment_settings": {
      "cash_enabled": true,
      "mercadopago_enabled": true,
      "mercadopago_configured": true,
      "mercadopago_provider_enabled": true,
      "mercadopago_provider_mode": "sandbox",
      "mercadopago_public_key_masked": null,
      "mercadopago_connection_status": "connected",
      "mercadopago_reconnect_required": false,
      "mercadopago_onboarding_completed": true,
      "mercadopago_oauth_connected_at": null,
      "mercadopago_mp_user_id": null
    }
  }
]
```

### Detalle de comercio

```http
GET /catalog/stores/{slug}
```

Response: extiende el comercio anterior con `product_categories`, `products` y `hours`.

Producto:

```json
{
  "id": 10,
  "store_id": 1,
  "product_category_id": 2,
  "product_category_name": "Pizzas",
  "product_subcategory_id": null,
  "product_subcategory_name": null,
  "sku": "PIZZA-001",
  "name": "Pizza muzzarella",
  "brand": null,
  "barcode": null,
  "unit_label": "unidad",
  "description": "Pizza grande",
  "price": 6000,
  "compare_at_price": null,
  "final_price": 6000,
  "commercial_discount_type": null,
  "commercial_discount_value": null,
  "commercial_discount_amount": 0,
  "commercial_discount_percentage": 0,
  "has_commercial_discount": false,
  "image_url": "/media/products/pizza.png",
  "stock_quantity": null,
  "max_per_order": null,
  "is_available": true,
  "sort_order": 0
}
```

## Direcciones de cliente

Todos requieren token.

### Listar direcciones

```http
GET /addresses
Authorization: Bearer <access_token>
```

### Crear direccion

```http
POST /addresses
Authorization: Bearer <access_token>
```

Body:

```json
{
  "label": "Casa",
  "postal_code": "5000",
  "province": "Cordoba",
  "locality": "Cordoba",
  "street": "Av Siempre Viva 123",
  "details": "Depto 2",
  "latitude": -31.42,
  "longitude": -64.18,
  "is_default": true
}
```

Response:

```json
{
  "id": 3,
  "label": "Casa",
  "postal_code": "5000",
  "province": "Cordoba",
  "locality": "Cordoba",
  "street": "Av Siempre Viva 123",
  "details": "Depto 2",
  "latitude": -31.42,
  "longitude": -64.18,
  "is_default": true
}
```

### Actualizar direccion

```http
PUT /addresses/{address_id}
Authorization: Bearer <access_token>
```

Body: igual a crear direccion.

### Eliminar direccion

```http
DELETE /addresses/{address_id}
Authorization: Bearer <access_token>
```

### Buscar codigo postal

```http
GET /addresses/postal-code/{postal_code}
Authorization: Bearer <access_token>
```

Response:

```json
{
  "postal_code": "5000",
  "province": "Cordoba",
  "localities": [
    {
      "name": "Cordoba",
      "latitude": -31.42,
      "longitude": -64.18
    }
  ]
}
```

### Geocodificar direccion

```http
POST /addresses/geocode
Authorization: Bearer <access_token>
```

Body:

```json
{
  "postal_code": "5000",
  "province": "Cordoba",
  "locality": "Cordoba",
  "street_name": "Av Siempre Viva",
  "street_number": "123"
}
```

Response:

```json
{
  "latitude": -31.42,
  "longitude": -64.18,
  "display_name": "Av Siempre Viva 123, Cordoba"
}
```

### Reverse geocode

```http
POST /addresses/reverse-geocode
Authorization: Bearer <access_token>
```

Body:

```json
{
  "latitude": -31.42,
  "longitude": -64.18
}
```

Response:

```json
{
  "street_name": "Av Siempre Viva",
  "street_number": "123",
  "display_name": "Av Siempre Viva 123, Cordoba"
}
```

## Carrito

Todos requieren token.

### Obtener carrito

```http
GET /cart
Authorization: Bearer <access_token>
```

Response:

```json
{
  "id": 1,
  "store_id": 1,
  "store_name": "Demo Store",
  "store_slug": "demo-store",
  "delivery_mode": "delivery",
  "delivery_settings": {
    "delivery_enabled": true,
    "pickup_enabled": true,
    "delivery_fee": 500,
    "free_delivery_min_order": null,
    "rider_fee": 400,
    "min_order": 0
  },
  "subtotal": 12000,
  "delivery_fee": 500,
  "service_fee": 100,
  "total": 12600,
  "commercial_discount_total": 0,
  "financial_discount_total": 0,
  "pricing": {
    "subtotal": 12000,
    "commercial_discount_total": 0,
    "financial_discount_total": 0,
    "delivery_fee": 500,
    "service_fee": 100,
    "total": 12600
  },
  "items": [
    {
      "id": 1,
      "product_id": 10,
      "product_name": "Pizza muzzarella",
      "base_unit_price": 6000,
      "unit_price": 6000,
      "commercial_discount_amount": 0,
      "quantity": 2,
      "note": null
    }
  ],
  "applied_promotions": []
}
```

### Cambiar modalidad

```http
PUT /cart
Authorization: Bearer <access_token>
```

Body:

```json
{
  "delivery_mode": "delivery"
}
```

`delivery_mode` acepta `delivery` o `pickup`.

### Agregar item

```http
POST /cart/items
Authorization: Bearer <access_token>
```

Body:

```json
{
  "store_id": 1,
  "product_id": 10,
  "quantity": 2,
  "note": "Sin cebolla"
}
```

### Actualizar item

```http
PUT /cart/items/{item_id}
Authorization: Bearer <access_token>
```

Body:

```json
{
  "quantity": 3,
  "note": "Sin cebolla"
}
```

Si `quantity` es `0` o menor, el item se elimina.

### Eliminar item

```http
DELETE /cart/items/{item_id}
Authorization: Bearer <access_token>
```

### Vaciar carrito

```http
DELETE /cart
Authorization: Bearer <access_token>
```

## Checkout

Requiere token.

```http
POST /checkout
Authorization: Bearer <access_token>
```

Body:

```json
{
  "store_id": 1,
  "address_id": 3,
  "delivery_mode": "delivery",
  "payment_method": "cash",
  "idempotency_key": "uuid-unico-del-checkout"
}
```

Campos:

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `store_id` | number | Debe coincidir con el comercio del carrito |
| `address_id` | number o null | Requerido si `delivery_mode` es `delivery` |
| `delivery_mode` | `delivery` o `pickup` | Debe estar habilitado por el comercio |
| `payment_method` | `cash` o `mercadopago` | Debe estar habilitado por el comercio |
| `idempotency_key` | string o null | Recomendado para evitar checkouts duplicados |

Response:

```json
{
  "order_id": 123,
  "status": "created",
  "payment_status": "pending",
  "payment_reference": "mp_xxxxxxxxxx",
  "payment_transaction_id": 55,
  "provider_preference_id": "preference-id",
  "checkout_url": "https://..."
}
```

Notas:

- Si `payment_method` es `cash`, `checkout_url` normalmente sera `null`.
- Si `payment_method` es `mercadopago`, abrir `checkout_url` en WebView/browser segun corresponda.
- Para delivery, la direccion debe tener `latitude` y `longitude`.
- Despues del checkout exitoso, el backend vacia el carrito.

## Pedidos de cliente

Todos requieren token.

### Listar pedidos

```http
GET /orders
Authorization: Bearer <access_token>
```

### Obtener pedido

```http
GET /orders/{order_id}
Authorization: Bearer <access_token>
```

Response:

```json
{
  "id": 123,
  "store_id": 1,
  "store_name": "Demo Store",
  "store_slug": "demo-store",
  "customer_name": "Cliente Demo",
  "delivery_mode": "delivery",
  "payment_method": "cash",
  "payment_status": "pending",
  "payment_reference": null,
  "status": "created",
  "address_label": "Casa",
  "address_full": "Av Siempre Viva 123",
  "store_latitude": -31.41,
  "store_longitude": -64.19,
  "address_latitude": -31.42,
  "address_longitude": -64.18,
  "subtotal": 12000,
  "commercial_discount_total": 0,
  "financial_discount_total": 0,
  "delivery_fee": 500,
  "service_fee": 100,
  "delivery_fee_customer": 500,
  "rider_fee": 400,
  "total": 12600,
  "delivery_status": "unassigned",
  "delivery_provider": "platform",
  "delivery_zone_id": 1,
  "assigned_rider_id": null,
  "assigned_rider_name": null,
  "assigned_rider_phone_masked": null,
  "assigned_rider_vehicle_type": null,
  "tracking_last_latitude": null,
  "tracking_last_longitude": null,
  "tracking_last_at": null,
  "tracking_stale": false,
  "eta_minutes": null,
  "otp_required": false,
  "merchant_ready_at": null,
  "out_for_delivery_at": null,
  "delivered_at": null,
  "updated_at": null,
  "created_at": "2026-05-09T12:00:00",
  "items": [
    {
      "id": 1,
      "product_id": 10,
      "product_name": "Pizza muzzarella",
      "base_unit_price": 6000,
      "quantity": 2,
      "unit_price": 6000,
      "commercial_discount_amount": 0,
      "note": null
    }
  ],
  "pricing": {
    "subtotal": 12000,
    "commercial_discount_total": 0,
    "financial_discount_total": 0,
    "delivery_fee": 500,
    "service_fee": 100,
    "total": 12600
  },
  "applied_promotions": []
}
```

Estados posibles de pedido:

```txt
created
accepted
preparing
ready_for_dispatch
ready_for_pickup
out_for_delivery
delivered
cancelled
delivery_failed
```

### Tracking del pedido

```http
GET /orders/{order_id}/tracking
Authorization: Bearer <access_token>
```

Response:

```json
{
  "order_id": 123,
  "status": "out_for_delivery",
  "delivery_status": "delivering",
  "delivery_provider": "platform",
  "tracking_enabled": true,
  "assigned_rider_id": 9,
  "assigned_rider_name": "Repartidor",
  "assigned_rider_phone_masked": "***1234",
  "assigned_rider_vehicle_type": "motorcycle",
  "store_latitude": -31.41,
  "store_longitude": -64.19,
  "address_latitude": -31.42,
  "address_longitude": -64.18,
  "tracking_last_latitude": -31.415,
  "tracking_last_longitude": -64.185,
  "tracking_last_at": "2026-05-09T12:15:00",
  "tracking_stale": false,
  "eta_minutes": 8,
  "otp_required": true,
  "otp_code": "123456"
}
```

### Ruta y ETA con OpenRouteService

Requiere token. La app lo usa para dibujar ruta real y ETA sin exponer la API key en el APK.

```http
POST /routing/directions
Authorization: Bearer <access_token>
```

Body:

```json
{
  "profile": "driving-car",
  "coordinates": [
    {
      "latitude": -31.41,
      "longitude": -64.19
    },
    {
      "latitude": -31.42,
      "longitude": -64.18
    }
  ]
}
```

`profile` acepta:

```txt
driving-car
cycling-regular
foot-walking
```

Response:

```json
{
  "provider": "openrouteservice",
  "profile": "driving-car",
  "distance_meters": 1800,
  "duration_seconds": 420,
  "duration_minutes": 7,
  "geometry": [
    {
      "latitude": -31.41,
      "longitude": -64.19
    },
    {
      "latitude": -31.42,
      "longitude": -64.18
    }
  ]
}
```

Configuracion backend:

```env
OPENROUTESERVICE_API_KEY=tu_api_key
OPENROUTESERVICE_BASE_URL=https://api.openrouteservice.org
OPENROUTESERVICE_TIMEOUT_SECONDS=10
```

No configurar esta key en `android-app/.env.example` ni en variables `EXPO_PUBLIC_*`, porque quedaria expuesta dentro de la app.

### Pago del pedido

```http
GET /orders/{order_id}/payment
Authorization: Bearer <access_token>
```

### Pedido pendiente de review

```http
GET /orders/pending-review
Authorization: Bearer <access_token>
```

Solo devuelve pedidos entregados con review pendiente cuando ya pasaron 10 minutos desde `delivered_at`.

Response si hay review pendiente:

```json
{
  "order_id": 123,
  "store_name": "Demo Store",
  "delivered_at": "2026-05-09T12:45:00",
  "rider_name": "Repartidor",
  "requires_rider_rating": true
}
```

Response si no hay pendiente:

```json
null
```

### Crear review

```http
POST /orders/{order_id}/review
Authorization: Bearer <access_token>
```

Body:

```json
{
  "store_rating": 5,
  "rider_rating": 5,
  "review_text": "Pedido: Muy rico\nRepartidor: Muy buen servicio"
}
```

Response: `204 No Content`.

Notas:

- `store_rating` y `rider_rating` aceptan valores de 1 a 5.
- `rider_rating` es requerido si el pedido tuvo repartidor asignado.
- El backend rechaza la review antes de los 10 minutos posteriores a la entrega.

## Notificaciones

Todos requieren token.

### Listar notificaciones

```http
GET /notifications
Authorization: Bearer <access_token>
```

Response:

```json
[
  {
    "id": 1,
    "order_id": 123,
    "channel": "in_app",
    "event_type": "order.created",
    "title": "Pedido creado",
    "body": "Tu pedido fue creado",
    "payload_json": null,
    "is_read": false,
    "push_status": "pending",
    "created_at": "2026-05-09T12:00:00"
  }
]
```

### Marcar como leida

```http
PUT /notifications/{notification_id}/read
Authorization: Bearer <access_token>
```

### Marcar todas como leidas

```http
PUT /notifications/read-all
Authorization: Bearer <access_token>
```

Response: lista de notificaciones actualizadas.

### Registrar push subscription

```http
POST /notifications/push-subscriptions
Authorization: Bearer <access_token>
```

Body:

```json
{
  "endpoint": "https://push-service/subscription",
  "keys": {
    "p256dh": "key",
    "auth": "auth"
  },
  "user_agent": "mobile-app"
}
```

Para Android nativo con Expo Push, registrar tambien el token remoto:

```json
{
  "push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "push_provider": "expo",
  "platform": "android",
  "user_agent": "kepedimos-android"
}
```

Nota para app nativa Android: la app pide permiso `POST_NOTIFICATIONS`. Para recibir notificaciones con la app cerrada completamente hace falta envio push remoto desde backend mediante Expo Push y registrar el token nativo del dispositivo.

## WebSockets

El token se envia por query string.

Base:

```txt
wss://kepedimos.com/api/v1
```

En desarrollo local sin TLS, usar `ws://<host>:8016/api/v1`.

### Notificaciones del usuario

```txt
/ws/notifications/me?token=<access_token>
```

Mensaje inicial:

```json
{
  "type": "notifications.snapshot",
  "role": "customer",
  "notifications": []
}
```

### Tracking de pedido

```txt
/ws/orders/{order_id}?token=<access_token>
```

Mensaje inicial:

```json
{
  "type": "order.snapshot",
  "order": {},
  "tracking": {}
}
```

### Catalogo publico en vivo

No requiere token. La app debe conectarse para refrescar comercios cuando cambien estado, horario o disponibilidad.

```txt
/ws/catalog/stores
```

Mensaje inicial:

```json
{
  "type": "catalog.connected"
}
```

Mensaje de cambio:

```json
{
  "type": "catalog.stores.changed",
  "store_id": 1,
  "store_slug": "demo-store",
  "status": "approved",
  "accepting_orders": true
}
```

Al recibir este evento, refrescar `GET /catalog/stores` y, si esta abierta la pantalla del comercio, `GET /catalog/stores/{slug}`. Usar polling como fallback si el WebSocket no esta disponible.

### Repartidor

```txt
/ws/delivery/me?token=<access_token>
```

Mensaje inicial:

```json
{
  "type": "delivery.snapshot",
  "notifications": []
}
```

### Comercio

```txt
/ws/merchant/me?token=<access_token>
```

Mensaje inicial:

```json
{
  "type": "merchant.connected",
  "notifications": []
}
```

Codigos de cierre usados por el backend:

| Codigo | Significado |
| --- | --- |
| `4401` | Token invalido o rol incorrecto |
| `4404` | Pedido inexistente o sin acceso |

## App repartidor

Endpoints para usuarios con rol `delivery`.

### Perfil

```http
GET /delivery/me
Authorization: Bearer <access_token>
```

Response:

```json
{
  "user_id": 9,
  "store_id": null,
  "store_name": null,
  "full_name": "Repartidor",
  "email": "rider@example.com",
  "phone": "3510000000",
  "vehicle_type": "motorcycle",
  "photo_url": null,
  "dni_number": "12345678",
  "emergency_contact_name": "Contacto",
  "emergency_contact_phone": "3511111111",
  "license_number": null,
  "vehicle_plate": null,
  "insurance_policy": null,
  "notes": null,
  "availability": "idle",
  "is_active": true,
  "current_zone_id": 1,
  "current_latitude": -31.42,
  "current_longitude": -64.18,
  "last_location_at": "2026-05-09T12:00:00",
  "completed_deliveries": 10,
  "rating": 4.9,
  "push_enabled": true
}
```

### Cambiar disponibilidad

```http
PUT /delivery/me/availability
Authorization: Bearer <access_token>
```

Body:

```json
{
  "availability": "idle",
  "zone_id": 1
}
```

Disponibilidades:

```txt
offline
idle
reserved
delivering
paused
```

### Listar pedidos asignados/disponibles

```http
GET /delivery/me/orders
Authorization: Bearer <access_token>
```

Response: lista de `OrderRead`.

### Aceptar pedido

```http
POST /delivery/me/orders/{order_id}/accept
Authorization: Bearer <access_token>
```

### Retirar pedido

```http
POST /delivery/me/orders/{order_id}/pickup
Authorization: Bearer <access_token>
```

### Entregar pedido

```http
POST /delivery/me/orders/{order_id}/deliver
Authorization: Bearer <access_token>
```

Body:

```json
{
  "otp_code": "123456"
}
```

Si el pedido no requiere OTP, enviar `null` o no enviar el campo.

### Actualizar ubicacion

```http
POST /delivery/me/location
Authorization: Bearer <access_token>
```

Body:

```json
{
  "order_id": 123,
  "latitude": -31.42,
  "longitude": -64.18,
  "heading": 120,
  "speed_kmh": 35,
  "accuracy_meters": 10
}
```

Response: `OrderRead`.

### Notificaciones de repartidor

```http
GET /delivery/me/notifications
Authorization: Bearer <access_token>
```

### Liquidaciones de repartidor

```http
GET /delivery/me/settlements
Authorization: Bearer <access_token>
```

```http
GET /delivery/me/settlement-payments
Authorization: Bearer <access_token>
```

```http
POST /delivery/me/settlement-payments/{payment_id}/confirm
Authorization: Bearer <access_token>
```

```http
POST /delivery/me/settlement-payments/{payment_id}/dispute
Authorization: Bearer <access_token>
```

Body para confirmar/disputar:

```json
{
  "notes": "Recibido correctamente"
}
```

## Solicitudes de comercio y repartidor

### Registrar comercio y usuario merchant

No requiere token.

```http
POST /merchant-applications/register
```

Body:

```json
{
  "full_name": "Comerciante",
  "email": "merchant@example.com",
  "password": "password",
  "business_name": "Mi Comercio",
  "description": "Descripcion",
  "address": "Av Siempre Viva 123",
  "phone": "3510000000",
  "requested_category_ids": [1]
}
```

Response: igual a login.

### Crear solicitud de comercio autenticada

Requiere token.

```http
POST /merchant-applications
Authorization: Bearer <access_token>
```

Body:

```json
{
  "business_name": "Mi Comercio",
  "description": "Descripcion",
  "address": "Av Siempre Viva 123",
  "phone": "3510000000",
  "logo_url": null,
  "cover_image_url": null,
  "requested_category_ids": [1]
}
```

### Listar solicitudes propias de comercio

```http
GET /merchant-applications
Authorization: Bearer <access_token>
```

### Crear solicitud de repartidor

Requiere token.

```http
POST /delivery-applications
Authorization: Bearer <access_token>
```

Body:

```json
{
  "phone": "3510000000",
  "vehicle_type": "motorcycle",
  "photo_url": null,
  "dni_number": "12345678",
  "emergency_contact_name": "Contacto",
  "emergency_contact_phone": "3511111111",
  "license_number": null,
  "vehicle_plate": null,
  "insurance_policy": null,
  "notes": null
}
```

`vehicle_type` acepta:

```txt
bicycle
motorcycle
car
```

### Listar solicitudes propias de repartidor

```http
GET /delivery-applications
Authorization: Bearer <access_token>
```

## Uploads

### Subir imagen

No requiere token.

```http
POST /media/images
Content-Type: multipart/form-data
```

Form field:

```txt
file
```

Response:

```json
{
  "url": "/media/images/file.png",
  "path": "images/file.png",
  "content_type": "image/png",
  "size": 12345,
  "original_name": "file.png"
}
```

### Subir comprobante

Requiere token.

```http
POST /media/proofs
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

Form field:

```txt
file
```

Response: igual a upload de imagen.

## Pagos

### Webhook MercadoPago

Este endpoint es para integracion backend/proveedor, no deberia llamarlo la app movil.

```http
POST /payments/mercadopago/webhook
```

## Recomendaciones para la app movil

1. Guardar `access_token` en almacenamiento seguro del dispositivo.
2. Enviar `Authorization: Bearer <token>` en todos los endpoints protegidos.
3. Usar un `idempotency_key` unico por intento de checkout.
4. Refrescar el carrito despues de cada alta, baja o cambio de cantidad.
5. Usar WebSocket de pedido para tracking en vivo y fallback con `GET /orders/{id}/tracking`.
6. Resolver URLs de media relativas (`/media/...`) contra el host del backend, no contra `/api/v1`.
7. Manejar `401` cerrando sesion local o pidiendo login nuevamente.
8. Manejar `409` mostrando mensajes de estado, por ejemplo comercio cerrado, producto no disponible o carrito de otro comercio.
