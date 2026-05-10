# Notificaciones push Android

La app usa WebSocket/polling cuando está abierta. Para recibir cambios de estado con la app cerrada, Android necesita push remota.

## Configuración requerida

1. Crear/configurar el proyecto Expo/EAS.
2. Configurar credenciales FCM para Android en EAS o agregar la configuracion Firebase correspondiente.
3. Definir el project id al compilar:

```env
EXPO_PUBLIC_EXPO_PROJECT_ID=<eas-project-id>
```

Ejemplo de formato:

```env
EXPO_PUBLIC_EXPO_PROJECT_ID=f19296df-44bd-482a-90bb-2af254c6ac42
```

Ese valor es el UUID del proyecto en Expo/EAS. No es el package `com.kepedimos.android`, no es el slug y no es una API key.

Podés verlo con:

```bash
npx eas project:info
```

También aparece en Expo Dashboard, dentro de la configuración del proyecto. Puede ir en `android-app/.env` o como variable de entorno antes de compilar.

## Backend

El backend guarda el token en:

```http
POST /api/v1/notifications/push-subscriptions
```

El worker procesa notificaciones `queued` y las envía por Expo Push. Para que funcione en producción deben estar corriendo `backend` y `worker`.
