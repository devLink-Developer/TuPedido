from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

ALLOWED_PROOF_TYPES = {
    **ALLOWED_IMAGE_TYPES,
    "application/pdf": ".pdf",
}


def get_media_root() -> Path:
    media_root = Path(settings.media_root)
    if not media_root.is_absolute():
        media_root = Path(__file__).resolve().parents[2] / media_root
    media_root.mkdir(parents=True, exist_ok=True)
    return media_root


def _safe_folder(folder: str) -> str:
    cleaned = "-".join(part for part in folder.replace("\\", "/").split("/") if part.strip())
    return cleaned or "general"


async def _save_uploaded_asset(
    file: UploadFile,
    *,
    folder: str,
    allowed_types: dict[str, str],
    kind_label: str,
) -> dict[str, object]:
    content_type = (file.content_type or "").lower()
    if content_type not in allowed_types:
        allowed_labels = ", ".join(sorted(extension.lstrip(".").upper() for extension in set(allowed_types.values())))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported {kind_label} type. Use {allowed_labels}.",
        )

    content = await file.read()
    max_size_bytes = settings.media_max_upload_mb * 1024 * 1024
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{kind_label.capitalize()} file is empty")
    if len(content) > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"{kind_label.capitalize()} exceeds the {settings.media_max_upload_mb} MB limit",
        )

    extension = allowed_types[content_type]
    folder_name = _safe_folder(folder)
    target_dir = get_media_root() / folder_name
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4().hex}{extension}"
    target_path = target_dir / filename
    target_path.write_bytes(content)

    relative_url = f"/media/{folder_name}/{filename}"
    return {
        "url": relative_url,
        "path": relative_url,
        "content_type": content_type,
        "size": len(content),
        "original_name": file.filename or filename,
    }


async def save_uploaded_image(file: UploadFile, *, folder: str) -> dict[str, object]:
    return await _save_uploaded_asset(
        file,
        folder=folder,
        allowed_types=ALLOWED_IMAGE_TYPES,
        kind_label="image",
    )


async def save_uploaded_proof(file: UploadFile, *, folder: str) -> dict[str, object]:
    return await _save_uploaded_asset(
        file,
        folder=folder,
        allowed_types=ALLOWED_PROOF_TYPES,
        kind_label="proof",
    )
