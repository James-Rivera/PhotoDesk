from __future__ import annotations

import os
from dataclasses import dataclass


def _required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def _positive_int(name: str, default: int) -> int:
    raw = os.getenv(name, str(default)).strip()
    try:
        value = int(raw)
    except ValueError as error:
        raise RuntimeError(f"{name} must be an integer") from error
    if value <= 0:
        raise RuntimeError(f"{name} must be positive")
    return value


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_publishable_key: str
    allowed_origins: tuple[str, ...]
    model_name: str
    max_upload_bytes: int
    max_image_pixels: int
    processing_timeout_seconds: int
    max_concurrent_jobs: int
    max_queued_jobs: int
    rate_limit_jobs: int
    global_rate_limit_jobs: int
    rate_limit_window_seconds: int

    @classmethod
    def from_environment(cls) -> "Settings":
        origins = tuple(
            origin.strip().rstrip("/")
            for origin in _required("ALLOWED_ORIGINS").split(",")
            if origin.strip()
        )
        if not origins or "*" in origins:
            raise RuntimeError("ALLOWED_ORIGINS must contain explicit origins")
        return cls(
            supabase_url=_required("SUPABASE_URL").rstrip("/"),
            supabase_publishable_key=_required("SUPABASE_PUBLISHABLE_KEY"),
            allowed_origins=origins,
            model_name=os.getenv("REMBG_MODEL", "isnet-general-use").strip() or "isnet-general-use",
            max_upload_bytes=_positive_int("MAX_UPLOAD_BYTES", 20 * 1024 * 1024),
            max_image_pixels=_positive_int("MAX_IMAGE_PIXELS", 40_000_000),
            processing_timeout_seconds=_positive_int("PROCESSING_TIMEOUT_SECONDS", 120),
            max_concurrent_jobs=_positive_int("MAX_CONCURRENT_JOBS", 1),
            max_queued_jobs=_positive_int("MAX_QUEUED_JOBS", 2),
            rate_limit_jobs=_positive_int("RATE_LIMIT_JOBS", 10),
            global_rate_limit_jobs=_positive_int("GLOBAL_RATE_LIMIT_JOBS", 30),
            rate_limit_window_seconds=_positive_int("RATE_LIMIT_WINDOW_SECONDS", 600),
        )
