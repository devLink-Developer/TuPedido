import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import OperationalError

import app.models  # noqa: F401
from app.api.routes import router as api_router
from app.core.config import settings
from app.db.migrations import run_schema_migrations
from app.db.seed import ensure_default_admin, seed_initial_data
from app.services.delivery_jobs import run_delivery_maintenance_loop

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    maintenance_task = None
    for attempt in range(10):
        try:
            run_schema_migrations()
            break
        except OperationalError:
            if attempt == 9:
                raise
            await asyncio.sleep(2)

    ensure_default_admin()
    if settings.app_env == "development" and settings.seed_demo_data:
        replenished = seed_initial_data()
        logger.info("Demo seed completed at startup; replenished %s missing records.", replenished)
    else:
        logger.info(
            "Demo seed skipped at startup (app_env=%s, seed_demo_data=%s).",
            settings.app_env,
            settings.seed_demo_data,
        )
    if settings.delivery_embedded_worker:
        maintenance_task = asyncio.create_task(run_delivery_maintenance_loop())
    yield
    if maintenance_task is not None:
        maintenance_task.cancel()
        try:
            await maintenance_task
        except asyncio.CancelledError:
            pass

app = FastAPI(
    title="Kepedimos API",
    version="0.1.0",
    openapi_url=f"{settings.api_prefix}/openapi.json",
    lifespan=lifespan,
)

media_root = Path(settings.media_root)
if not media_root.is_absolute():
    media_root = Path(__file__).resolve().parents[1] / media_root
media_root.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(media_root)), name="media")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(api_router, prefix=settings.api_prefix)
