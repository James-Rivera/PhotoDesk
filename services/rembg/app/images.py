from __future__ import annotations

import io

from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
READ_CHUNK_BYTES = 1024 * 1024


async def read_validated_image(upload: UploadFile, max_bytes: int, max_pixels: int) -> bytes:
    if upload.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Use a JPG, PNG, or WebP image")

    chunks: list[bytes] = []
    total = 0
    while chunk := await upload.read(READ_CHUNK_BYTES):
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "The image is larger than the upload limit")
        chunks.append(chunk)
    data = b"".join(chunks)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The uploaded image is empty")

    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in {"JPEG", "PNG", "WEBP"}:
                raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Use a JPG, PNG, or WebP image")
            width, height = image.size
            if width <= 0 or height <= 0 or width * height > max_pixels:
                raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "The decoded image is too large")
            image.verify()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The uploaded file is not a valid image") from error
    return data
