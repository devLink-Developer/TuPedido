from __future__ import annotations

from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile, status

from app.api.deps import get_current_user
from app.models.user import User
from app.services.media import save_uploaded_image, save_uploaded_proof

router = APIRouter()


def _public_base_url(request: Request) -> str:
    for candidate in (request.headers.get("origin"), request.headers.get("referer")):
        if not candidate:
            continue
        try:
            parsed = urlsplit(candidate)
        except ValueError:
            continue
        if parsed.scheme in {"http", "https"} and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
    return str(request.base_url).rstrip("/")


@router.post("/images", status_code=status.HTTP_201_CREATED)
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    folder: str = Form("general"),
) -> dict[str, object]:
    saved = await save_uploaded_image(file, folder=folder)
    relative_url = str(saved["url"])
    return {
        **saved,
        "url": _public_base_url(request) + relative_url,
    }


@router.post("/proofs", status_code=status.HTTP_201_CREATED)
async def upload_proof(
    request: Request,
    _: User = Depends(get_current_user),
    file: UploadFile = File(...),
    folder: str = Form("proofs"),
) -> dict[str, object]:
    saved = await save_uploaded_proof(file, folder=folder)
    relative_url = str(saved["url"])
    return {
        **saved,
        "url": _public_base_url(request) + relative_url,
    }
