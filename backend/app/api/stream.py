import asyncio
import time
from typing import Optional, Any, List, Dict
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Request, Response, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import StreamingResponse
import httpx
from ..core.config import settings
from ..services.camera_worker import camera_manager, camera_worker
from ..services.audio_worker import audio_worker, audio_speaker
from ..services.vision_tracker import vision_tracker

router = APIRouter()

@router.get("/config")
async def get_stream_config():
    """Returns streaming endpoints, audio status, and current active stream info."""
    active_id = camera_manager.get_active_device()
    worker = camera_manager.get_worker(active_id) if active_id else None
    return {
        "stream_name": settings.GO2RTC_STREAM_NAME,
        "go2rtc_url": settings.GO2RTC_API_URL,
        "webrtc_url": f"{settings.GO2RTC_API_URL}/api/webrtc?src={settings.GO2RTC_STREAM_NAME}" if active_id else "",
        "live_mjpeg_url": f"/api/stream/live?dev={active_id}" if active_id else "",
        "audio_ws_url": "/api/stream/audio/ws",
        "talk_ws_url": "/api/stream/talk/ws",
        "active_device": str(active_id) if active_id else None,
        "fps": worker.actual_fps if worker else 0,
        "resolution": worker.resolution if worker else "1920x1080",
        "quality_mode": getattr(worker, "quality_mode", "sd") if worker else "sd",
        "jpeg_quality": getattr(worker, "jpeg_quality", 52) if worker else 52,
        "audio_enabled": True,
        "active_audio_device": audio_worker.device_index,
        "active_speaker_device": audio_speaker.output_device,
        "sample_rate": audio_worker.sample_rate
    }

@router.post("/switch-camera")
def switch_camera(device: str = Query(..., description="Camera device index (e.g. 0, 1, 2)")):
    """Switch active video camera input device and persist setting."""
    worker = camera_manager.get_worker(device)
    if not worker:
        raise HTTPException(status_code=404, detail="Camera not found in configured devices")
    camera_manager.set_active_device(device)
    if not worker.is_running:
        worker.start()
    return {
        "status": "success",
        "active_device": str(device),
        "quality_mode": getattr(worker, "quality_mode", "sd"),
        "resolution": worker.resolution,
        "fps": worker.actual_fps
    }

class QualityPayload(BaseModel):
    dev: Optional[str] = None
    mode: str = "sd" # "sd" (low bandwidth 480p) or "hd" (high definition 1080p)
    resolution: Optional[str] = None

@router.get("/quality")
def get_stream_quality(dev: Optional[str] = Query(None, description="Camera device index")):
    """Get active transmission quality mode (SD/HD), resolution, and JPEG quality."""
    target_dev = str(dev) if dev is not None else camera_manager.get_active_device()
    worker = camera_manager.get_worker(target_dev) if target_dev else None
    return {
        "device": target_dev,
        "quality_mode": getattr(worker, "quality_mode", "sd") if worker else "sd",
        "resolution": worker.resolution if worker else "1920x1080",
        "jpeg_quality": getattr(worker, "jpeg_quality", 52) if worker else 52,
        "fps": (worker.actual_fps or worker.requested_fps) if worker else 0
    }

@router.post("/quality")
def set_stream_quality(payload: QualityPayload):
    """Switch stream transmission quality mode (SD / HD) in real-time to save bandwidth."""
    target_dev = str(payload.dev) if payload.dev is not None else camera_manager.get_active_device()
    worker = camera_manager.get_worker(target_dev) if target_dev else None
    if not worker:
        return {"status": "error", "detail": "Camera not active"}
    return worker.set_quality_mode(payload.mode)

@router.post("/resolution")
def set_resolution(
    dev: str = Query("0", description="Camera device index"),
    width: int = Query(1920, description="Width"),
    height: int = Query(1080, description="Height"),
    fps: int = Query(60, description="Target FPS"),
    mode: Optional[str] = Query(None, description="Quality mode (sd/hd)")
):
    """Set camera resolution and framerate in real-time."""
    worker = camera_manager.get_worker(dev)
    if not worker:
        raise HTTPException(status_code=404, detail="Camera not active")
    return worker.set_resolution(width, height, fps, quality_mode=mode)

