import asyncio
import time
from fastapi import APIRouter, HTTPException, Request, Response, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import StreamingResponse
import httpx
from ..core.config import settings
from ..services.camera_worker import camera_manager, camera_worker
from ..services.audio_worker import audio_worker
from ..services.vision_tracker import vision_tracker

router = APIRouter()

@router.get("/config")
async def get_stream_config():
    """Returns streaming endpoints, audio status, and current active stream info."""
    return {
        "stream_name": settings.GO2RTC_STREAM_NAME,
        "go2rtc_url": settings.GO2RTC_API_URL,
        "webrtc_url": f"{settings.GO2RTC_API_URL}/api/webrtc?src={settings.GO2RTC_STREAM_NAME}",
        "live_mjpeg_url": "/api/stream/live",
        "audio_ws_url": "/api/stream/audio/ws",
        "active_device": str(camera_worker.device),
        "fps": camera_worker.actual_fps,
        "resolution": camera_worker.resolution,
        "audio_enabled": True,
        "active_audio_device": audio_worker.device_index,
        "sample_rate": audio_worker.sample_rate
    }

@router.post("/switch-camera")
def switch_camera(device: str = Query(..., description="Camera device index (e.g. 0, 1, 2)")):
    """Switch active video camera input device."""
    worker = camera_manager.get_worker(device)
    if not worker.is_running:
        worker.start()
    return {
        "status": "success",
        "active_device": str(device),
        "resolution": worker.resolution,
        "fps": worker.actual_fps
    }

@router.post("/resolution")
def set_resolution(
    dev: str = Query("0", description="Camera device index"),
    width: int = Query(1920, description="Width"),
    height: int = Query(1080, description="Height"),
    fps: int = Query(60, description="Target FPS")
):
    """Set camera resolution and framerate."""
    worker = camera_manager.get_worker(dev)
    return worker.set_resolution(width, height, fps)

from typing import Optional
from pydantic import BaseModel

class AdjustmentPayload(BaseModel):
    dev: str = "0"
    flip_h: Optional[bool] = None
    flip_v: Optional[bool] = None
    rotation: Optional[int] = None
    zoom: Optional[float] = None
    pan_x: Optional[float] = None
    pan_y: Optional[float] = None
    brightness: Optional[int] = None
    contrast: Optional[int] = None
    saturation: Optional[int] = None

@router.get("/adjustments")
def get_adjustments(dev: str = Query("0", description="Camera device index")):
    """Get camera adjustments for flip, crop, zoom, rotation, and color tuning."""
    worker = camera_manager.get_worker(dev)
    return {
        "device": dev,
        "flip_h": worker.flip_h,
        "flip_v": worker.flip_v,
        "rotation": worker.rotation,
        "zoom": worker.zoom,
        "pan_x": worker.pan_x,
        "pan_y": worker.pan_y,
        "brightness": worker.brightness,
        "contrast": worker.contrast,
        "saturation": worker.saturation
    }

@router.post("/adjustments")
def set_adjustments(
    payload: AdjustmentPayload,
):
    """Set camera adjustments for flip, crop, zoom, rotation, and image tuning."""
    worker = camera_manager.get_worker(payload.dev)
    if payload.flip_h is not None: worker.flip_h = payload.flip_h
    if payload.flip_v is not None: worker.flip_v = payload.flip_v
    if payload.rotation is not None: worker.rotation = payload.rotation
    if payload.zoom is not None: worker.zoom = max(1.0, min(3.0, float(payload.zoom)))
    if payload.pan_x is not None: worker.pan_x = max(-50.0, min(50.0, float(payload.pan_x)))
    if payload.pan_y is not None: worker.pan_y = max(-50.0, min(50.0, float(payload.pan_y)))
    if payload.brightness is not None: worker.brightness = max(0, min(100, int(payload.brightness)))
    if payload.contrast is not None: worker.contrast = max(0, min(100, int(payload.contrast)))
    if payload.saturation is not None: worker.saturation = max(0, min(100, int(payload.saturation)))

    return {
        "status": "success",
        "device": payload.dev,
        "flip_h": worker.flip_h,
        "flip_v": worker.flip_v,
        "rotation": worker.rotation,
        "zoom": worker.zoom,
        "pan_x": worker.pan_x,
        "pan_y": worker.pan_y,
        "brightness": worker.brightness,
        "contrast": worker.contrast,
        "saturation": worker.saturation
    }

