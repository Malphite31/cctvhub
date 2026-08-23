import os
import psutil
from fastapi import APIRouter, HTTPException, Body, Query
from pathlib import Path
from typing import Dict, Any, Optional, List
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

def get_system_drives() -> List[Dict[str, Any]]:
    """Returns detected physical drives, mounted disks, and top-level storage directories."""
    drives = []
    seen = set()

    try:
        for p in psutil.disk_partitions(all=False):
            mount = p.mountpoint
            if not mount or mount in seen:
                continue
            seen.add(mount)
            label = p.device if p.device else mount
            try:
                usage = psutil.disk_usage(mount)
                free_gb = round(usage.free / (1024**3), 1)
                total_gb = round(usage.total / (1024**3), 1)
            except Exception:
                free_gb = 0
                total_gb = 0
            drives.append({
                "name": mount,
                "path": mount,
                "label": f"{mount} ({label})" if label != mount else mount,
                "free_gb": free_gb,
                "total_gb": total_gb,
                "fstype": p.fstype or "local"
            })
    except Exception:
        pass

    # Add standard Linux root and mount paths if not already captured
    if os.name != "nt":
        common_linux = ["/", "/mnt", "/media", "/opt", "/var", "/home"]
        for c in common_linux:
            if os.path.exists(c) and c not in seen:
                seen.add(c)
                try:
                    usage = psutil.disk_usage(c)
                    free_gb = round(usage.free / (1024**3), 1)
                    total_gb = round(usage.total / (1024**3), 1)
                except Exception:
                    free_gb = 0
                    total_gb = 0
                drives.append({
                    "name": c,
                    "path": c,
                    "label": c,
                    "free_gb": free_gb,
                    "total_gb": total_gb,
                    "fstype": "ext4/zfs"
                })

    return drives

# --- Local Storage Location & Directory Browser Endpoints ---
@router.get("/browse")
def browse_storage_directory(path: Optional[str] = Query(None)):
    """Browse directories and drives on the host system for interactive folder selection."""
    rec_dir = dvr_manager.get_recordings_dir()

    if not path or not path.strip():
        target_path = rec_dir if rec_dir.exists() else Path.home()
    else:
        target_path = Path(path.strip())

    if not target_path.exists():
        target_path = rec_dir if rec_dir.exists() else Path("/")

    target_path = target_path.resolve()

    # Determine parent directory
    parent_path = str(target_path.parent) if target_path.parent != target_path else None

    # Disk usage for current path
    try:
        disk = psutil.disk_usage(str(target_path))
        free_gb = round(disk.free / (1024**3), 1)
        total_gb = round(disk.total / (1024**3), 1)
        used_gb = round(disk.used / (1024**3), 1)
        percent = disk.percent
    except Exception:
        free_gb = total_gb = used_gb = percent = 0

    is_writable = os.access(str(target_path), os.W_OK)

    # Scan child directories
    folders = []
    try:
        with os.scandir(str(target_path)) as entries:
            for entry in entries:
                try:
                    if entry.is_dir(follow_symlinks=False):
                        name = entry.name
                        if name.startswith(".") or name.startswith("$") or name in ["System Volume Information", "Recovery", "$RECYCLE.BIN"]:
                            continue
                        folders.append({
                            "name": name,
                            "path": str(Path(entry.path)),
                            "is_writable": os.access(entry.path, os.W_OK),
                            "is_dir": True
                        })
                except (PermissionError, OSError):
                    continue
    except (PermissionError, OSError):
        pass

    folders.sort(key=lambda x: x["name"].lower())
    drives = get_system_drives()

    # Breadcrumb segments
    breadcrumbs = []
    curr = target_path
    while True:
        breadcrumbs.insert(0, {"name": curr.name or str(curr), "path": str(curr)})
        if curr.parent == curr:
            break
        curr = curr.parent

    return {
        "current_path": str(target_path),
        "parent_path": parent_path,
        "is_writable": is_writable,
        "free_gb": free_gb,
        "total_gb": total_gb,
        "used_gb": used_gb,
        "disk_percent": percent,
        "folders": folders,
        "drives": drives,
        "breadcrumbs": breadcrumbs
    }

@router.post("/create-folder")
def create_storage_folder(data: Dict[str, str] = Body(...)):
    """Create a new folder inside a parent directory."""
    parent_path = data.get("parent_path")
    folder_name = (data.get("folder_name") or "").strip()

    if not parent_path or not folder_name:
        raise HTTPException(status_code=400, detail="Parent path and folder name are required")

    # Sanitize folder name
    for invalid_char in ['/', '\\', ':', '*', '?', '"', '<', '>', '|']:
        folder_name = folder_name.replace(invalid_char, '_')

    target_dir = Path(parent_path) / folder_name
    try:
        target_dir.mkdir(parents=True, exist_ok=True)
        return {
            "success": True,
            "path": str(target_dir.resolve()),
            "message": f"Created folder '{folder_name}'"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create folder: {e}")

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
