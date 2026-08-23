import os
import psutil
from fastapi import APIRouter, HTTPException, Body
from pathlib import Path
from typing import Dict, Any
from ..services.s3_storage import s3_storage
from ..services.samba_storage import samba_storage
from ..services.dvr_manager import dvr_manager
from ..core.config import settings

router = APIRouter()

def get_dir_size(path: Path) -> int:
    total = 0
    try:
        if path.exists():
            for p in path.glob("**/*"):
                if p.is_file():
                    total += p.stat().st_size
    except Exception:
        pass
    return total

# --- Local Storage Location Endpoints ---
@router.get("/location")
def get_storage_location():
    """Get active local save directory path and real disk space breakdown."""
    rec_dir = dvr_manager.get_recordings_dir()
    snap_dir = dvr_manager.get_snapshots_dir()
    faces_dir = settings.DATA_DIR / "faces"
    
    try:
        disk = psutil.disk_usage(str(rec_dir))
        free_gb = round(disk.free / (1024**3), 2)
        total_gb = round(disk.total / (1024**3), 2)
        used_gb = round(disk.used / (1024**3), 2)
        percent = disk.percent
    except Exception:
        free_gb = 0
        total_gb = 0
        used_gb = 0
        percent = 0

    rec_size_mb = round(get_dir_size(rec_dir) / (1024 * 1024), 2)
    snap_size_mb = round(get_dir_size(snap_dir) / (1024 * 1024), 2)
    faces_size_mb = round(get_dir_size(faces_dir) / (1024 * 1024), 2)

    return {
        "recordings_path": str(rec_dir),
        "snapshots_path": str(snap_dir),
        "free_gb": free_gb,
        "total_gb": total_gb,
        "used_gb": used_gb,
        "disk_percent": percent,
        "recordings_mb": rec_size_mb,
        "snapshots_mb": snap_size_mb,
        "faces_mb": faces_size_mb,
        "is_writable": os.access(str(rec_dir), os.W_OK)
    }

@router.post("/location")
def set_storage_location(data: Dict[str, str] = Body(...)):
    """Change active local save directory path."""
    new_path = data.get("path")
    if not new_path:
        raise HTTPException(status_code=400, detail="Path is required")

    result = dvr_manager.set_custom_storage_dir(new_path)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Invalid path"))
    return result

@router.post("/open-folder")
def open_folder():
    """Open the recordings folder in Windows Explorer or OS file manager."""
    result = dvr_manager.open_storage_folder()
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Could not open folder"))
    return result

# --- S3 Cloud Endpoints ---
@router.get("/s3/config")
def get_s3_config():
    return {"config": s3_storage.get_config()}

@router.post("/s3/config")
def save_s3_config(data: Dict[str, Any] = Body(...)):
    saved = s3_storage.save_config(data)
    return {"status": "saved", "config": saved}

@router.post("/s3/test")
def test_s3(data: Dict[str, Any] = Body(default={})):
    result = s3_storage.test_connection(data if data else None)
    return result

@router.post("/s3/upload/{filename}")
def upload_to_s3(filename: str):
    rec_path = dvr_manager.get_recordings_dir() / filename
    snap_path = dvr_manager.get_snapshots_dir() / filename
    target = rec_path if rec_path.exists() else (snap_path if snap_path.exists() else None)

    if not target:
        raise HTTPException(status_code=404, detail="File not found")

    result = s3_storage.upload_file(target)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "S3 Upload failed"))
    return result

# --- Samba / SMB Endpoints ---
@router.get("/samba/config")
def get_samba_config():
    return {"config": samba_storage.get_config()}

@router.post("/samba/config")
def save_samba_config(data: Dict[str, Any] = Body(...)):
    saved = samba_storage.save_config(data)
    return {"status": "saved", "config": saved}

@router.post("/samba/test")
def test_samba(data: Dict[str, Any] = Body(default={})):
    result = samba_storage.test_connection(data if data else None)
    return result

@router.post("/samba/sync/{filename}")
def sync_to_samba(filename: str):
    rec_path = dvr_manager.get_recordings_dir() / filename
    snap_path = dvr_manager.get_snapshots_dir() / filename
    target = rec_path if rec_path.exists() else (snap_path if snap_path.exists() else None)

    if not target:
        raise HTTPException(status_code=404, detail="File not found")

    result = samba_storage.sync_file(target)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Samba sync failed"))
    return result
