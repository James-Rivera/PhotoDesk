from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from rembg import new_session, remove

from .config import Settings
from .images import read_validated_image
from .security import StaffAuthorizer, UserRateLimiter

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("cjnet.rembg")
settings = Settings.from_environment()
authorizer = StaffAuthorizer(settings)
user_rate_limiter = UserRateLimiter(settings.rate_limit_jobs, settings.rate_limit_window_seconds)
global_rate_limiter = UserRateLimiter(settings.global_rate_limit_jobs, settings.rate_limit_window_seconds)
job_slots = asyncio.Semaphore(settings.max_concurrent_jobs)


class AdmissionController:
    def __init__(self, capacity: int) -> None:
        self.capacity = capacity
        self.current = 0
        self.lock = asyncio.Lock()

    async def enter(self) -> None:
        async with self.lock:
            if self.current >= self.capacity:
                raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "The background-removal queue is full")
            self.current += 1

    async def leave(self) -> None:
        async with self.lock:
            self.current = max(0, self.current - 1)


admission = AdmissionController(settings.max_concurrent_jobs + settings.max_queued_jobs)


async def load_model(app: FastAPI) -> None:
    try:
        log.info("loading configured background-removal model")
        app.state.rembg_session = await asyncio.to_thread(new_session, settings.model_name)
        app.state.ready = True
        log.info("background-removal model ready")
    except Exception:
        app.state.load_failed = True
        log.exception("background-removal model failed to load")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.ready = False
    app.state.load_failed = False
    app.state.rembg_session = None
    load_task = asyncio.create_task(load_model(app))
    yield
    app.state.ready = False
    if not load_task.done():
        load_task.cancel()


app = FastAPI(
    title="CJNET PhotoDesk Background Removal",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)


@app.middleware("http")
async def authenticate_removal_before_upload(request: Request, call_next):
    if request.method != "OPTIONS" and request.url.path == "/v1/remove":
        try:
            user_id = await authorizer.require_active_staff(request.headers.get("Authorization"))
            user_rate_limiter.consume(user_id)
            global_rate_limiter.consume("all-staff")
        except HTTPException as error:
            return JSONResponse(
                status_code=error.status_code,
                content={"detail": error.detail},
                headers={"Cache-Control": "no-store"},
            )
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


def health_payload(request: Request) -> dict[str, object]:
    return {
        "status": "ready" if getattr(request.app.state, "ready", False) else "failed" if getattr(request.app.state, "load_failed", False) else "starting",
        "model": settings.model_name,
        "serviceVersion": app.version,
    }


@app.get("/health/live")
async def health_live(request: Request) -> dict[str, object]:
    return health_payload(request)


@app.get("/health/ready")
async def health_ready(request: Request) -> Response:
    payload = health_payload(request)
    return Response(
        content=json.dumps(payload),
        media_type="application/json",
        status_code=status.HTTP_200_OK if payload["status"] == "ready" else status.HTTP_503_SERVICE_UNAVAILABLE,
        headers={"Cache-Control": "no-store"},
    )


@app.get("/v1/health")
async def health_compatibility(request: Request) -> Response:
    return await health_ready(request)


@app.post("/v1/remove")
async def remove_background(
    request: Request,
    file: UploadFile = File(...),
) -> Response:
    data = await read_validated_image(file, settings.max_upload_bytes, settings.max_image_pixels)
    if not getattr(request.app.state, "ready", False):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "The background-removal model is starting")

    await admission.enter()
    try:
        async with job_slots:
            output = await asyncio.wait_for(
                asyncio.to_thread(remove, data, session=request.app.state.rembg_session),
                timeout=settings.processing_timeout_seconds,
            )
    except TimeoutError as error:
        raise HTTPException(status.HTTP_504_GATEWAY_TIMEOUT, "Background removal timed out") from error
    except Exception as error:
        log.exception("background removal failed for authenticated staff")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Background removal failed") from error
    finally:
        await admission.leave()

    return Response(
        content=output,
        media_type="image/png",
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "X-Background-Model": settings.model_name,
        },
    )
