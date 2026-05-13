# Google Play compliance checklist

Estado del repo para publicar KePedimos Android.

## URLs publicas

- Politica de privacidad: `https://kepedimos.com/legal/privacy.html`
- Eliminacion de cuenta: `https://kepedimos.com/legal/account-deletion.html`
- Backend/API: `https://kepedimos.com/api/v1`

Estas paginas salen de `frontend/public/legal/` y requieren rebuild/deploy del frontend para estar publicas.

## User Data / Data Safety

Declarar en Play Console los datos que realmente se recopilan:

- Informacion personal: nombre, email, telefono cuando corresponda.
- Direccion: direcciones de entrega, referencias, localidad/provincia/codigo postal y coordenadas del pin.
- Ubicacion aproximada y precisa: clientes para cobertura/direccion; repartidores para tracking de entrega.
- Actividad de la app: pedidos, carrito, comercios, reviews, notificaciones y estados operativos.
- Fotos/archivos: no declararlos para Android v1 salvo que se habilite carga de archivos en la app nativa. La PWA/backend soportan imagenes o comprobantes, pero la build Android actual no incluye picker/subida de archivos.
- Informacion financiera/pagos: estado de pago, referencia de operacion y datos necesarios para Mercado Pago. No declarar datos de tarjeta como recopilados por la app si solo los procesa Mercado Pago en su flujo seguro.
- IDs de dispositivo u otros identificadores: token push Expo/dispositivo.

Marcar que los datos se transmiten cifrados en transito por HTTPS. Indicar que el usuario puede solicitar eliminacion de cuenta y datos desde la app y desde la URL publica.

Antes de marcar cifrado en transito como completo, verificar que:

- `https://kepedimos.com/api/v1` responde por HTTPS sin redirigir a `http://...`.
- Los WebViews de Android no permiten origen `http://*` ni mixed content.

## Eliminacion de cuenta

La app incluye boton `Eliminar cuenta` en:

- Perfil cliente.
- Perfil repartidor.
- Pantalla de rol no soportado.

El endpoint `DELETE /api/v1/auth/me` elimina o anonimiza datos personales, cierra el acceso dejando `is_active=false`, elimina direcciones, carrito, notificaciones y tokens push, y minimiza datos de pedidos/perfiles que deben conservarse por trazabilidad legal o contable.

## Background location

La app declara `ACCESS_BACKGROUND_LOCATION` porque el perfil de repartidor comparte ubicacion durante una entrega activa. Antes de pedir permisos de ubicacion para reparto, Android muestra un disclosure prominente con:

- El termino `location`.
- Uso en `background`.
- Frase `when the app is closed or not in use`.
- Features: seguimiento del reparto, estado del pedido y ETA.
- Aclaracion de que no se usa para publicidad.

Texto recomendado para la descripcion de Play Store:

```txt
KePedimos usa location en background para que repartidores compartan la ubicacion durante una entrega activa, incluso when the app is closed or not in use. Esto permite seguimiento del reparto, actualizacion de estado y ETA. La ubicacion no se usa para publicidad.
```

## Build para Play

Publicar Android con App Bundle firmado, no con APK standalone ni debug keystore.

Configurar upload key con variables de entorno o propiedades Gradle:

```txt
KEPEDIMOS_UPLOAD_STORE_FILE=/ruta/upload-keystore.jks
KEPEDIMOS_UPLOAD_STORE_PASSWORD=...
KEPEDIMOS_UPLOAD_KEY_ALIAS=...
KEPEDIMOS_UPLOAD_KEY_PASSWORD=...
```

Generar el AAB con:

```bash
cd android-app
npm run build:android:release
```

El script ejecuta `:app:validatePlayReleaseSigning` y `:app:bundleRelease`, y copia `KePedimos-<version>-release.aab`.

## Pendiente fuera del repo

- Completar Data Safety en Play Console con las categorias anteriores.
- Cargar las dos URLs publicas en Play Console.
- Completar la declaracion de background location y subir evidencia del disclosure dentro de la app.
- Completar la declaracion de foreground service type `location` y subir evidencia de seguimiento activo.
- Verificar tras deploy que `https://kepedimos.com/health`, `/api/v1`, `/legal/privacy.html` y `/legal/account-deletion.html` respondan con certificado TLS confiable.