@router.post("/switch-audio")
@router.post("/audio/device")
@router.post("/audio/switch")
def switch_audio(
    device_index: Optional[Any] = Query(None, description="Audio input device index or ALSA string"),
    index: Optional[Any] = Query(None, description="Alias for device index")
):
    """Switch active microphone input device."""
    target_device = device_index if device_index is not None else index
    return audio_worker.switch_device(target_device)

@router.get("/live")
async def live_stream(dev: str = Query("0", description="Camera device index")):
    """Multi-camera direct 60 FPS video stream."""
    worker = camera_manager.get_worker(dev)
    if not worker.is_running:
        worker.start()

    async def frame_generator():
        while True:
            jpeg = worker.get_latest_jpeg()
            if jpeg is not None:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + jpeg + b'\r\n')
            await asyncio.sleep(0.016)

    return StreamingResponse(
        frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@router.get("/frame")
def get_single_frame(dev: str = Query("0", description="Camera device index")):
    """Get single latest JPEG frame from camera worker for instant preview / frozen pause."""
    worker = camera_manager.get_worker(dev)
    jpeg = worker.get_latest_jpeg()
    if jpeg is None:
        raise HTTPException(status_code=503, detail="Camera signal not ready")
    return Response(
        content=jpeg,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@router.websocket("/audio/ws")
async def audio_websocket(websocket: WebSocket):
    """Live PCM Audio WebSocket stream."""
    await websocket.accept()
    queue = asyncio.Queue(maxsize=100)
    loop = asyncio.get_running_loop()
    audio_worker.register_queue(queue)
    audio_worker.set_loop(loop)
    try:
        while True:
            chunk = await queue.get()
            await websocket.send_bytes(chunk)
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    except Exception:
        pass
    finally:
        audio_worker.unregister_queue(queue)

@router.get("/audio/level")
def get_audio_level():
    """Get current microphone volume level (0-100%)."""
    return {
        "volume_rms": round(audio_worker.current_volume_rms, 1),
        "is_active": audio_worker.is_running
    }

@router.get("/audio/devices")
def get_audio_devices():
    """List available microphone input devices with friendly names."""
    return {
        "devices": audio_worker.list_devices(),
        "active_device": audio_worker.device_index
    }

@router.get("/detections")
def get_detections(dev: str = Query("0", description="Camera device index")):
    """Returns active tracked targets and bounding boxes for the camera feed."""
    worker = camera_manager.get_worker(dev)
    detections = worker.get_latest_detections()
    return {
        "device": dev,
        "count": len(detections),
        "detections": detections
    }

@router.get("/tracker-settings")
def get_tracker_settings():
    """Returns active Vision Tracker HUD configuration and toggles."""
    return vision_tracker.get_settings()

@router.post("/tracker-settings")
async def set_tracker_settings(request: Request):
    """Updates Vision Tracker HUD configuration, bounding box flags, and markers."""
    try:
        body = await request.json()
        vision_tracker.update_settings(body)
        return {
            "status": "success",
            "settings": vision_tracker.get_settings()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/webrtc")
async def webrtc_signal(request: Request):
    """Proxy WebRTC SDP Offer / Answer to go2rtc engine."""
    body = await request.body()
    src = request.query_params.get("src", settings.GO2RTC_STREAM_NAME)
    
    target_url = f"{settings.GO2RTC_API_URL}/api/webrtc?src={src}"
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.post(
                target_url,
                content=body,
                headers={"Content-Type": "application/sdp"}
            )
            return Response(content=resp.content, status_code=resp.status_code, media_type="application/sdp")
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"WebRTC Gateway Error: {str(e)}")

