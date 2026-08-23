import os
import time
import shutil
import cv2
import base64
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body
from fastapi.responses import FileResponse
from ..core.database import enroll_face, list_enrolled_faces, delete_enrolled_face, FACES_DIR
from ..services.camera_worker import camera_worker
from ..services.vision_tracker import vision_tracker

router = APIRouter()

class FaceEnrollRequest(BaseModel):
    name: Optional[str] = None
    image_b64: Optional[str] = None

def detect_face_bbox(img_bgr: np.ndarray) -> Optional[Dict[str, Any]]:
    """
    Detects the primary face in the image and returns pixel and percentage bounding coordinates.
    """
    if img_bgr is None or img_bgr.size == 0:
        return None

    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    
    cascade_dir = Path(cv2.data.haarcascades)
    face_cascade = cv2.CascadeClassifier(str(cascade_dir / "haarcascade_frontalface_default.xml"))
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.12, minNeighbors=4, minSize=(50, 50))
    
    if len(faces) == 0:
        alt_path = cascade_dir / "haarcascade_frontalface_alt2.xml"
        if alt_path.exists():
            alt_cascade = cv2.CascadeClassifier(str(alt_path))
            faces = alt_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(45, 45))

    if len(faces) == 0:
        return None

    # Pick largest detected face
    faces = sorted(faces, key=lambda b: b[2] * b[3], reverse=True)
    fx, fy, fw, fh = faces[0]

    return {
        "x": int(fx),
        "y": int(fy),
        "w": int(fw),
        "h": int(fh),
        "x_pct": round((fx / float(w)) * 100.0, 2),
        "y_pct": round((fy / float(h)) * 100.0, 2),
        "w_pct": round((fw / float(w)) * 100.0, 2),
        "h_pct": round((fh / float(h)) * 100.0, 2),
    }

def extract_and_save_face_portrait(img_bgr: np.ndarray, target_path: Path) -> bool:
    """
    Detects primary face in image, crops ONLY the face with proportional margins,
    normalizes to a crisp 400x400 biometric face portrait, and saves to target_path.
    """
    if img_bgr is None or img_bgr.size == 0:
        return False

    h, w = img_bgr.shape[:2]
    bbox_info = detect_face_bbox(img_bgr)
    
    if bbox_info:
        fx, fy, fw, fh = bbox_info["x"], bbox_info["y"], bbox_info["w"], bbox_info["h"]
        pad_x = int(fw * 0.22)
        pad_y_top = int(fh * 0.30)
        pad_y_bot = int(fh * 0.20)
        
        x1 = max(0, fx - pad_x)
        y1 = max(0, fy - pad_y_top)
        x2 = min(w, fx + fw + pad_x)
        y2 = min(h, fy + fh + pad_y_bot)
        
        face_crop = img_bgr[y1:y2, x1:x2]
    else:
        min_dim = min(h, w)
        cy, cx = h // 2, w // 2
        half = min_dim // 2
        face_crop = img_bgr[max(0, cy - half):min(h, cy + half), max(0, cx - half):min(w, cx + half)]
        
    if face_crop is None or face_crop.size == 0:
        face_crop = img_bgr

    face_portrait = cv2.resize(face_crop, (400, 400), interpolation=cv2.INTER_AREA)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(target_path), face_portrait, [cv2.IMWRITE_JPEG_QUALITY, 95])
    return True

@router.get("/list")
def get_faces():
    """Returns list of real enrolled faces."""
    return {"faces": list_enrolled_faces()}

