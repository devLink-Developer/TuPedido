from __future__ import annotations

from fastapi import APIRouter, File, Form, Request, UploadFile, status

from app.services.media import save_uploaded_image

router = APIRouter()


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
        "url": str(request.base_url).rstrip("/") + relative_url,
    }
