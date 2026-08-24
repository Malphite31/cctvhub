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

def _normalize_id(cid: Any) -> str:
    s = str(cid).strip()
    if s.startswith("/dev/video"):
        return s.replace("/dev/video", "")
    if s.lower().startswith("cam "):
        return s[4:].strip()
    return s

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
            "enabled": False, # Disabled by default per camera until explicitly activated
            "sensitivity": 50, # 1-100
            "action": "both", # "snapshot" | "record" | "both" | "log_only"
            "cooldown_seconds": 10,
            "record_duration_seconds": 15,
            "highlight_boxes": True
        }

    def get_camera_settings(self, camera_id: str = "0") -> Dict[str, Any]:
        norm_id = _normalize_id(camera_id)
        raw_id = str(camera_id)
        for check_key in [f"motion_settings_{norm_id}", f"motion_settings_{raw_id}"]:
            try:
                with get_db() as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT value FROM system_config WHERE key = ?", (check_key,))
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
        norm_id = _normalize_id(camera_id)
        raw_id = str(camera_id)
        current = self.get_camera_settings(norm_id)
        current.update(new_settings)
        val = json.dumps(current)
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)",
                    (f"motion_settings_{norm_id}", val)
                )
                if raw_id != norm_id:
                    cursor.execute(
                        "INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)",
                        (f"motion_settings_{raw_id}", val)
                    )
                conn.commit()
        except Exception as e:
            logger.warning(f"Error saving motion settings: {e}")
        return current

    def get_status(self, camera_id: str = "0") -> Dict[str, Any]:
        norm_id = _normalize_id(camera_id)
        raw_id = str(camera_id)
        is_active = bool(self.active_motion_state.get(norm_id, False) or self.active_motion_state.get(raw_id, False))
        level = float(self.motion_levels.get(norm_id, self.motion_levels.get(raw_id, 0.0)))
        return {
            "camera_id": norm_id,
            "is_motion_detected": is_active,
            "motion_level_pct": level,
            "settings": self.get_camera_settings(norm_id)
        }

    def process_motion(self, frame: np.ndarray, camera_id: str = "0") -> Tuple[bool, float, List[Tuple[int, int, int, int]]]:
        """
        Analyzes frame for motion. If triggered and cooldown has passed, executes automated actions.
        Returns: (is_motion, motion_level_pct, motion_bounding_boxes)
        """
        if frame is None or frame.size == 0:
            return False, 0.0, []

        norm_id = _normalize_id(camera_id)
        raw_id = str(camera_id)
        cfg = self.get_camera_settings(norm_id)
        if not cfg.get("enabled", False):
            self.active_motion_state[norm_id] = False
            self.active_motion_state[raw_id] = False
            self.motion_levels[norm_id] = 0.0
            return False, 0.0, []

        with self.lock:
            if norm_id not in self.subtractors:
                self.subtractors[norm_id] = cv2.createBackgroundSubtractorMOG2(
                    history=200,
                    varThreshold=20,
                    detectShadows=False
                )
            subtractor = self.subtractors[norm_id]

        h, w = frame.shape[:2]
        
        # Scale down for fast, noise-free motion analysis
        scale_w = 320
        scale_h = max(10, int(h * (scale_w / float(w))))
        small = cv2.resize(frame, (scale_w, scale_h))
        blurred = cv2.GaussianBlur(small, (5, 5), 0)
        fg_mask = subtractor.apply(blurred, learningRate=-1)

        # Morphology cleanup
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)
        fg_mask = cv2.dilate(fg_mask, kernel, iterations=2)

        total_pixels = fg_mask.shape[0] * fg_mask.shape[1]
        changed_pixels = cv2.countNonZero(fg_mask)
        motion_pct = round((changed_pixels / float(total_pixels)) * 100.0, 1)
        self.motion_levels[norm_id] = motion_pct
        self.motion_levels[raw_id] = motion_pct

        sensitivity = int(cfg.get("sensitivity", 50))
        # Threshold: high sensitivity (100) triggers at 0.5% pixel change; medium (50) at 6.0%; low (1) at 15.0%
        threshold = max(0.5, 15.0 - (sensitivity * 0.145))

        is_motion = motion_pct >= threshold
        self.active_motion_state[norm_id] = is_motion
        self.active_motion_state[raw_id] = is_motion

        boxes = []
        if is_motion:
            contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            sx = w / float(scale_w)
            sy = h / float(scale_h)
            min_area = max(40, int(200 * (100 - sensitivity) / 100.0))
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area >= min_area:
                    bx, by, bw, bh = cv2.boundingRect(cnt)
                    boxes.append((int(bx * sx), int(by * sy), int(bw * sx), int(bh * sy)))

            # Check trigger cooldown
            now = time.time()
            cooldown = int(cfg.get("cooldown_seconds", 10))
            last_t = self.last_trigger_times.get(norm_id, 0.0)

            if now - last_t >= cooldown:
                self.last_trigger_times[norm_id] = now
                self.last_trigger_times[raw_id] = now
                self._execute_motion_actions(frame.copy(), norm_id, cfg, motion_pct)

        return is_motion, motion_pct, boxes

    def _execute_motion_actions(self, frame_copy: np.ndarray, camera_id: str, cfg: Dict[str, Any], motion_pct: float):
        """Dispatches automated snapshot and/or video recording in a background thread."""
        def _worker():
            from .dvr_manager import dvr_manager
            action = cfg.get("action", "both").lower()
            ts = int(time.time())
            snap_url = ""
            clip_url = ""

            # 1. Capture Automated Snapshot
            if action in ["snapshot", "both"]:
                try:
                    snap_dir = dvr_manager.get_snapshots_dir()
                    snap_filename = f"motion_cam{camera_id}_{ts}.jpg"
                    snap_path = snap_dir / snap_filename
                    cv2.imwrite(str(snap_path), frame_copy, [cv2.IMWRITE_JPEG_QUALITY, 90])
                    if snap_path.exists() and snap_path.stat().st_size > 0:
                        snap_url = f"/api/recordings/snapshots/{snap_filename}"
                        dvr_manager._auto_sync(snap_path)
                except Exception as e:
                    logger.error(f"Error saving motion snapshot: {e}")

            # 2. Capture Automated Video Recording
            if action in ["record", "both"]:
                try:
                    duration = int(cfg.get("record_duration_seconds", 15))
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
