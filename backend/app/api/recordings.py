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
        if dvr_manager.delete_snapshot_file(fn):
            deleted.append(fn)
    return {"status": "success", "deleted_count": len(deleted), "filenames": deleted}

@router.delete("/snapshots/clear")
@router.post("/snapshots/clear")
def clear_snapshots():
    """Permanently delete all snapshot photo files across storage."""
    count = dvr_manager.clear_all_snapshots()
    return {"status": "success", "deleted_count": count}

@router.get("/snapshots/{filename:path}")
@router.get("/snapshot/{filename:path}")
def serve_snapshot(filename: str):
    """Serve a specific snapshot image."""
    clean_fn = Path(filename).name
    for d in [dvr_manager.get_snapshots_dir(), dvr_manager.get_recordings_dir() / "snapshots", settings.SNAPSHOTS_DIR]:
        filepath = d / clean_fn
        if filepath.exists() and filepath.is_file():
            return FileResponse(filepath, media_type="image/jpeg")
    raise HTTPException(status_code=404, detail="Snapshot not found")

@router.delete("/snapshots/{filename:path}")
@router.delete("/snapshot/{filename:path}")
@router.post("/snapshots/{filename:path}/delete")
@router.post("/snapshot/{filename:path}/delete")
def delete_snapshot(filename: str):
    """Delete a snapshot file."""
    clean_fn = Path(filename).name
    if dvr_manager.delete_snapshot_file(clean_fn):
        return {"status": "deleted", "filename": clean_fn}
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
@router.get("/recordings")
def get_recordings():
    """List all saved MP4 video clips."""
    recs = dvr_manager.list_recordings()
    return {"recordings": recs, "clips": recs}

@router.post("/clips/batch-delete")
@router.post("/recordings/batch-delete")
def batch_delete_clips(req: BatchDeleteRequest):
    """Batch delete multiple MP4 video clips."""
    deleted = []
    for fn in req.filenames:
        if dvr_manager.delete_recording_file(fn):
            deleted.append(fn)
    return {"status": "success", "deleted_count": len(deleted), "filenames": deleted}

@router.delete("/clips/clear")
@router.delete("/recordings/clear")
@router.post("/clips/clear")
@router.post("/recordings/clear")
def clear_recordings():
    """Permanently delete all video recording files across storage."""
    count = dvr_manager.clear_all_recordings()
    return {"status": "success", "deleted_count": count}

@router.delete("/clear-all")
@router.post("/clear-all")
def clear_all_media():
    """Permanently purge all video clips and snapshot photos."""
    clips_count = dvr_manager.clear_all_recordings()
    snaps_count = dvr_manager.clear_all_snapshots()
    return {
        "status": "success",
        "deleted_clips": clips_count,
        "deleted_snapshots": snaps_count,
        "total_deleted": clips_count + snaps_count
    }

@router.get("/clips/{filename:path}")
@router.get("/clip/{filename:path}")
@router.get("/video/{filename:path}")
def serve_recording(filename: str, request: Request):
    """Serve a recorded MP4 clip for video streaming/download with HTTP 206 Partial Content range support."""
    clean_fn = Path(filename).name
    filepath = None
    for d in [dvr_manager.get_recordings_dir(), settings.RECORDINGS_DIR]:
        p = d / clean_fn
        if p.exists() and p.is_file():
            filepath = p
            break

    if not filepath:
        raise HTTPException(status_code=404, detail="Recording not found")

    file_size = filepath.stat().st_size
    range_header = request.headers.get("range")

    if range_header and file_size > 0:
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
        filename=clean_fn,
        headers={"Accept-Ranges": "bytes"}
    )

@router.delete("/clips/{filename:path}")
@router.delete("/clip/{filename:path}")
@router.delete("/video/{filename:path}")
@router.post("/clips/{filename:path}/delete")
@router.post("/clip/{filename:path}/delete")
def delete_recording(filename: str):
    """Delete a recording file."""
    clean_fn = Path(filename).name
    if dvr_manager.delete_recording_file(clean_fn):
        return {"status": "deleted", "filename": clean_fn}
    raise HTTPException(status_code=404, detail="Recording not found")