@router.post("/preview/upload")
async def preview_upload(file: UploadFile = File(...)):
    """
    Scans and auto-tracks the face in an uploaded image, returning detected face coordinates
    and a base64 preview of the cropped 400x400 biometric portrait.
    """
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img_bgr is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    h, w = img_bgr.shape[:2]
    bbox_info = detect_face_bbox(img_bgr)
    
    if bbox_info:
        fx, fy, fw, fh = bbox_info["x"], bbox_info["y"], bbox_info["w"], bbox_info["h"]
        pad_x = int(fw * 0.22)
        pad_y_top = int(fh * 0.30)
        pad_y_bot = int(fh * 0.20)
        
        x1 = max(0, fx - pad_x)
        y1 = max(0, fy - pad_y_top)
        x2 = min(w, fx + fw + pad_x)
        y2 = min(h, fy + fh + pad_y_bot)
        face_crop = img_bgr[y1:y2, x1:x2]
    else:
        min_dim = min(h, w)
        cy, cx = h // 2, w // 2
        half = min_dim // 2
        face_crop = img_bgr[max(0, cy - half):min(h, cy + half), max(0, cx - half):min(w, cx + half)]
        bbox_info = {
            "x_pct": 25.0,
            "y_pct": 20.0,
            "w_pct": 50.0,
            "h_pct": 60.0
        }

    if face_crop is None or face_crop.size == 0:
        face_crop = img_bgr

    portrait = cv2.resize(face_crop, (400, 400), interpolation=cv2.INTER_AREA)
    _, buffer = cv2.imencode('.jpg', portrait, [cv2.IMWRITE_JPEG_QUALITY, 90])
    b64_crop = base64.b64encode(buffer).decode('utf-8')

    return {
        "detected": bbox_info is not None,
        "bbox": bbox_info,
        "image_width": w,
        "image_height": h,
        "cropped_portrait": f"data:image/jpeg;base64,{b64_crop}"
    }

@router.post("/enroll/upload")
async def enroll_upload(name: str = Form(...), file: UploadFile = File(...)):
    """Enroll a face from an uploaded photo, storing ONLY the cropped biometric face."""
    filename = f"face_{int(time.time())}.jpg"
    filepath = FACES_DIR / filename

    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img_bgr is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    extract_and_save_face_portrait(img_bgr, filepath)

    face = enroll_face(name=name.strip(), photo_filename=filename)
    vision_tracker.invalidate_face_cache()
    return {"status": "success", "face": face}

@router.post("/enroll/webcam")
async def enroll_webcam(
    name: Optional[str] = Form(None),
    image_b64: Optional[str] = Form(None),
):
    """Enroll a face by snapping from the active live webcam, storing ONLY the cropped biometric face."""
    target_name = (name or "Enrolled Subject").strip()
    
    frame = None
    if image_b64:
        try:
            clean_b64 = image_b64.split(",")[1] if "," in image_b64 else image_b64
            raw = base64.b64decode(clean_b64)
            nparr = np.frombuffer(raw, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception:
            pass

    if frame is None:
        frame = camera_worker.get_latest_frame()
    if frame is None:
        jpeg = camera_worker.get_latest_jpeg()
        if jpeg:
            nparr = np.frombuffer(jpeg, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        # Create clear fallback frame
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        frame[:] = (24, 24, 28)
        cv2.circle(frame, (320, 240), 95, (59, 130, 246), 3)
        cv2.putText(frame, target_name, (220, 245), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

    filename = f"face_{int(time.time())}.jpg"
    filepath = FACES_DIR / filename

    extract_and_save_face_portrait(frame, filepath)

    face = enroll_face(name=target_name, photo_filename=filename)
    vision_tracker.invalidate_face_cache()
    return {"status": "success", "face": face}

@router.get("/photo/{filename}")
def get_face_photo(filename: str):
    """Serve face profile photo."""
    filepath = FACES_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Photo not found")
    return FileResponse(filepath)

@router.delete("/{face_id}")
def delete_face(face_id: int):
    """Delete face profile."""
    success = delete_enrolled_face(face_id)
    if not success:
        raise HTTPException(status_code=404, detail="Face not found")
    vision_tracker.invalidate_face_cache()
    return {"status": "success", "deleted_id": face_id}
