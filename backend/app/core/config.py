from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Kepedimos API"
    app_env: str = "development"
    api_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://postgres:postgres@db:5432/tupedido"
    cors_origins: list[str] = [
        "http://localhost:8015",
        "http://127.0.0.1:8015",
        "http://200.58.107.187",
        "https://200.58.107.187",
        "http://200.58.107.187:8015",
        "https://200.58.107.187:8015",
    ]
    frontend_base_url: str = "http://localhost:8015"
    backend_base_url: str = "http://localhost:8016"
    jwt_secret: str = "kepedimos-dev-secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    seed_demo_data: bool = True
    bootstrap_admin_enabled: bool = True
    bootstrap_admin_full_name: str = "Admin Kepedimos"
    bootstrap_admin_email: str = "admin@kepedimos.com"
    bootstrap_admin_password: str = "admin1234"
    bootstrap_admin_address_label: str = "HQ"
    bootstrap_admin_address_street: str = "Av. Corrientes 1000"
    bootstrap_admin_address_details: str = "Piso 10, CABA"
    mercadopago_simulated: bool = True
    mercadopago_api_base_url: str = "https://api.mercadopago.com"
    mercadopago_auth_base_url: str = "https://auth.mercadopago.com.ar"
    mercadopago_timeout_seconds: float = 15.0
    mercadopago_client_id: str | None = None
    mercadopago_client_secret: str | None = None
    mercadopago_webhook_secret: str | None = None
    mercadopago_webhook_signature_tolerance_seconds: int = 300
    mercadopago_redirect_uri: str | None = None
    osrm_base_url: str = "https://router.project-osrm.org"
    map_style_url: str = "https://demotiles.maplibre.org/style.json"
    address_lookup_base_url: str = "https://api.zippopotam.us"
    geocoding_base_url: str = "https://nominatim.openstreetmap.org"
    geocoding_user_agent: str = "Kepedimos/0.1 (+https://kepedimos.local)"
    address_lookup_timeout_seconds: float = 10.0
    redis_url: str = "redis://redis:6379/0"
    delivery_offer_timeout_seconds: int = 20
    delivery_tracking_stale_seconds: int = 30
    delivery_embedded_worker: bool = True
    media_root: str = "media"
    media_max_upload_mb: int = 5
    web_push_vapid_public_key: str | None = None
    web_push_vapid_private_key: str | None = None
    web_push_vapid_subject: str = "mailto:admin@kepedimos.com"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
