-- Target PostgreSQL schema derived from the HTML templates in the project root.
-- This is a design schema, not yet a full migration script.

create table if not exists categories (
    id bigserial primary key,
    name varchar(120) not null,
    slug varchar(120) not null unique,
    icon_name varchar(120),
    category_type varchar(40) not null check (category_type in ('top_level', 'cuisine', 'menu')),
    created_at timestamptz not null default now()
);

create table if not exists promotions (
    id bigserial primary key,
    title varchar(160) not null,
    subtitle varchar(255),
    cta_label varchar(80),
    image_url text,
    is_active boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists users (
    id bigserial primary key,
    full_name varchar(180),
    email varchar(180) unique,
    password_hash varchar(255),
    role varchar(40) not null default 'customer',
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists user_addresses (
    id bigserial primary key,
    user_id bigint references users(id) on delete cascade,
    label varchar(80) not null,
    address_type varchar(40),
    street_line varchar(255) not null,
    address_details varchar(255),
    city varchar(120),
    state varchar(120),
    postal_code varchar(40),
    country varchar(120),
    latitude numeric(10, 7),
    longitude numeric(10, 7),
    is_default boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists user_payment_methods (
    id bigserial primary key,
    user_id bigint references users(id) on delete cascade,
    method_type varchar(40) not null check (method_type in ('card', 'cash')),
    card_brand varchar(80),
    masked_last4 varchar(8),
    cardholder_name varchar(180),
    is_default boolean not null default false,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists restaurants (
    id bigserial primary key,
    slug varchar(160) not null unique,
    name varchar(180) not null,
    short_description varchar(255),
    long_description text,
    logo_url text,
    cover_image_url text,
    rating numeric(3, 2) not null default 0,
    rating_count integer not null default 0,
    is_open boolean not null default true,
    is_popular boolean not null default false,
    min_delivery_minutes integer,
    max_delivery_minutes integer,
    delivery_fee numeric(10, 2) not null default 0,
    opening_note varchar(120),
    full_address varchar(255),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists restaurant_categories (
    restaurant_id bigint not null references restaurants(id) on delete cascade,
    category_id bigint not null references categories(id) on delete cascade,
    is_primary boolean not null default false,
    primary key (restaurant_id, category_id)
);

create table if not exists restaurant_media (
    id bigserial primary key,
    restaurant_id bigint not null references restaurants(id) on delete cascade,
    media_type varchar(40) not null check (media_type in ('logo', 'cover', 'gallery')),
    file_url text not null,
    alt_text varchar(255),
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists restaurant_hours (
    id bigserial primary key,
    restaurant_id bigint not null references restaurants(id) on delete cascade,
    day_of_week smallint not null check (day_of_week between 0 and 6),
    opens_at time,
    closes_at time,
    is_closed boolean not null default false
);

create table if not exists restaurant_menu_categories (
    id bigserial primary key,
    restaurant_id bigint not null references restaurants(id) on delete cascade,
    category_id bigint references categories(id) on delete set null,
    name varchar(120) not null,
    sort_order integer not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists products (
    id bigserial primary key,
    restaurant_id bigint not null references restaurants(id) on delete cascade,
    menu_category_id bigint references restaurant_menu_categories(id) on delete set null,
    sku varchar(80),
    name varchar(180) not null,
    description text,
    current_price numeric(10, 2) not null,
    original_price numeric(10, 2),
    image_url text,
    is_available boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists user_favorite_restaurants (
    user_id bigint not null references users(id) on delete cascade,
    restaurant_id bigint not null references restaurants(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, restaurant_id)
);

create table if not exists notifications (
    id bigserial primary key,
    user_id bigint references users(id) on delete cascade,
    title varchar(160) not null,
    body text,
    is_read boolean not null default false,
    created_at timestamptz not null default now()
);

create table if not exists carts (
    id bigserial primary key,
    user_id bigint references users(id) on delete cascade,
    restaurant_id bigint references restaurants(id) on delete set null,
    address_id bigint references user_addresses(id) on delete set null,
    payment_method_id bigint references user_payment_methods(id) on delete set null,
    subtotal numeric(10, 2) not null default 0,
    delivery_fee numeric(10, 2) not null default 0,
    service_fee numeric(10, 2) not null default 0,
    total numeric(10, 2) not null default 0,
    updated_at timestamptz not null default now()
);

create table if not exists cart_items (
    id bigserial primary key,
    cart_id bigint not null references carts(id) on delete cascade,
    product_id bigint references products(id) on delete set null,
    product_name_snapshot varchar(180) not null,
    unit_price_snapshot numeric(10, 2) not null,
    quantity integer not null check (quantity > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists orders (
    id bigserial primary key,
    user_id bigint references users(id) on delete set null,
    restaurant_id bigint references restaurants(id) on delete set null,
    address_id bigint references user_addresses(id) on delete set null,
    payment_method_id bigint references user_payment_methods(id) on delete set null,
    address_label_snapshot varchar(80),
    address_full_snapshot varchar(255),
    payment_label_snapshot varchar(120),
    delivery_mode varchar(40) default 'standard',
    eta_min integer,
    eta_max integer,
    subtotal numeric(10, 2) not null,
    delivery_fee numeric(10, 2) not null,
    service_fee numeric(10, 2) not null,
    total numeric(10, 2) not null,
    status varchar(40) not null default 'created',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists order_items (
    id bigserial primary key,
    order_id bigint not null references orders(id) on delete cascade,
    product_id bigint references products(id) on delete set null,
    product_name_snapshot varchar(180) not null,
    unit_price_snapshot numeric(10, 2) not null,
    quantity integer not null check (quantity > 0),
    customization_summary varchar(255),
    created_at timestamptz not null default now()
);

create index if not exists idx_restaurants_name on restaurants(name);
create index if not exists idx_products_restaurant_id on products(restaurant_id);
create index if not exists idx_user_addresses_user_id on user_addresses(user_id);
create index if not exists idx_orders_user_id on orders(user_id);
create index if not exists idx_orders_restaurant_id on orders(restaurant_id);