@router.post("/reconnect")
@router.post("/restart")
def restart_camera_hardware(dev: Optional[str] = Query(None, description="Camera device index")):
    """Forcefully restarts camera capture hardware and resets video stream."""
    target_dev = str(dev) if dev is not None else camera_manager.get_active_device()
    if not target_dev:
        raise HTTPException(status_code=404, detail="No active camera to restart")
    worker = camera_manager.restart_camera(target_dev)
    if not worker:
        raise HTTPException(status_code=404, detail="Camera not found")
    return {
        "status": "success",
        "device": target_dev,
        "is_running": worker.is_running,
        "is_hardware_active": worker.is_hardware_active,
        "resolution": worker.resolution,
        "fps": worker.requested_fps
    }

@router.post("/pause")
def pause_camera_stream(dev: Optional[str] = Query(None, description="Camera device index")):
    """Pauses the camera worker, deactivates USB/hardware capture, and turns off webcam sensor."""
    target_dev = str(dev) if dev is not None else camera_manager.get_active_device()
    worker = camera_manager.get_worker(target_dev) if target_dev else None
    if worker:
        worker.pause()
    return {
        "status": "paused",
        "device": target_dev,
        "is_paused": True,
        "is_hardware_active": False
    }

@router.post("/resume")
@router.post("/play")
def resume_camera_stream(dev: Optional[str] = Query(None, description="Camera device index")):
    """Resumes the camera worker, reactivates hardware capture, and resumes live stream."""
    target_dev = str(dev) if dev is not None else camera_manager.get_active_device()
    worker = camera_manager.get_worker(target_dev) if target_dev else None
    if worker:
        worker.resume()
    return {
        "status": "active",
        "device": target_dev,
        "is_paused": False,
        "is_hardware_active": worker.is_hardware_active if worker else False
    }

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
    from ..core.database import get_camera_adjustments
    adj = get_camera_adjustments(dev)
    worker = camera_manager.get_worker(dev)
    if not worker:
        return {
            "device": dev,
            "flip_h": adj.get("flip_h", False),
            "flip_v": adj.get("flip_v", False),
            "rotation": adj.get("rotation", 0),
            "zoom": adj.get("zoom", 1.0),
            "pan_x": adj.get("pan_x", 0.0),
            "pan_y": adj.get("pan_y", 0.0),
            "brightness": adj.get("brightness", 50),
            "contrast": adj.get("contrast", 50),
            "saturation": adj.get("saturation", 50)
        }
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
    from ..core.database import set_camera_adjustments

    worker = camera_manager.get_worker(payload.dev)
    updates = {}
    if payload.flip_h is not None:
        if worker: worker.flip_h = payload.flip_h
        updates["flip_h"] = payload.flip_h
    if payload.flip_v is not None:
        if worker: worker.flip_v = payload.flip_v
        updates["flip_v"] = payload.flip_v
    if payload.rotation is not None:
        if worker: worker.rotation = payload.rotation
        updates["rotation"] = payload.rotation
    if payload.zoom is not None:
        val = max(1.0, min(3.0, float(payload.zoom)))
        if worker: worker.zoom = val
        updates["zoom"] = val
    if payload.pan_x is not None:
        val = max(-50.0, min(50.0, float(payload.pan_x)))
        if worker: worker.pan_x = val
        updates["pan_x"] = val
    if payload.pan_y is not None:
        val = max(-50.0, min(50.0, float(payload.pan_y)))
        if worker: worker.pan_y = val
        updates["pan_y"] = val
    if payload.brightness is not None:
        val = max(0, min(100, int(payload.brightness)))
        if worker: worker.brightness = val
        updates["brightness"] = val
    if payload.contrast is not None:
        val = max(0, min(100, int(payload.contrast)))
        if worker: worker.contrast = val
        updates["contrast"] = val
    if payload.saturation is not None:
        val = max(0, min(100, int(payload.saturation)))
        if worker: worker.saturation = val
        updates["saturation"] = val

    if updates:
        try:
            set_camera_adjustments(payload.dev, updates)
        except Exception:
            pass

    return {
        "status": "success",
        "device": payload.dev,
        "flip_h": worker.flip_h if worker else updates.get("flip_h", False),
        "flip_v": worker.flip_v if worker else updates.get("flip_v", False),
        "rotation": worker.rotation if worker else updates.get("rotation", 0),
        "zoom": worker.zoom if worker else updates.get("zoom", 1.0),
        "pan_x": worker.pan_x if worker else updates.get("pan_x", 0.0),
        "pan_y": worker.pan_y if worker else updates.get("pan_y", 0.0),
        "brightness": worker.brightness if worker else updates.get("brightness", 50),
        "contrast": worker.contrast if worker else updates.get("contrast", 50),
        "saturation": worker.saturation if worker else updates.get("saturation", 50)
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
async def live_stream(dev: Optional[str] = Query(None, description="Camera device index")):
    """Multi-camera direct 60 FPS video stream."""
    target_dev = str(dev) if dev is not None else camera_manager.get_active_device()
    if not target_dev:
        raise HTTPException(status_code=404, detail="No camera configured")
    worker = camera_manager.get_worker(target_dev)
    if not worker:
        raise HTTPException(status_code=404, detail="Camera not configured")
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
def get_single_frame(dev: Optional[str] = Query(None, description="Camera device index")):
    """Get single latest JPEG frame from camera worker for instant preview / frozen pause."""
    target_dev = str(dev) if dev is not None else camera_manager.get_active_device()
    if not target_dev:
        raise HTTPException(status_code=404, detail="No camera configured")
    worker = camera_manager.get_worker(target_dev)
    if not worker:
        raise HTTPException(status_code=404, detail="Camera not configured")
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

@router.websocket("/talk/ws")
async def talk_websocket_endpoint(websocket: WebSocket):
    """Bidirectional WebSocket for 2-way audio intercom / talking to camera speaker."""
    await websocket.accept()
    audio_speaker.start(sample_rate=16000)
    try:
        while True:
            data = await websocket.receive()
            if "bytes" in data and data["bytes"]:
                raw_pcm = data["bytes"]
                audio_speaker.play_chunk(raw_pcm, client_sample_rate=16000)
                await websocket.send_json({
                    "status": "playing",
                    "rms": round(audio_speaker.current_volume_rms, 1),
                    "is_talking": True
                })
            elif "text" in data and data["text"]:
                try:
                    import json
                    msg = json.loads(data["text"])
                    if msg.get("action") == "set_device":
                        audio_speaker.set_output_device(msg.get("device"))
                    elif msg.get("action") == "flush":
                        audio_speaker.flush()
                    elif msg.get("action") == "ping":
                        await websocket.send_json({"status": "pong"})
                except Exception:
                    pass
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    except Exception:
        pass
    finally:
        audio_speaker.flush()

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

@router.get("/audio/output-devices")
def get_audio_output_devices():
    """List available speaker / audio output devices with friendly names."""
    return {
        "devices": audio_speaker.list_output_devices(),
        "active_device": audio_speaker.output_device or "default"
    }

@router.post("/audio/output-device")
def set_audio_output_device(device: Optional[str] = Query(None, description="Speaker output device index or default")):
    """Switch active speaker / audio output device for 2-way talk."""
    target = None if device in ["default", "none", "", None] else device
    audio_speaker.set_output_device(target)
    return {
        "status": "success",
        "active_device": audio_speaker.output_device or "default"
    }

@router.post("/audio/test-speaker")
def test_speaker_audio():
    """Plays a brief test tone on the active host speaker."""
    success = audio_speaker.test_sound()
    return {"status": "success" if success else "error"}


@router.get("/talk/status")
def get_talk_status():
    """Returns real-time 2-way audio talk status and speaker volume level."""
    return {
        "is_talking": audio_speaker.is_talking,
        "is_active": audio_speaker.is_active,
        "volume_rms": round(audio_speaker.current_volume_rms, 1),
        "active_device": audio_speaker.output_device
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
def get_tracker_settings(
    dev: Optional[str] = Query(None, description="Camera device index"),
    camera_id: Optional[str] = Query(None, description="Camera ID alias")
):
    """Returns Vision Tracker HUD configuration for a specific camera."""
    target_dev = camera_id if camera_id is not None else (dev if dev is not None else camera_manager.get_active_device())
    return vision_tracker.get_settings(str(target_dev))

@router.post("/tracker-settings")
async def set_tracker_settings(
    request: Request,
    dev: Optional[str] = Query(None, description="Camera device index"),
    camera_id: Optional[str] = Query(None, description="Camera ID alias")
):
    """Updates Vision Tracker HUD configuration for a specific camera."""
    try:
        body = await request.json()
        target_dev = body.get("camera_id") or body.get("dev") or camera_id or dev or camera_manager.get_active_device()
        updated = vision_tracker.update_settings(body, camera_id=str(target_dev))
        return {
            "status": "success",
            "camera_id": str(target_dev),
            "settings": updated
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

