from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Query, HTTPException
from ..services.motion_detector import motion_detector

router = APIRouter()

class MotionSettingsUpdate(BaseModel):
    camera_id: str = "0"
    enabled: Optional[bool] = None
    sensitivity: Optional[int] = None # 1-100
    action: Optional[str] = None # 'snapshot' | 'record' | 'both' | 'log_only'
    cooldown_seconds: Optional[int] = None # 5-60
    record_duration_seconds: Optional[int] = None # 5-60
    highlight_boxes: Optional[bool] = None

@router.get("/settings")
def get_motion_settings(camera_id: str = Query("0")):
    """Get motion detection configuration for a specific camera."""
    settings = motion_detector.get_camera_settings(camera_id)
    return {"camera_id": camera_id, "settings": settings}

@router.post("/settings")
def update_motion_settings(payload: MotionSettingsUpdate):
    """Update motion detection settings for a camera."""
    updates = {}
    if payload.enabled is not None: updates["enabled"] = payload.enabled
    if payload.sensitivity is not None: updates["sensitivity"] = max(1, min(100, payload.sensitivity))
    if payload.action is not None: updates["action"] = payload.action
    if payload.cooldown_seconds is not None: updates["cooldown_seconds"] = max(3, min(300, payload.cooldown_seconds))
    if payload.record_duration_seconds is not None: updates["record_duration_seconds"] = max(3, min(120, payload.record_duration_seconds))
    if payload.highlight_boxes is not None: updates["highlight_boxes"] = payload.highlight_boxes

    updated = motion_detector.update_camera_settings(payload.camera_id, updates)
    return {"status": "success", "camera_id": payload.camera_id, "settings": updated}

@router.get("/status")
def get_motion_status(camera_id: str = Query("0")):
    """Get real-time motion level and detection status for HUD."""
    return motion_detector.get_status(camera_id)

@router.post("/test-trigger")
def trigger_test_motion(camera_id: str = Query("0")):
    """Manually test motion trigger actions for verification."""
    from ..services.camera_worker import camera_manager
    worker = camera_manager.get_worker(camera_id)
    frame = worker.get_latest_frame()
    if frame is None:
        raise HTTPException(status_code=400, detail="Camera feed not available")
    
    cfg = motion_detector.get_camera_settings(camera_id)
    motion_detector._execute_motion_actions(frame.copy(), camera_id, cfg, motion_pct=99.9)
    return {"status": "success", "message": f"Test motion trigger executed for CAM {camera_id}"}
