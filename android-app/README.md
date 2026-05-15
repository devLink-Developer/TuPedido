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
npm run build:android:release
```

`npm run android` usa el proyecto nativo generado en `android/`; requiere JDK (`JAVA_HOME`) y Android SDK/Android Studio configurados.

`npm run build:android:release` genera el App Bundle para Play (`.aab`) y exige upload key configurada con:

```properties
android/keystores/release-signing.properties
```

En PowerShell, una primera configuracion local tipica es:

```powershell
cd android-app
New-Item -ItemType Directory -Force .\android\keystores | Out-Null

# Usar la misma password para el keystore y la key.
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v `
  -keystore .\android\keystores\kepedimos-upload.jks `
  -storetype JKS `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -alias kepedimos-upload

npm run build:android:release
```

Completar `android/keystores/release-signing.properties` con las passwords usadas al crear el keystore. La build tambien acepta las mismas claves como variables de entorno o propiedades Gradle:

```properties
KEPEDIMOS_UPLOAD_STORE_FILE=keystores/kepedimos-upload.jks
KEPEDIMOS_UPLOAD_STORE_PASSWORD=...
KEPEDIMOS_UPLOAD_KEY_ALIAS=kepedimos-upload
KEPEDIMOS_UPLOAD_KEY_PASSWORD=...
```

El archivo `.jks` y sus passwords son secretos: guardarlos fuera de git y hacer backup. Para Play Store se debe subir el `.aab`; el APK standalone es solo para distribucion fuera de Play.

No publicar en Play los APK standalone ni builds firmados con debug keystore.

## Configuracion

La app apunta siempre al backend publico `https://kepedimos.com/api/v1`. La configuracion Android mantiene `android:usesCleartextTraffic="false"` y no incluye excepciones HTTP.

La API key de OpenRouteService va en el `.env` del backend, no en Android:

```bash
OPENROUTESERVICE_API_KEY=tu_api_key
```

La app consume `/api/v1/routing/directions` con token para ruta y ETA.

## Google Play

- Politica de privacidad publica: `https://kepedimos.com/legal/privacy.html`.
- Terminos y condiciones publicos: `https://kepedimos.com/legal/terms.html`.
- Eliminacion de cuenta publica: `https://kepedimos.com/legal/account-deletion.html`.
- La app incluye eliminacion de cuenta desde Perfil y disclosure antes del permiso de ubicacion en segundo plano para repartidores.
- La build bloquea permisos Android no usados por la app nativa: almacenamiento externo, overlay y biometric/fingerprint.
- Checklist de consola y datos: `../docs/google-play-compliance.md`.

## Alcance v1

- Roles `customer` y `delivery`.
- Sesion segura con `expo-secure-store`.
- Catalogo, carrito, checkout, pedidos, tracking, reviews y notificaciones.
- Repartidor con disponibilidad, estados de pedido, liquidaciones y tracking background.
- MercadoPago en WebView interno usando `checkout_url`.
