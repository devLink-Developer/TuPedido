from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

connect_args = {
    "connect_timeout": settings.database_connect_timeout_seconds,
    "application_name": settings.app_name,
}
if settings.database_url.startswith("postgresql"):
    postgres_options = [
        f"-c statement_timeout={settings.database_statement_timeout_ms}",
        f"-c lock_timeout={settings.database_lock_timeout_ms}",
        f"-c idle_in_transaction_session_timeout={settings.database_idle_in_transaction_session_timeout_ms}",
    ]
    connect_args["options"] = " ".join(postgres_options)

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=settings.database_pool_size,
    max_overflow=settings.database_max_overflow,
    pool_timeout=settings.database_pool_timeout_seconds,
    pool_recycle=settings.database_pool_recycle_seconds,
    pool_use_lifo=settings.database_pool_use_lifo,
    connect_args=connect_args,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
