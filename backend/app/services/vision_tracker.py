import cv2
import time
import os
import json
import math
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import logging
from ..core.config import settings
from ..core.database import (
    log_event,
    list_enrolled_faces,
    FACES_DIR,
    list_custom_trackers,
    update_tracker_state,
    get_db
)
from .motion_detector import motion_detector

logger = logging.getLogger("vision_tracker")

def hex_to_bgr(hex_str: str) -> Tuple[int, int, int]:
    try:
        hex_clean = hex_str.lstrip('#')
        if len(hex_clean) == 6:
            r = int(hex_clean[0:2], 16)
            g = int(hex_clean[2:4], 16)
            b = int(hex_clean[4:6], 16)
            return (b, g, r)
    except Exception:
        pass
    return (246, 130, 59) # default blue


class CustomZoneAnalyzer:
    """Maintains background models and analyzes state changes (e.g. Door Opened, Intrusion) for user-defined zones."""
    def __init__(self):
        self.roi_subtractors: Dict[int, cv2.BackgroundSubtractorMOG2] = {}
        self.last_trigger_times: Dict[int, float] = {}

    def analyze_roi(self, tracker_id: int, roi_crop: np.ndarray, sensitivity: int = 60) -> Tuple[bool, float]:
        if roi_crop is None or roi_crop.size == 0:
            return False, 0.0

        if tracker_id not in self.roi_subtractors:
            self.roi_subtractors[tracker_id] = cv2.createBackgroundSubtractorMOG2(
                history=120,
                varThreshold=16,
                detectShadows=False
            )

        subtractor = self.roi_subtractors[tracker_id]
        small_roi = cv2.resize(roi_crop, (120, 120))
        blurred = cv2.GaussianBlur(small_roi, (5, 5), 0)
        fg_mask = subtractor.apply(blurred)

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, kernel)

        total_pixels = fg_mask.shape[0] * fg_mask.shape[1]
        changed_pixels = cv2.countNonZero(fg_mask)
        delta_pct = round((changed_pixels / float(total_pixels)) * 100.0, 1)

        # Threshold based on sensitivity (20% -> 95%)
        # High sensitivity = triggers with as low as 3.5% shift; Low = requires 20% shift
        threshold = max(3.5, 22.0 - (sensitivity * 0.20))

        is_triggered = delta_pct >= threshold
        return is_triggered, delta_pct


def _normalize_id(cid: Any) -> str:
    s = str(cid).strip()
    if s.startswith("/dev/video"):
        return s.replace("/dev/video", "")
    if s.lower().startswith("cam "):
        return s[4:].strip()
    return s


