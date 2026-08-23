import csv
import io
import json
import time
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import StreamingResponse
from ..core.database import (
    get_events,
    get_events_today_count,
    get_event_by_id,
    delete_event,
    clear_all_events,
    delete_events_batch
)

router = APIRouter()

class BatchDeleteRequest(BaseModel):
    ids: List[int]

@router.get("/list")
def list_events(limit: int = 100):
    """List real surveillance events from database."""
    return {
        "events": get_events(limit=limit),
        "count_today": get_events_today_count()
    }

@router.get("/{event_id}")
def get_event(event_id: int):
    """Get single event details."""
    event = get_event_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"event": event}

@router.delete("/clear")
@router.post("/clear")
def clear_events():
    """Clear all surveillance events from database."""
    deleted_count = clear_all_events()
    return {"status": "success", "deleted_count": deleted_count}

@router.post("/batch-delete")
def batch_delete(req: BatchDeleteRequest):
    """Delete multiple surveillance events."""
    deleted_count = delete_events_batch(req.ids)
    return {"status": "success", "deleted_count": deleted_count}

@router.delete("/{event_id}")
def delete_single_event(event_id: int):
    """Delete a specific surveillance event by ID."""
    success = delete_event(event_id)
    if not success:
        raise HTTPException(status_code=404, detail="Event not found or already deleted")
    return {"status": "success", "id": event_id}

@router.get("/export/csv")
def export_csv(limit: int = 1000):
    """Export all events as a downloadable CSV file."""
    events = get_events(limit=limit)
    output = io.StringIO()
    # Add UTF-8 BOM for Excel compatibility
    output.write('\ufeff')
    writer = csv.writer(output)
    writer.writerow(["ID", "Timestamp (UTC)", "Timestamp (Epoch)", "Classification", "Camera ID", "Title", "Details", "Thumbnail URL", "Clip URL"])
    
    for ev in events:
        ts = ev.get("timestamp") or 0
        time_str = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(ts)) if ts else ""
        writer.writerow([
            ev.get("id", ""),
            time_str,
            ts,
            ev.get("event_type", "general"),
            ev.get("camera_id", ""),
            ev.get("title", ""),
            ev.get("details", ""),
            ev.get("thumbnail_url", ""),
            ev.get("clip_url", "")
        ])
    
    output.seek(0)
    filename = f"cctv_events_export_{int(time.time())}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

@router.get("/export/json")
def export_json(limit: int = 1000):
    """Export all events as a downloadable JSON file."""
    events = get_events(limit=limit)
    data = {
        "exported_at": int(time.time()),
        "total_records": len(events),
        "events": events
    }
    content = json.dumps(data, indent=2)
    filename = f"cctv_events_export_{int(time.time())}.json"
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

