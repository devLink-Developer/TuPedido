# HTML to DB mapping

Este documento usa exactamente los HTML existentes en la raiz del proyecto como fuente de verdad para derivar el modelo de datos.

## Reglas de diseno

- Solo se toman como campos inferibles los datos visibles en los HTML.
- Cuando un HTML esta vacio o duplicado, se documenta la limitacion en lugar de inventar campos.
- Algunos campos operativos se agregan como soporte tecnico porque el propio copy de las pantallas los exige, por ejemplo horarios, estado del restaurante o acceso de staff.

## Inventario exacto de HTML

### index.html

Campos inferibles:
- current delivery address
- notifications counter or user notification feed trigger
- search query
- promotions: title, subtitle, CTA label, background image
- top level categories: name, icon, slug
- restaurant preview cards: name, cuisine tags, rating, promo tag, delivery time, cover image

Entidades afectadas:
- user_addresses
- promotions
- categories
- restaurants
- restaurant_categories
- notifications

### restaurants.html

Campos inferibles:
- selected delivery address
- quick filters: fast delivery, best rated, lower cost, custom filters
- restaurant card: id, name, image, is_open, is_popular, rating, categories[], delivery_time, delivery_fee
- favorite action on restaurant

Entidades afectadas:
- user_addresses
- restaurants
- restaurant_categories
- user_favorite_restaurants
- search_queries or saved_filters optional

### restaurants_menu.html

Campos inferibles:
- restaurant header: id, logo, name, cuisine summary, rating, rating_count, delivery time range, delivery fee
- menu tabs: promociones, hamburguesas, acompanamientos, bebidas
- product card: id, name, description, current_price, original_price optional, image
- add to cart action

Entidades afectadas:
- restaurants
- restaurant_menu_categories
- products
- cart_items

### cart.html

Campos inferibles:
- order item: product_id, product_name, unit_price, quantity, image
- selected delivery address: main, details
- payment method selection: card or cash
- summary: subtotal, delivery_fee, service_fee, total
- order timestamp

Entidades afectadas:
- carts
- cart_items
- user_addresses
- user_payment_methods
- orders
- order_items

### checkout.html

Campos inferibles:
- delivery address label and full address text
- delivery estimate min and max time
- express badge
- order summary item: product_name, unit_price, quantity, free text customizations
- payment method card brand and masked last4
- totals: subtotal, delivery_fee, service_fee, total

Entidades afectadas:
- orders
- order_items
- order_item_customizations or order_items.special_instructions
- user_addresses
- user_payment_methods

### address_management.html

Campos inferibles:
- address label: Home, Work, Partner's House
- full formatted address
- is_default
- icon or address type
- add, edit, delete address actions

Entidades afectadas:
- user_addresses

### products_management.html

Campos inferibles:
- restaurant logo image
- restaurant name
- cuisine category id
- full address
- file upload metadata constraints

Entidades afectadas:
- restaurants
- categories
- restaurant_media

### restaurant_management.html

Estado actual:
- archivo vacio

Impacto en DB:
- no agrega campos inferibles nuevos
- se asume que a futuro reutilizara restaurants, products, restaurant_hours y restaurant_staff

### login.html

Estado actual:
- no contiene campos de autenticacion reutilizables
- hoy duplica visualmente el formulario de alta de restaurante

Impacto en DB:
- no se pueden inferir email, password, session o recovery desde este HTML
- users y auth quedan como supuestos tecnicos del producto, no como campos derivados del template actual

### add_user.html

Estado actual:
- archivo vacio

Impacto en DB:
- no agrega campos inferibles nuevos
- users queda como entidad necesaria por arquitectura, pero no por campos presentes en este HTML

## Tablas objetivo derivadas

### Core catalog
- categories
- restaurants
- restaurant_categories
- restaurant_menu_categories
- products
- restaurant_media
- restaurant_hours
- promotions

### User and profile
- users
- user_addresses
- user_payment_methods
- user_favorite_restaurants
- notifications

### Order flow
- carts
- cart_items
- orders
- order_items
- order_item_customizations

## Campos que SI salen de los HTML

### restaurants
- id
- name
- slug
- logo_url
- cover_image_url
- short_description
- rating
- rating_count
- is_open
- is_popular
- min_delivery_minutes
- max_delivery_minutes
- delivery_fee
- full_address
- opening_note

### categories
- id
- name
- icon_name
- slug
- type: top_level or cuisine

### products
- id
- restaurant_id
- menu_category_id
- name
- description
- current_price
- original_price optional
- image_url
- is_available

### user_addresses
- id
- user_id
- label
- address_type
- street_line
- address_details
- city
- state
- postal_code
- country
- is_default
- latitude optional
- longitude optional

### user_payment_methods
- id
- user_id
- method_type
- card_brand optional
- masked_last4 optional
- cardholder_name optional
- is_default
- is_active

### orders
- id
- user_id optional while auth templates are incomplete
- restaurant_id
- address_id optional plus address snapshot text
- payment_method_id optional plus payment snapshot text
- delivery_mode
- eta_min
- eta_max
- subtotal
- delivery_fee
- service_fee
- total
- status
- created_at

### order_items
- id
- order_id
- product_id optional snapshot safe
- product_name_snapshot
- unit_price_snapshot
- quantity
- notes or customization_summary optional

## Supuestos tecnicos que NO salen directamente de los HTML

Estos campos son necesarios para que la aplicacion funcione, pero no vienen definidos por los templates actuales:
- users.email
- users.password_hash
- users.role
- auth sessions or tokens
- restaurant staff assignments
- audit timestamps and soft delete flags

## Resultado

La DB objetivo debe ser una base de catalogo + perfil + checkout, donde la mayor parte del dominio real sale de:
- listado de restaurantes
- detalle/menu del restaurante
- carrito
- checkout
- gestion de direcciones
- alta de restaurante

Los HTML vacios o duplicados se tomaron en cuenta explicitamente y no se usaron para inventar columnas.