class VisionTracker:
    """
    Tactical Vision HUD & Biometric Face Tracker with dynamic scanline visualization.
    """
    def __init__(self):
        self._default_settings = {
            "enabled": True,
            "show_bounding_boxes": True,
            "show_corner_markers": True,
            "show_center_reticles": True,
            "show_metadata_tags": True,
            "show_motion_vectors": True,
            "detect_faces": False, # Disabled by default for ultra-low CPU utilization
            "detect_motion": False, # Disabled by default per camera until explicitly activated
            "hud_theme": "cyber_blue",
        }
        self.camera_settings: Dict[str, Dict[str, Any]] = {}

        # Classifiers
        self.face_cascade = None
        self.profile_cascade = None
        self._init_classifiers()

        # Custom Zone Analyzer
        self.zone_analyzer = CustomZoneAnalyzer()

        # Cache for enrolled face templates
        self.enrolled_cache = []
        self._last_face_reload = 0
        self._reload_enrolled_faces()

        # Cache for custom trackers strictly partitioned by camera_id
        self.cached_custom_trackers_by_cam: Dict[str, List[Dict[str, Any]]] = {}
        self._last_tracker_reload_by_cam: Dict[str, float] = {}

        # Performance optimization caches (Frame-skipping & downscaled inference)
        self._frame_counts_by_cam: Dict[str, int] = {}
        self._cached_face_detections_by_cam: Dict[str, List[Dict[str, Any]]] = {}
        self._cached_rendered_face_data_by_cam: Dict[str, List[Dict[str, Any]]] = {}
        self._cached_tracker_renders_by_cam: Dict[str, List[Dict[str, Any]]] = {}
        self._cached_tracker_detections_by_cam: Dict[str, List[Dict[str, Any]]] = {}

        # Event logging cooldowns
        self._last_logged_events = {}

    def _load_persisted_settings(self):
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT value FROM system_config WHERE key = 'vision_tracker_settings'")
                row = cursor.fetchone()
                if row and row[0]:
                    data = json.loads(row[0])
                    if "enabled" in data: self.enabled = bool(data["enabled"])
                    if "show_bounding_boxes" in data: self.show_bounding_boxes = bool(data["show_bounding_boxes"])
                    if "show_corner_markers" in data: self.show_corner_markers = bool(data["show_corner_markers"])
                    if "show_center_reticles" in data: self.show_center_reticles = bool(data["show_center_reticles"])
                    if "show_metadata_tags" in data: self.show_metadata_tags = bool(data["show_metadata_tags"])
                    if "show_motion_vectors" in data: self.show_motion_vectors = bool(data["show_motion_vectors"])
                    if "detect_faces" in data: self.detect_faces = bool(data["detect_faces"])
                    if "detect_motion" in data: self.detect_motion = bool(data["detect_motion"])
                    if "hud_theme" in data: self.hud_theme = str(data["hud_theme"])
        except Exception:
            pass

    def _init_classifiers(self):
        try:
            cascade_dir = Path(cv2.data.haarcascades)
            face_path = cascade_dir / "haarcascade_frontalface_default.xml"
            if face_path.exists():
                self.face_cascade = cv2.CascadeClassifier(str(face_path))
            profile_path = cascade_dir / "haarcascade_profileface.xml"
            if profile_path.exists():
                self.profile_cascade = cv2.CascadeClassifier(str(profile_path))
        except Exception as e:
            logger.warning(f"Error loading cascade classifiers: {e}")

    def _reload_enrolled_faces(self):
        now = time.time()
        if now - self._last_face_reload < 2:
            return
        self._last_face_reload = now
        try:
            db_faces = list_enrolled_faces()
            cache = []
            for face_entry in db_faces:
                photo_name = face_entry.get("photo_path")
                if photo_name:
                    p = FACES_DIR / photo_name
                    if p.exists():
                        img = cv2.imread(str(p))
                        if img is not None:
                            img_hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
                            hist = cv2.calcHist([img_hsv], [0, 1], None, [18, 25], [0, 180, 0, 256])
                            cv2.normalize(hist, hist, 0, 1, cv2.NORM_MINMAX)
                            cache.append({
                                "id": face_entry.get("id"),
                                "name": face_entry.get("name", "Unknown"),
                                "hist": hist
                            })
            self.enrolled_cache = cache
        except Exception:
            pass

    def invalidate_face_cache(self):
        """Immediately reloads enrolled face database."""
        self._last_face_reload = 0
        self._reload_enrolled_faces()

    def invalidate_cache(self, camera_id: Optional[str] = None):
        """Immediately invalidates custom tracker cache so edits take effect without delay."""
        if camera_id is not None:
            cam_str = str(camera_id)
            self._last_tracker_reload_by_cam.pop(cam_str, None)
            self.cached_custom_trackers_by_cam.pop(cam_str, None)
        else:
            self._last_tracker_reload_by_cam.clear()
            self.cached_custom_trackers_by_cam.clear()

    def _reload_custom_trackers(self, camera_id: str):
        cam_str = str(camera_id)
        now = time.time()
        if now - self._last_tracker_reload_by_cam.get(cam_str, 0) < 1.0:
            return
        self._last_tracker_reload_by_cam[cam_str] = now
        try:
            self.cached_custom_trackers_by_cam[cam_str] = list_custom_trackers(camera_id=cam_str)
        except Exception:
            pass

    def update_settings(self, settings_dict: Dict[str, Any], camera_id: Optional[str] = None) -> Dict[str, Any]:
        target_id = settings_dict.get("camera_id") or settings_dict.get("dev") or camera_id or "0"
        norm_id = _normalize_id(target_id)
        current = self.get_settings(norm_id)
        for k in ["enabled", "show_bounding_boxes", "show_corner_markers", "show_center_reticles",
                  "show_metadata_tags", "show_motion_vectors", "detect_faces", "detect_motion", "hud_theme"]:
            if k in settings_dict:
                current[k] = settings_dict[k]

        self.camera_settings[norm_id] = current

        # Persist to database per camera
        try:
            val = json.dumps(current)
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)",
                    (f"vision_tracker_settings_{norm_id}", val)
                )
                conn.commit()
        except Exception as e:
            logger.warning(f"Error saving vision tracker settings for camera {norm_id}: {e}")

        return dict(current)

    def get_settings(self, camera_id: Optional[str] = None) -> Dict[str, Any]:
        norm_id = _normalize_id(camera_id if camera_id is not None else "0")
        if norm_id in self.camera_settings:
            return dict(self.camera_settings[norm_id])

        # Try to load from database
        for check_key in [f"vision_tracker_settings_{norm_id}", "vision_tracker_settings"]:
            try:
                with get_db() as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT value FROM system_config WHERE key = ?", (check_key,))
                    row = cursor.fetchone()
                    if row and row[0]:
                        data = json.loads(row[0])
                        cfg = dict(self._default_settings)
                        cfg.update(data)
                        self.camera_settings[norm_id] = cfg
                        return cfg
            except Exception:
                pass

        cfg = dict(self._default_settings)
        self.camera_settings[norm_id] = cfg
        return cfg

    def process_frame(self, frame: np.ndarray, camera_id: str = "0") -> Tuple[np.ndarray, List[Dict[str, Any]]]:
        """
        Processes frame for custom-selected objects/zones and biometric face scanning.
        Optimized with downscaled Haar inference and frame-skipping for ultra-low CPU utilization.
        """
        cam_str = _normalize_id(camera_id)
        cfg = self.get_settings(cam_str)

        if frame is None or not cfg.get("enabled", True):
            return frame, []

        h, w = frame.shape[:2]
        self._reload_custom_trackers(cam_str)
        self._reload_enrolled_faces()

        frame_idx = self._frame_counts_by_cam.get(cam_str, 0)
        self._frame_counts_by_cam[cam_str] = frame_idx + 1

        annotated_frame = frame.copy()
        active_detections = []

        # 1. Biometric Facial Recognition & Tactical Scanline Visualization (Every 4th frame, downscaled to 360px)
        if cfg.get("detect_faces", False) and self.face_cascade is not None:
            should_run_face = (frame_idx % 4 == 0) or (cam_str not in self._cached_rendered_face_data_by_cam)

            if should_run_face:
                det_w = 360
                det_h = max(10, int(h * (det_w / float(w))))
                gray_full = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                small_gray = cv2.resize(gray_full, (det_w, det_h))

                scale_x = w / float(det_w)
                scale_y = h / float(det_h)

                min_dim = max(20, int(45 * (det_w / float(w))))
                faces_small = self.face_cascade.detectMultiScale(
                    small_gray,
                    scaleFactor=1.2,
                    minNeighbors=4,
                    minSize=(min_dim, min_dim)
                )

                face_renders = []
                face_dets = []

                for (sfx, sfy, sfw, sfh) in faces_small:
                    fx = int(sfx * scale_x)
                    fy = int(sfy * scale_y)
                    fw = int(sfw * scale_x)
                    fh = int(sfh * scale_y)

                    face_roi = frame[fy:fy+fh, fx:fx+fw]
                    matched_name = "Unknown"
                    max_score = 0.0
                    is_matched = False

                    if face_roi.size > 0 and len(self.enrolled_cache) > 0:
                        try:
                            roi_hsv = cv2.cvtColor(face_roi, cv2.COLOR_BGR2HSV)
                            roi_hist = cv2.calcHist([roi_hsv], [0, 1], None, [18, 25], [0, 180, 0, 256])
                            cv2.normalize(roi_hist, roi_hist, 0, 1, cv2.NORM_MINMAX)

                            for enrolled in self.enrolled_cache:
                                score = cv2.compareHist(enrolled["hist"], roi_hist, cv2.HISTCMP_CORREL)
                                if score > max_score:
                                    max_score = score
                                    matched_name = enrolled["name"]
                                    if score >= 0.65:
                                        is_matched = True
                        except Exception:
                            pass

                    conf_pct = int(max(75, min(99, max_score * 100))) if is_matched else 0

                    face_renders.append({
                        "fx": fx, "fy": fy, "fw": fw, "fh": fh,
                        "name": matched_name if is_matched else "Unenrolled Subject",
                        "confidence": conf_pct,
                        "is_matched": is_matched
                    })

                    face_dets.append({
                        "id": f"face_{fx}_{fy}",
                        "name": matched_name if is_matched else "Face Subject",
                        "action_label": "Biometric Face Recognized" if is_matched else "Face Scan",
                        "trigger_type": "face",
                        "state": f"MATCH: {conf_pct}%" if is_matched else "SCANNING",
                        "is_triggered": is_matched,
                        "x": int((fx / w) * 100),
                        "y": int((fy / h) * 100),
                        "width": int((fw / w) * 100),
                        "height": int((fh / h) * 100),
                        "color": "#10B981" if is_matched else "#3B82F6"
                    })

                self._cached_rendered_face_data_by_cam[cam_str] = face_renders
                self._cached_face_detections_by_cam[cam_str] = face_dets

            # Render cached face overlays
            for item in self._cached_rendered_face_data_by_cam.get(cam_str, []):
                self._render_face_biometric_hud(
                    annotated_frame,
                    item["fx"], item["fy"], item["fw"], item["fh"],
                    name=item["name"],
                    confidence=item["confidence"],
                    is_matched=item["is_matched"],
                    frame_w=w,
                    frame_h=h
                )

            active_detections.extend(self._cached_face_detections_by_cam.get(cam_str, []))

        # 2. Process Custom User-Defined Object Trackers for THIS camera only (Every 3rd frame)
        camera_trackers = self.cached_custom_trackers_by_cam.get(cam_str, [])
        should_run_zone = (frame_idx % 3 == 0) or (cam_str not in self._cached_tracker_renders_by_cam)

        if should_run_zone:
            tracker_renders = []
            tracker_dets = []

            for tracker in camera_trackers:
                if not tracker.get("is_active", 1):
                    continue
                if str(tracker.get("camera_id", "0")) != cam_str:
                    continue

                tracker_id = tracker["id"]
                name = tracker["name"]
                action_label = tracker["action_label"]
                trigger_type = tracker.get("trigger_type", "door_open")
                sensitivity = tracker.get("sensitivity", 60)
                user_color_hex = tracker.get("color", "#3B82F6")

                rx = tracker["x"]
                ry = tracker["y"]
                rw = tracker["width"]
                rh = tracker["height"]

                if rx <= 100 and rw <= 100:
                    bx = int((rx / 100.0) * w)
                    by = int((ry / 100.0) * h)
                    bw = int((rw / 100.0) * w)
                    bh = int((rh / 100.0) * h)
                else:
                    bx = int(rx)
                    by = int(ry)
                    bw = int(rw)
                    bh = int(rh)

                bx = max(0, min(w - 10, bx))
                by = max(0, min(h - 10, by))
                bw = max(10, min(w - bx, bw))
                bh = max(10, min(h - by, bh))

                roi = frame[by:by+bh, bx:bx+bw]
                is_triggered, delta_pct = self.zone_analyzer.analyze_roi(tracker_id, roi, sensitivity=sensitivity)

                if is_triggered:
                    state_str = "OPEN DETECTED" if trigger_type == "door_open" else "TRIGGERED"
                    color_bgr = (68, 68, 239)
                    update_tracker_state(tracker_id, state=state_str, last_triggered=int(time.time()))
                else:
                    state_str = "CLOSED" if trigger_type == "door_open" else "NORMAL"
                    color_bgr = hex_to_bgr(user_color_hex)
                    update_tracker_state(tracker_id, state=state_str)

                tracker_renders.append({
                    "bx": bx, "by": by, "bw": bw, "bh": bh,
                    "name": name,
                    "action_label": action_label,
                    "state": state_str,
                    "is_triggered": is_triggered,
                    "color": color_bgr,
                    "tracker_id": tracker_id,
                    "trigger_type": trigger_type,
                    "delta_pct": delta_pct,
                    "user_color_hex": user_color_hex
                })

                tracker_dets.append({
                    "id": str(tracker_id),
                    "name": name,
                    "action_label": action_label,
                    "trigger_type": trigger_type,
                    "state": state_str,
                    "is_triggered": is_triggered,
                    "delta": delta_pct,
                    "x": bx,
                    "y": by,
                    "width": bw,
                    "height": bh,
                    "color": user_color_hex
                })

            self._cached_tracker_renders_by_cam[cam_str] = tracker_renders
            self._cached_tracker_detections_by_cam[cam_str] = tracker_dets

        # Render cached custom tracker overlays
        for t_item in self._cached_tracker_renders_by_cam.get(cam_str, []):
            self._render_custom_tracker_hud(
                annotated_frame,
                t_item["bx"], t_item["by"], t_item["bw"], t_item["bh"],
                name=t_item["name"],
                action_label=t_item["action_label"],
                state=t_item["state"],
                is_triggered=t_item["is_triggered"],
                color=t_item["color"],
                frame_w=w,
                frame_h=h
            )
            if t_item["is_triggered"] and should_run_zone:
                self._maybe_log_custom_event(
                    tracker_id=t_item["tracker_id"],
                    camera_id=camera_id,
                    name=t_item["name"],
                    action_label=t_item["action_label"],
                    state=t_item["state"],
                    delta_pct=t_item["delta_pct"],
                    annotated_full_frame=annotated_frame
                )

        active_detections.extend(self._cached_tracker_detections_by_cam.get(cam_str, []))

        # 3. Motion Detection & Automated Triggers (Every 3rd frame)
        should_run_motion = (frame_idx % 3 == 0)
        if should_run_motion:
            is_motion, motion_pct, motion_boxes = motion_detector.process_motion(frame, camera_id=cam_str)
            if is_motion:
                cfg = motion_detector.get_camera_settings(cam_str)
                if cfg.get("highlight_boxes", True):
                    for (mx, my, mw, mh) in motion_boxes:
                        self._render_motion_box_hud(annotated_frame, mx, my, mw, mh, motion_pct)
                        active_detections.append({
                            "id": f"motion_{mx}_{my}",
                            "name": f"Motion ({motion_pct}%)",
                            "action_label": f"Trigger: {cfg.get('action', 'both').upper()}",
                            "trigger_type": "motion",
                            "state": "ACTIVE",
                            "is_triggered": True,
                            "delta": motion_pct,
                            "x": mx,
                            "y": my,
                            "width": mw,
                            "height": mh,
                            "color": "#EF4444"
                        })

        return annotated_frame, active_detections

    def _render_motion_box_hud(self, img: np.ndarray, mx: int, my: int, mw: int, mh: int, motion_pct: float):
        """Renders tactical amber/gold motion indicator box on live video stream."""
        color = (11, 158, 245) # Amber/Gold in BGR (0x0B, 0x9E, 0xF5)
        # Wireframe box
        cv2.rectangle(img, (mx, my), (mx + mw, my + mh), color, 1, cv2.LINE_AA)
        
        # Corner brackets
        blen = min(16, max(6, int(min(mw, mh) * 0.25)))
        cv2.line(img, (mx, my), (mx + blen, my), color, 2, cv2.LINE_AA)
        cv2.line(img, (mx, my), (mx, my + blen), color, 2, cv2.LINE_AA)
        cv2.line(img, (mx + mw, my), (mx + mw - blen, my), color, 2, cv2.LINE_AA)
        cv2.line(img, (mx + mw, my), (mx + mw, my + blen), color, 2, cv2.LINE_AA)
        cv2.line(img, (mx, my + mh), (mx + blen, my + mh), color, 2, cv2.LINE_AA)
        cv2.line(img, (mx, my + mh), (mx, my + mh - blen), color, 2, cv2.LINE_AA)
        cv2.line(img, (mx + mw, my + mh), (mx + mw - blen, my + mh), color, 2, cv2.LINE_AA)
        cv2.line(img, (mx + mw, my + mh), (mx + mw, my + mh - blen), color, 2, cv2.LINE_AA)

        # Label tag
        tag = f"MOTION {motion_pct}%"
        cv2.putText(img, tag, (mx + 4, max(14, my - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 0, 0), 2, cv2.LINE_AA)
        cv2.putText(img, tag, (mx + 4, max(14, my - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.38, color, 1, cv2.LINE_AA)

    def _render_face_biometric_hud(
        self,
        img: np.ndarray,
        fx: int, fy: int, fw: int, fh: int,
        name: str,
        confidence: int,
        is_matched: bool,
        frame_w: int,
        frame_h: int
    ):
        """
        Renders an ultra-modern biometric HUD with animated vertical laser scanline,
        corner reticles, facial landmark points, and identification tags.
        """
        color = (113, 204, 46) if is_matched else (246, 130, 59) # Emerald vs Cyber Blue
        
        # 1. Subtle semi-transparent face mesh background
        overlay = img.copy()
        cv2.rectangle(overlay, (fx, fy), (fx + fw, fy + fh), color, -1)
        cv2.addWeighted(overlay, 0.08, img, 0.92, 0, img)

        # 2. Outer Wireframe Box
        cv2.rectangle(img, (fx, fy), (fx + fw, fy + fh), color, 1, cv2.LINE_AA)

        # 3. High-Tech Corner Brackets
        bracket_len = min(22, max(8, int(min(fw, fh) * 0.22)))
        thick = 2
        # Top-Left
        cv2.line(img, (fx, fy), (fx + bracket_len, fy), color, thick, cv2.LINE_AA)
        cv2.line(img, (fx, fy), (fx, fy + bracket_len), color, thick, cv2.LINE_AA)
        # Top-Right
        cv2.line(img, (fx + fw, fy), (fx + fw - bracket_len, fy), color, thick, cv2.LINE_AA)
        cv2.line(img, (fx + fw, fy), (fx + fw, fy + bracket_len), color, thick, cv2.LINE_AA)
        # Bottom-Left
        cv2.line(img, (fx, fy + fh), (fx + bracket_len, fy + fh), color, thick, cv2.LINE_AA)
        cv2.line(img, (fx, fy + fh), (fx, fy + fh - bracket_len), color, thick, cv2.LINE_AA)
        # Bottom-Right
        cv2.line(img, (fx + fw, fy + fh), (fx + fw - bracket_len, fy + fh), color, thick, cv2.LINE_AA)
        cv2.line(img, (fx + fw, fy + fh), (fx + fw, fy + fh - bracket_len), color, thick, cv2.LINE_AA)

        # 4. Animated Biometric Laser Scanline Sweeping Vertically
        sweep = (math.sin(time.time() * 4.5) + 1.0) * 0.5
        scan_y = fy + int(sweep * fh)
        scan_y = max(fy + 2, min(fy + fh - 2, scan_y))
        
        # Scanline beam
        laser_color = (200, 255, 100) if is_matched else (255, 220, 120)
        cv2.line(img, (fx + 2, scan_y), (fx + fw - 2, scan_y), laser_color, 2, cv2.LINE_AA)

        # 5. Biometric Facial Landmark Target Points
        p_left_eye = (int(fx + fw * 0.32), int(fy + fh * 0.38))
        p_right_eye = (int(fx + fw * 0.68), int(fy + fh * 0.38))
        p_nose = (int(fx + fw * 0.50), int(fy + fh * 0.58))
        p_mouth_l = (int(fx + fw * 0.36), int(fy + fh * 0.78))
        p_mouth_r = (int(fx + fw * 0.64), int(fy + fh * 0.78))

        for pt in [p_left_eye, p_right_eye, p_nose, p_mouth_l, p_mouth_r]:
            cv2.circle(img, pt, 2, color, -1, cv2.LINE_AA)
            cv2.circle(img, pt, 5, color, 1, cv2.LINE_AA)

        # Connect landmarks with faint cyber contour lines
        cv2.line(img, p_left_eye, p_right_eye, color, 1, cv2.LINE_AA)
        cv2.line(img, p_left_eye, p_nose, color, 1, cv2.LINE_AA)
        cv2.line(img, p_right_eye, p_nose, color, 1, cv2.LINE_AA)
        cv2.line(img, p_nose, p_mouth_l, color, 1, cv2.LINE_AA)
        cv2.line(img, p_nose, p_mouth_r, color, 1, cv2.LINE_AA)
        cv2.line(img, p_mouth_l, p_mouth_r, color, 1, cv2.LINE_AA)

        # 6. Biometric Header Badge
        if is_matched:
            tag_text = f"[BIO-ID: {name.upper()} • {confidence}%]"
        else:
            tag_text = "[BIO-SCAN: UNENROLLED SUBJECT]"

        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.40
        (tw, th), _ = cv2.getTextSize(tag_text, font, font_scale, 1)

        badge_y = max(th + 6, fy - 6)
        pt1 = (fx, badge_y - th - 5)
        pt2 = (fx + tw + 10, badge_y + 2)

        cv2.rectangle(img, pt1, pt2, (12, 12, 12), -1)
        cv2.rectangle(img, pt1, pt2, color, 1)
        text_col = (255, 255, 255) if is_matched else (220, 220, 220)
        cv2.putText(img, tag_text, (fx + 5, badge_y - 2), font, font_scale, text_col, 1, cv2.LINE_AA)

        # Subtitle below face
        sub_text = "CONTOUR: LOCKED • BIO-MESH 60FPS" if is_matched else "TRACKING FACIAL MESH"
        cv2.putText(img, sub_text, (fx, min(frame_h - 4, fy + fh + 12)), font, 0.32, (180, 180, 180), 1, cv2.LINE_AA)

    def _render_custom_tracker_hud(
        self,
        img: np.ndarray,
        x: int, y: int, w: int, h: int,
        name: str,
        action_label: str,
        state: str,
        is_triggered: bool,
        color: Tuple[int, int, int],
        frame_w: int,
        frame_h: int
    ):
        overlay = img.copy()
        fill_alpha = 0.20 if is_triggered else 0.08
        cv2.rectangle(overlay, (x, y), (x + w, y + h), color, -1)
        cv2.addWeighted(overlay, fill_alpha, img, 1.0 - fill_alpha, 0, img)

        thickness = 2 if is_triggered else 1
        cv2.rectangle(img, (x, y), (x + w, y + h), color, thickness, cv2.LINE_AA)

        if self.show_corner_markers:
            bracket_len = min(28, max(12, int(min(w, h) * 0.25)))
            bracket_thick = 3 if is_triggered else 2
            cv2.line(img, (x, y), (x + bracket_len, y), color, bracket_thick, cv2.LINE_AA)
            cv2.line(img, (x, y), (x, y + bracket_len), color, bracket_thick, cv2.LINE_AA)
            cv2.line(img, (x + w, y), (x + w - bracket_len, y), color, bracket_thick, cv2.LINE_AA)
            cv2.line(img, (x + w, y), (x + w, y + bracket_len), color, bracket_thick, cv2.LINE_AA)
            cv2.line(img, (x, y + h), (x + bracket_len, y + h), color, bracket_thick, cv2.LINE_AA)
            cv2.line(img, (x, y + h), (x, y + h - bracket_len), color, bracket_thick, cv2.LINE_AA)
            cv2.line(img, (x + w, y + h), (x + w - bracket_len, y + h), color, bracket_thick, cv2.LINE_AA)
            cv2.line(img, (x + w, y + h), (x + w, y + h - bracket_len), color, bracket_thick, cv2.LINE_AA)

        if self.show_center_reticles:
            cx, cy = x + w // 2, y + h // 2
            ret_len = 8
            cv2.circle(img, (cx, cy), 2, color, -1, cv2.LINE_AA)
            cv2.line(img, (cx - ret_len, cy), (cx + ret_len, cy), color, 1, cv2.LINE_AA)
            cv2.line(img, (cx, cy - ret_len), (cx, cy + ret_len), color, 1, cv2.LINE_AA)

        if self.show_metadata_tags:
            tag_text = f"[{name.upper()}] {state}"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.44
            (text_w, text_h), _ = cv2.getTextSize(tag_text, font, font_scale, 1)

            badge_y = max(text_h + 8, y - 6)
            badge_bg_pt1 = (x, badge_y - text_h - 6)
            badge_bg_pt2 = (x + text_w + 12, badge_y + 2)

            cv2.rectangle(img, badge_bg_pt1, badge_bg_pt2, (15, 15, 15), -1)
            cv2.rectangle(img, badge_bg_pt1, badge_bg_pt2, color, 1)

            text_color = (255, 255, 255) if not is_triggered else (100, 100, 255)
            cv2.putText(img, tag_text, (x + 6, badge_y - 3), font, font_scale, text_color, 1, cv2.LINE_AA)

            sub_text = f"ACTION: {action_label}"
            cv2.putText(img, sub_text, (x, min(frame_h - 6, y + h + 14)), font, 0.35, (180, 180, 180), 1, cv2.LINE_AA)

    def _maybe_log_custom_event(
        self,
        tracker_id: int,
        camera_id: str,
        name: str,
        action_label: str,
        state: str,
        delta_pct: float,
        annotated_full_frame: np.ndarray
    ):
        key = f"custom_{tracker_id}_{state}"
        now = time.time()
        last_time = self._last_logged_events.get(key, 0)

        if now - last_time < 10.0:
            return

        self._last_logged_events[key] = now

        try:
            settings.SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)
            thumb_name = f"tracker_{int(now)}_{tracker_id}.jpg"
            thumb_path = settings.SNAPSHOTS_DIR / thumb_name

            cv2.imwrite(str(thumb_path), annotated_full_frame, [cv2.IMWRITE_JPEG_QUALITY, 92])
            thumb_url = f"/api/recordings/snapshots/{thumb_name}"

            title = f"{action_label}: {name}"
            details = f"Object tracker '{name}' detected state change ({state}) with delta {delta_pct}%"
            log_event(
                event_type="motion",
                camera_id=camera_id,
                title=title,
                details=details,
                thumbnail_url=thumb_url
            )
        except Exception as e:
            logger.debug(f"Custom tracker event log skip: {e}")


# Global Singleton Vision Tracker
vision_tracker = VisionTracker()
