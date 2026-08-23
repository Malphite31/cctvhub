import cv2
import time
import os
import json
import threading
import logging
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
from ..core.config import settings
from ..core.database import log_event, get_db

logger = logging.getLogger("motion_detector")

class MotionDetector:
    """
    Real-time multi-camera motion detector with automated snapshot & video recording triggers.
    """
    def __init__(self):
        self.subtractors: Dict[str, cv2.BackgroundSubtractorMOG2] = {}
        self.last_trigger_times: Dict[str, float] = {}
        self.active_motion_state: Dict[str, bool] = {}
        self.motion_levels: Dict[str, float] = {}
        self.lock = threading.Lock()

    def _get_default_settings(self) -> Dict[str, Any]:
        return {
            "enabled": True,
            "sensitivity": 50, # 1-100
            "action": "both", # "snapshot" | "record" | "both" | "log_only"
            "cooldown_seconds": 10,
            "record_duration_seconds": 15,
            "highlight_boxes": True
        }

    def get_camera_settings(self, camera_id: str = "0") -> Dict[str, Any]:
        cam_str = str(camera_id)
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT value FROM system_config WHERE key = ?", (f"motion_settings_{cam_str}",))
                row = cursor.fetchone()
                if row:
                    loaded = json.loads(row[0])
                    defaults = self._get_default_settings()
                    defaults.update(loaded)
                    return defaults
        except Exception:
            pass
        return self._get_default_settings()

    def update_camera_settings(self, camera_id: str, new_settings: Dict[str, Any]) -> Dict[str, Any]:
        cam_str = str(camera_id)
        current = self.get_camera_settings(cam_str)
        current.update(new_settings)
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)",
                    (f"motion_settings_{cam_str}", json.dumps(current))
                )
                conn.commit()
        except Exception as e:
            logger.warning(f"Error saving motion settings: {e}")
        return current

    def get_status(self, camera_id: str = "0") -> Dict[str, Any]:
        cam_str = str(camera_id)
        return {
            "camera_id": cam_str,
            "is_motion_detected": bool(self.active_motion_state.get(cam_str, False)),
            "motion_level_pct": float(self.motion_levels.get(cam_str, 0.0)),
            "settings": self.get_camera_settings(cam_str)
        }

    def process_motion(self, frame: np.ndarray, camera_id: str = "0") -> Tuple[bool, float, List[Tuple[int, int, int, int]]]:
        """
        Analyzes frame for motion. If triggered and cooldown has passed, executes automated actions.
        Returns: (is_motion, motion_level_pct, motion_bounding_boxes)
        """
        if frame is None or frame.size == 0:
            return False, 0.0, []

        cam_str = str(camera_id)
        cfg = self.get_camera_settings(cam_str)
        if not cfg.get("enabled", False):
            self.active_motion_state[cam_str] = False
            self.motion_levels[cam_str] = 0.0
            return False, 0.0, []

        with self.lock:
            if cam_str not in self.subtractors:
                self.subtractors[cam_str] = cv2.createBackgroundSubtractorMOG2(
                    history=150,
                    varThreshold=16,
                    detectShadows=False
                )
            subtractor = self.subtractors[cam_str]

        h, w = frame.shape[:2]
        
        # Scale down for fast motion analysis
        scale_w = 320
        scale_h = max(10, int(h * (scale_w / float(w))))
        small = cv2.resize(frame, (scale_w, scale_h))
        blurred = cv2.GaussianBlur(small, (5, 5), 0)
        fg_mask = subtractor.apply(blurred)

        # Morphology cleanup
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)
        fg_mask = cv2.dilate(fg_mask, kernel, iterations=2)

        total_pixels = fg_mask.shape[0] * fg_mask.shape[1]
        changed_pixels = cv2.countNonZero(fg_mask)
        motion_pct = round((changed_pixels / float(total_pixels)) * 100.0, 1)
        self.motion_levels[cam_str] = motion_pct

        sensitivity = int(cfg.get("sensitivity", 50))
        # Threshold: high sensitivity (100) triggers at 1.5% pixel change; low (1) requires 25% change
        threshold = max(1.5, 25.0 - (sensitivity * 0.235))

        is_motion = motion_pct >= threshold
        self.active_motion_state[cam_str] = is_motion

        boxes = []
        if is_motion:
            contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            sx = w / float(scale_w)
            sy = h / float(scale_h)
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area > (150 * (100 - sensitivity) / 50.0):
                    bx, by, bw, bh = cv2.boundingRect(cnt)
                    boxes.append((int(bx * sx), int(by * sy), int(bw * sx), int(bh * sy)))

            # Check trigger cooldown
            now = time.time()
            cooldown = int(cfg.get("cooldown_seconds", 10))
            last_t = self.last_trigger_times.get(cam_str, 0.0)

            if now - last_t >= cooldown:
                self.last_trigger_times[cam_str] = now
                self._execute_motion_actions(frame.copy(), cam_str, cfg, motion_pct)

        return is_motion, motion_pct, boxes

    def _execute_motion_actions(self, frame_copy: np.ndarray, camera_id: str, cfg: Dict[str, Any], motion_pct: float):
        """Dispatches automated snapshot and/or video recording in a background thread."""
        def _worker():
            action = cfg.get("action", "both").lower()
            ts = int(time.time())
            snap_url = ""
            clip_url = ""

            # 1. Capture Automated Snapshot
            if action in ["snapshot", "both"]:
                try:
                    snap_dir = settings.SNAPSHOTS_DIR
                    snap_dir.mkdir(parents=True, exist_ok=True)
                    snap_filename = f"motion_cam{camera_id}_{ts}.jpg"
                    snap_path = snap_dir / snap_filename
                    cv2.imwrite(str(snap_path), frame_copy, [cv2.IMWRITE_JPEG_QUALITY, 90])
                    if snap_path.exists() and snap_path.stat().st_size > 0:
                        snap_url = f"/api/recordings/snapshots/{snap_filename}"
                except Exception as e:
                    logger.error(f"Error saving motion snapshot: {e}")

            # 2. Capture Automated Video Recording
            if action in ["record", "both"]:
                try:
                    duration = int(cfg.get("record_duration_seconds", 15))
                    from .dvr_manager import dvr_manager
                    clip_filename = f"motion_cam{camera_id}_{ts}.mp4"
                    dvr_manager.record_clip(camera_id=camera_id, filename=clip_filename, duration_seconds=duration)
                    clip_url = f"/api/recordings/video/{clip_filename}"
                except Exception as e:
                    logger.error(f"Error recording motion clip: {e}")

            # 3. Log Surveillance Event
            try:
                title = f"Motion Detected - CAM {camera_id}"
                details = f"Motion intensity {motion_pct}%. Trigger: {action.upper()}."
                log_event(
                    event_type="motion",
                    camera_id=f"CAM {camera_id}",
                    title=title,
                    details=details,
                    thumbnail_url=snap_url,
                    clip_url=clip_url
                )
            except Exception as e:
                logger.error(f"Error logging motion event: {e}")

        t = threading.Thread(target=_worker, daemon=True)
        t.start()

motion_detector = MotionDetector()
