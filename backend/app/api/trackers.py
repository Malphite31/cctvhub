from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel
from ..core.database import (
    create_custom_tracker,
    list_custom_trackers,
    get_custom_tracker,
    update_custom_tracker,
    toggle_custom_tracker,
    delete_custom_tracker
)
from ..services.vision_tracker import vision_tracker

router = APIRouter()

class CustomTrackerCreate(BaseModel):
    camera_id: str = "0"
    name: str
    action_label: str
    trigger_type: str = "door_open"  # 'door_open', 'motion_zone', 'presence', 'line_cross'
    x: float
    y: float
    width: float
    height: float
    sensitivity: int = 60
    color: str = "#3B82F6"

class CustomTrackerUpdate(BaseModel):
    name: Optional[str] = None
    action_label: Optional[str] = None
    trigger_type: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    sensitivity: Optional[int] = None
    color: Optional[str] = None
    is_active: Optional[int] = None

@router.get("/list")
def get_trackers(camera_id: Optional[str] = Query(None, description="Camera Device ID")):
    """List all custom object/zone trackers."""
    return {"trackers": list_custom_trackers(camera_id)}

@router.post("/create")
def add_tracker(payload: CustomTrackerCreate):
    """Create a new custom object or zone tracker (e.g. Front Door, Gate, Safe)."""
    tracker = create_custom_tracker(
        camera_id=payload.camera_id,
        name=payload.name,
        action_label=payload.action_label,
        trigger_type=payload.trigger_type,
        x=payload.x,
        y=payload.y,
        width=payload.width,
        height=payload.height,
        sensitivity=payload.sensitivity,
        color=payload.color
    )
    vision_tracker.invalidate_cache(payload.camera_id)
    return {"status": "success", "tracker": tracker}

@router.get("/{tracker_id}")
def get_single_tracker(tracker_id: int):
    """Get single tracker details."""
    tracker = get_custom_tracker(tracker_id)
    if not tracker:
        raise HTTPException(status_code=404, detail="Tracker not found")
    return {"tracker": tracker}

@router.put("/{tracker_id}")
def update_single_tracker(tracker_id: int, payload: CustomTrackerUpdate):
    """Update custom tracker settings."""
    tracker = update_custom_tracker(
        tracker_id=tracker_id,
        name=payload.name,
        action_label=payload.action_label,
        trigger_type=payload.trigger_type,
        x=payload.x,
        y=payload.y,
        width=payload.width,
        height=payload.height,
        sensitivity=payload.sensitivity,
        color=payload.color,
        is_active=payload.is_active
    )
    if not tracker:
        raise HTTPException(status_code=404, detail="Tracker not found")
    vision_tracker.invalidate_cache(tracker.get("camera_id"))
    return {"status": "success", "tracker": tracker}

@router.post("/{tracker_id}/toggle")
def toggle_tracker_status(tracker_id: int):
    """Toggle active/inactive status."""
    tracker = toggle_custom_tracker(tracker_id)
    if not tracker:
        raise HTTPException(status_code=404, detail="Tracker not found")
    vision_tracker.invalidate_cache(tracker.get("camera_id"))
    return {"status": "success", "tracker": tracker}

@router.delete("/{tracker_id}")
def delete_tracker(tracker_id: int):
    """Delete a custom object tracker."""
    tracker = get_custom_tracker(tracker_id)
    success = delete_custom_tracker(tracker_id)
    if not success and not tracker:
        raise HTTPException(status_code=404, detail="Tracker not found")
    # Invalidate all camera caches immediately
    vision_tracker.invalidate_cache(None)
    return {"status": "deleted", "id": tracker_id}
