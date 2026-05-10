# KePedimos Android

Aplicacion Android nativa separada de la PWA existente. Usa Expo/React Native y consume el backend de KePedimos por defecto en:

```txt
http://200.58.107.187:8016/api/v1
```

## Comandos

```bash
npm install
npm run android
npm run typecheck
npm test
```

`npm run android` usa el proyecto nativo generado en `android/`; requiere JDK (`JAVA_HOME`) y Android SDK/Android Studio configurados.

## Configuracion

La URL puede cambiarse por build con:

```bash
EXPO_PUBLIC_API_BASE_URL=http://host:8016/api/v1
EXPO_PUBLIC_BACKEND_ROOT_URL=http://host:8016
```

Android permite HTTP solo para `200.58.107.187` mediante `plugins/withAndroidNetworkSecurity.js`. Para produccion conviene publicar el backend con HTTPS y quitar la excepcion cleartext.

La API key de OpenRouteService va en el `.env` del backend, no en Android:

```bash
OPENROUTESERVICE_API_KEY=tu_api_key
```

La app consume `/api/v1/routing/directions` con token para ruta y ETA.

## Alcance v1

- Roles `customer` y `delivery`.
- Sesion segura con `expo-secure-store`.
- Catalogo, carrito, checkout, pedidos, tracking, reviews y notificaciones.
- Repartidor con disponibilidad, estados de pedido, liquidaciones y tracking background.
- MercadoPago en WebView interno usando `checkout_url`.
