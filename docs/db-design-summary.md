# DB design summary

Base propuesta: PostgreSQL normalizada, derivada de los HTML existentes.

## Fuente principal por modulo

- Discovery y home: index.html, restaurants.html
- Catalogo y menu: restaurants_menu.html
- Checkout: cart.html, checkout.html
- Perfil: address_management.html
- Admin restaurantes: products_management.html
- Archivos considerados pero sin campos utiles: add_user.html, restaurant_management.html
- Archivo inconsistente: login.html, hoy no aporta campos de auth

## Decisiones de modelado

- Las categorias se separan para cubrir top level, cuisine y menu tabs.
- Los restaurantes soportan multiples categorias porque el listado muestra varios tags por local.
- Los productos guardan precio actual y precio original porque el menu muestra descuentos tachados.
- Los pedidos y sus items guardan snapshots de texto y precio para no depender de cambios posteriores en catalogo.
- Los medios del restaurante se separan de la tabla principal para soportar logo y cover.
- Direcciones y medios de pago son del usuario, no del pedido; el pedido guarda snapshot adicional.

## Huecos detectados en los HTML

- No hay formulario real de login.
- No hay formulario real de alta de usuario.
- No hay pantalla real de gestion de restaurante; solo alta base.

Por eso users.email, password_hash y role deben considerarse requerimientos tecnicos del producto, no campos inferidos directamente de la base HTML.

## Artefactos entregados

- backend/schema.sql
- docs/html-to-db-mapping.md
