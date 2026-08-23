import os
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from typing import List
from pathlib import Path
from ..services.dvr_manager import dvr_manager
from ..core.config import settings

router = APIRouter()

class BatchDeleteRequest(BaseModel):
    filenames: List[str]

@router.post("/snapshot")
def capture_snapshot():
    """Trigger an instant high-resolution snapshot."""
    url = dvr_manager.capture_snapshot()
    if not url:
        raise HTTPException(status_code=500, detail="Failed to capture snapshot from webcam")
    return {"status": "success", "url": url}

@router.get("/snapshots")
def get_snapshots():
    """List all saved snapshots."""
    snaps = dvr_manager.list_snapshots()
    return {"snapshots": snaps}

@router.post("/snapshots/batch-delete")
def batch_delete_snapshots(req: BatchDeleteRequest):
    """Batch delete multiple snapshot files."""
    deleted = []
    for fn in req.filenames:
        filepath = settings.SNAPSHOTS_DIR / fn
        if filepath.exists() and filepath.is_file():
            try:
                filepath.unlink()
                deleted.append(fn)
            except Exception:
                pass
    return {"status": "success", "deleted_count": len(deleted), "filenames": deleted}

@router.get("/snapshots/{filename}")
@router.get("/snapshot/{filename}")
def serve_snapshot(filename: str):
    """Serve a specific snapshot image."""
    filepath = settings.SNAPSHOTS_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return FileResponse(filepath, media_type="image/jpeg")

@router.delete("/snapshots/{filename}")
def delete_snapshot(filename: str):
    """Delete a snapshot."""
    filepath = settings.SNAPSHOTS_DIR / filename
    if filepath.exists():
        filepath.unlink()
        return {"status": "deleted", "filename": filename}
    raise HTTPException(status_code=404, detail="Snapshot not found")

@router.post("/record/start")
def start_recording(duration: int = 60):
    """Start manual DVR recording."""
    return dvr_manager.start_manual_recording(duration_seconds=duration)

@router.post("/record/stop")
def stop_recording():
    """Stop active DVR recording."""
    return dvr_manager.stop_recording()

@router.get("/record/status")
def get_record_status():
    """Get DVR recording status."""
    return dvr_manager.get_status()

@router.get("/clips")
def get_recordings():
    """List all saved MP4 video clips."""
    recs = dvr_manager.list_recordings()
    return {"recordings": recs, "clips": recs}

@router.post("/clips/batch-delete")
def batch_delete_clips(req: BatchDeleteRequest):
    """Batch delete multiple MP4 video clips."""
    deleted = []
    for fn in req.filenames:
        filepath = settings.RECORDINGS_DIR / fn
        if filepath.exists() and filepath.is_file():
            try:
                filepath.unlink()
                deleted.append(fn)
            except Exception:
                pass
    return {"status": "success", "deleted_count": len(deleted), "filenames": deleted}

@router.get("/clips/{filename}")
def serve_recording(filename: str, request: Request):
    """Serve a recorded MP4 clip for video streaming/download with HTTP 206 Partial Content range support."""
    filepath = settings.RECORDINGS_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Recording not found")

    file_size = filepath.stat().st_size
    range_header = request.headers.get("range")

    if range_header:
        try:
            byte_range = range_header.strip().replace("bytes=", "").split("-")
            start = int(byte_range[0]) if byte_range[0] else 0
            end = int(byte_range[1]) if len(byte_range) > 1 and byte_range[1] else file_size - 1
            end = min(end, file_size - 1)
            content_length = end - start + 1

            def iterfile():
                with open(filepath, "rb") as f:
                    f.seek(start)
                    remaining = content_length
                    chunk_size = 1024 * 512  # 512KB chunks
                    while remaining > 0:
                        read_size = min(chunk_size, remaining)
                        data = f.read(read_size)
                        if not data:
                            break
                        remaining -= len(data)
                        yield data

            headers = {
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Content-Type": "video/mp4",
            }
            return StreamingResponse(iterfile(), status_code=206, headers=headers)
        except Exception:
            pass

    return FileResponse(
        filepath,
        media_type="video/mp4",
        filename=filename,
        headers={"Accept-Ranges": "bytes"}
    )

@router.delete("/clips/{filename}")
def delete_recording(filename: str):
    """Delete a recording file."""
    filepath = settings.RECORDINGS_DIR / filename
    if filepath.exists():
        filepath.unlink()
        return {"status": "deleted", "filename": filename}
    raise HTTPException(status_code=404, detail="Recording not found")
