import os
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .core.config import settings
from .api import stream, recordings, telemetry, storage, faces, events, trackers, cameras, auth
from .services.camera_worker import camera_manager
from .services.audio_worker import audio_worker
from .core.database import init_db, list_configured_cameras

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB and workers
    init_db()
    loop = asyncio.get_running_loop()
    audio_worker.set_loop(loop)
    try:
        configured = list_configured_cameras()
        for cam in configured:
            camera_manager.get_worker(cam["id"], source=cam.get("source"))
    except Exception:
        pass
    audio_worker.start()
    yield
    # Shutdown
    with camera_manager.lock:
        for worker in list(camera_manager.workers.values()):
            worker.stop()
    audio_worker.stop()

app = FastAPI(
    title=settings.APP_NAME,
    description="Ultra-Low Latency 60 FPS CCTV Hub with Live Audio & Real Analytics",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication & Users"])
app.include_router(stream.router, prefix="/api/stream", tags=["Streaming"])
app.include_router(recordings.router, prefix="/api/recordings", tags=["Recordings & Snapshots"])
app.include_router(telemetry.router, prefix="/api/telemetry", tags=["Telemetry & Diagnostics"])
app.include_router(storage.router, prefix="/api/storage", tags=["Storage & Locations"])
app.include_router(faces.router, prefix="/api/faces", tags=["Face Recognition & Profiles"])
app.include_router(events.router, prefix="/api/events", tags=["Surveillance Events"])
app.include_router(trackers.router, prefix="/api/trackers", tags=["Custom Object & Zone Trackers"])
app.include_router(cameras.router, prefix="/api/cameras", tags=["Camera Management & Hardware"])

# Serve frontend build if exists
FRONTEND_PATHS = [
    settings.BASE_DIR.parent / "frontend" / "dist",
    settings.BASE_DIR / "frontend_dist",
    settings.BASE_DIR / "dist",
    Path("/app/frontend/dist"),
    Path("/app/dist")
]

mounted = False
for p in FRONTEND_PATHS:
    if p.exists() and (p / "index.html").exists():
        app.mount("/", StaticFiles(directory=str(p), html=True), name="frontend")
        mounted = True
        break

if not mounted:
    @app.get("/")
    def health_check():
        return {
            "status": "online",
            "app": settings.APP_NAME,
            "stream_engine": settings.GO2RTC_API_URL,
            "docs": "/docs"
        }
