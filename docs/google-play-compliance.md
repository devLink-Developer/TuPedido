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
- Fotos/archivos: imagenes, comprobantes o documentacion que el usuario suba.
- Informacion financiera/pagos: estado de pago, referencia de operacion y datos necesarios para Mercado Pago. No declarar datos de tarjeta como recopilados por la app si solo los procesa Mercado Pago en su flujo seguro.
- IDs de dispositivo u otros identificadores: token push Expo/dispositivo.

Marcar que los datos se transmiten cifrados en transito por HTTPS. Indicar que el usuario puede solicitar eliminacion de cuenta y datos desde la app y desde la URL publica.

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

## Pendiente fuera del repo

- Completar Data Safety en Play Console con las categorias anteriores.
- Cargar las dos URLs publicas en Play Console.
- Completar la declaracion de background location y subir evidencia del disclosure dentro de la app.
- Verificar que `https://kepedimos.com/health`, `/api/v1`, `/legal/privacy.html` y `/legal/account-deletion.html` respondan con certificado TLS confiable.
