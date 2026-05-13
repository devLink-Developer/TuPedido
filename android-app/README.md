# KePedimos Android

Aplicacion Android nativa separada de la PWA existente. Usa Expo/React Native y consume el backend de KePedimos por defecto en:

```txt
https://kepedimos.com/api/v1
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
EXPO_PUBLIC_API_BASE_URL=https://kepedimos.com/api/v1
EXPO_PUBLIC_BACKEND_ROOT_URL=https://kepedimos.com
```

Para desarrollo local o emulador se pueden sobreescribir estas variables, por ejemplo con `http://10.0.2.2:8016/api/v1`. La configuracion Android de produccion mantiene `android:usesCleartextTraffic="false"` y no incluye excepciones HTTP.

La API key de OpenRouteService va en el `.env` del backend, no en Android:

```bash
OPENROUTESERVICE_API_KEY=tu_api_key
```

La app consume `/api/v1/routing/directions` con token para ruta y ETA.

## Google Play

- Politica de privacidad publica: `https://kepedimos.com/legal/privacy.html`.
- Eliminacion de cuenta publica: `https://kepedimos.com/legal/account-deletion.html`.
- La app incluye eliminacion de cuenta desde Perfil y disclosure antes del permiso de ubicacion en segundo plano para repartidores.
- Checklist de consola y datos: `../docs/google-play-compliance.md`.

## Alcance v1

- Roles `customer` y `delivery`.
- Sesion segura con `expo-secure-store`.
- Catalogo, carrito, checkout, pedidos, tracking, reviews y notificaciones.
- Repartidor con disponibilidad, estados de pedido, liquidaciones y tracking background.
- MercadoPago en WebView interno usando `checkout_url`.
