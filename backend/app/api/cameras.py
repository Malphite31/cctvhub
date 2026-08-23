import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..core.database import (
    list_configured_cameras,
    get_configured_camera,
    add_configured_camera,
    update_configured_camera,
    delete_configured_camera
)
from ..services.camera_worker import camera_manager

router = APIRouter()

class CameraCreate(BaseModel):
    id: Optional[str] = None
    name: str
    source: Optional[str] = None
    resolution: Optional[str] = "1920x1080"
    fps: Optional[int] = 60
    zone: Optional[str] = "Main Area"

class CameraUpdate(BaseModel):
    name: Optional[str] = None
    source: Optional[str] = None
    resolution: Optional[str] = None
    fps: Optional[int] = None
    zone: Optional[str] = None

@router.get("/list")
def get_cameras():
    """List all configured cameras with live status."""
    cams = camera_manager.get_available_cameras()
    return {"cameras": cams, "devices": cams}

@router.post("/add")
def create_camera(payload: CameraCreate):
    """Add a new camera or RTSP stream."""
    existing = list_configured_cameras()
    cam_id = payload.id
    if not cam_id:
        # Generate next available index
        used_ids = [c["id"] for c in existing]
        idx = 0
        while str(idx) in used_ids:
            idx += 1
        cam_id = str(idx)

    source = payload.source if payload.source else cam_id
    cam = add_configured_camera(
        camera_id=cam_id,
        name=payload.name,
        source=source,
        resolution=payload.resolution or "1920x1080",
        fps=payload.fps or 60,
        zone=payload.zone or "Main Area"
    )
    # Start worker
    camera_manager.get_worker(cam_id, source=source)
    return {"status": "success", "camera": cam}

@router.get("/hardware")
def get_hardware_cameras():
    """Returns list of physically connected hardware camera devices without modifying database."""
    return {"devices": camera_manager.scan_hardware_devices()}

@router.post("/scan")
def scan_hardware():
    """Scan connected hardware devices and sync with database."""
    hardware = camera_manager.scan_hardware_devices()
    existing = {c["id"]: c for c in list_configured_cameras()}
    added = []

    for dev in hardware:
        dev_id = str(dev["device"])
        if dev_id not in existing:
            cam = add_configured_camera(
                camera_id=dev_id,
                name=dev["name"],
                source=dev_id,
                resolution=dev.get("resolution", "1920x1080"),
                fps=dev.get("fps", 60),
                zone=f"Camera Zone {dev_id}"
            )
            added.append(cam)

    return {"status": "scan_complete", "cameras": camera_manager.get_available_cameras(), "added": added}

@router.get("/{camera_id}")
def get_camera_info(camera_id: str):
    """Get single camera configuration."""
    cam = get_configured_camera(camera_id)
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")
    return {"camera": cam}

@router.put("/{camera_id}")
def edit_camera(camera_id: str, payload: CameraUpdate):
    """Edit camera name, stream source, resolution, FPS, or zone."""
    cam = update_configured_camera(
        camera_id=camera_id,
        name=payload.name,
        source=payload.source,
        resolution=payload.resolution,
        fps=payload.fps,
        zone=payload.zone
    )
    if not cam:
        raise HTTPException(status_code=404, detail="Camera not found")

    # If source was changed, update worker
    if payload.source:
        camera_manager.get_worker(camera_id, source=payload.source)

    # If resolution was changed, update worker
    if payload.resolution and camera_id in camera_manager.workers:
        try:
            parts = payload.resolution.split("x")
            w = int(parts[0])
            h = int(parts[1])
            camera_manager.workers[camera_id].set_resolution(w, h, payload.fps or 60)
        except Exception:
            pass

    return {"status": "success", "camera": cam}

@router.delete("/{camera_id}")
def remove_camera(camera_id: str):
    """Delete a camera from the system."""
    success = delete_configured_camera(camera_id)
    if not success:
        raise HTTPException(status_code=404, detail="Camera not found")

    # Stop worker
    camera_manager.remove_worker(camera_id)
    return {"status": "deleted", "id": camera_id}
