import cv2
import threading
import time
import os
import platform
import logging
import numpy as np
from typing import Optional, Tuple, Dict, Any, List
from .vision_tracker import vision_tracker
from ..core.database import list_configured_cameras, add_configured_camera, get_configured_camera

logger = logging.getLogger("camera_worker")

class CameraWorker:
    def __init__(self, device: Any = 0, source: Optional[str] = None, width: int = 1920, height: int = 1080, fps: int = 60):
        self.device: Any = device
        self.source: str = str(source) if source is not None else str(device)
        self.requested_width = width
        self.requested_height = height
        self.requested_fps = fps
        self.actual_fps = 0.0
        self.resolution = f"{width}x{height}"
        self.cap: Optional[cv2.VideoCapture] = None
        self.is_running = False
        self.latest_frame: Optional[np.ndarray] = None
        self.latest_raw_frame: Optional[np.ndarray] = None
        self.latest_jpeg: Optional[bytes] = None
        self.latest_detections: List[Dict[str, Any]] = []
        self.lock = threading.Lock()
        self.worker_thread: Optional[threading.Thread] = None
        self.is_hardware_active = False
        self.last_client_access = time.time()
        self._cached_standby_jpeg: Optional[bytes] = None
        self._last_standby_gen = 0.0
        self.brightness = 50
        self.contrast = 50
        self.saturation = 50
        self.flip_h = False
        self.flip_v = False
        self.rotation = 0
        self.zoom = 1.0
        self.pan_x = 0.0
        self.pan_y = 0.0
        self._need_reconnect = False

    def start(self, width: Optional[int] = None, height: Optional[int] = None, fps: Optional[int] = None):
        if self.is_running:
            return

        if width: self.requested_width = width
        if height: self.requested_height = height
        if fps: self.requested_fps = fps

        self.is_running = True
        
        # Pre-generate standby test frame
        init_frame = self._generate_standby_frame("CONNECTING CAMERA FEED...")
        _, buf = cv2.imencode('.jpg', init_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        self.latest_jpeg = buf.tobytes()
        self.latest_frame = init_frame

        self.worker_thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.worker_thread.start()

    def _open_capture_device(self) -> Optional[cv2.VideoCapture]:
        is_windows = platform.system() == "Windows"
        source_val = str(self.source or self.device).strip()
        is_ip_stream = any(source_val.lower().startswith(proto) for proto in ["rtsp://", "http://", "https://", "rtmp://", "rtsps://"])

        if is_ip_stream:
            logger.info(f"Opening IP Camera / RTSP stream: {source_val}")
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|analyzeduration;1000000|probesize;1000000"
            cap = cv2.VideoCapture(source_val, cv2.CAP_FFMPEG)
            if not cap.isOpened():
                cap.release()
                cap = cv2.VideoCapture(source_val)
            return cap

        try:
            dev_idx = int(source_val)
        except (ValueError, TypeError):
            dev_idx = None

        cap = None
        if is_windows and dev_idx is not None:
            cap = cv2.VideoCapture(dev_idx, cv2.CAP_DSHOW)
            if not cap.isOpened():
                cap.release()
                time.sleep(0.15)
                cap = cv2.VideoCapture(dev_idx, cv2.CAP_DSHOW)
        elif dev_idx is not None:
            # On Linux Proxmox, try V4L2 backend first, then standard backend
            cap = cv2.VideoCapture(dev_idx, cv2.CAP_V4L2)
            if not cap.isOpened():
                cap.release()
                time.sleep(0.15)
                cap = cv2.VideoCapture(dev_idx)
        else:
            cap = cv2.VideoCapture(source_val)

        if cap and cap.isOpened() and not is_ip_stream:
            try:
                cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*'MJPG'))
                cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.requested_width)
                cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.requested_height)
                cap.set(cv2.CAP_PROP_FPS, self.requested_fps or 60)
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            except Exception:
                pass

        return cap

    def set_resolution(self, width: int, height: int, fps: int = 60) -> Dict[str, Any]:
        """Dynamically switches resolution and FPS on the active camera seamlessly."""
        logger.info(f"Changing resolution for Dev {self.device} to {width}x{height} @ {fps}fps")
        self.requested_width = width
        self.requested_height = height
        self.requested_fps = fps
        self.resolution = f"{width}x{height}"

        # 1. First attempt dynamic hardware property switch without tearing down the open device
        applied_live = False
        if self.cap and self.cap.isOpened():
            try:
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
                self.cap.set(cv2.CAP_PROP_FPS, fps)
                actual_w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                actual_h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                if actual_w > 0 and actual_h > 0:
                    self.resolution = f"{actual_w}x{actual_h}"
                    applied_live = True
            except Exception:
                pass

        # 2. If the driver requires re-negotiating V4L2/DSHOW formats, schedule graceful re-open
        if not applied_live:
            self._need_reconnect = True

        if not self.is_running:
            self.start()

        # Update configured database camera if exists
        try:
            from ..core.database import update_configured_camera
            update_configured_camera(str(self.device), resolution=self.resolution, fps=fps)
        except Exception:
            pass

        return {
            "status": "success",
            "device": str(self.device),
            "resolution": self.resolution,
            "fps": self.requested_fps
        }

    def _generate_standby_frame(self, label: str = "SIGNAL SEARCHING...") -> np.ndarray:
        h, w = self.requested_height, self.requested_width
        img = np.zeros((h, w, 3), dtype=np.uint8)
        
        grid_color = (24, 24, 27)
        for x in range(0, w, 80):
            cv2.line(img, (x, 0), (x, h), grid_color, 1)
        for y in range(0, h, 80):
            cv2.line(img, (0, y), (w, y), grid_color, 1)

        bracket_len = 30
        bracket_color = (59, 130, 246)
        corners = [(40, 40), (w - 40, 40), (40, h - 40), (w - 40, h - 40)]
        for cx, cy in corners:
            dx = 1 if cx < w // 2 else -1
            dy = 1 if cy < h // 2 else -1
            cv2.line(img, (cx, cy), (cx + dx * bracket_len, cy), bracket_color, 2)
            cv2.line(img, (cx, cy), (cx, cy + dy * bracket_len), bracket_color, 2)

        center_x, center_y = w // 2, h // 2
        cv2.circle(img, (center_x, center_y), 40, (39, 39, 42), 1)
        cv2.line(img, (center_x - 50, center_y), (center_x + 50, center_y), (39, 39, 42), 1)
        cv2.line(img, (center_x, center_y - 50), (center_x, center_y + 50), (39, 39, 42), 1)

        now_str = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        sub_sec = int((time.time() % 1) * 1000)
        timecode = f"{now_str}.{sub_sec:03d} UTC"
        
        cv2.putText(img, f"SURVEILLANCE HUD // {label}", (60, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 1, cv2.LINE_AA)
        cv2.putText(img, timecode, (60, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (161, 161, 170), 1, cv2.LINE_AA)
        cv2.putText(img, f"CAMERA: {self.device}  |  RES: {self.resolution}", (60, h - 60), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (113, 113, 122), 1, cv2.LINE_AA)
        
        return img

    def _capture_loop(self):
        target_fps = self.requested_fps or 60
        frame_delay = 1.0 / target_fps
        encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 75]

        self.cap = self._open_capture_device()

        if self.cap and self.cap.isOpened():
            actual_w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or self.requested_width
            actual_h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or self.requested_height
            self.resolution = f"{actual_w}x{actual_h}"
            self.is_hardware_active = True
            logger.info(f"Camera {self.device} opened @ {self.resolution} target {target_fps}fps")
        else:
            self.is_hardware_active = False
            logger.warning(f"Could not open camera {self.device}. Standby mode active.")

        frame_count = 0
        fps_start = time.time()
        consecutive_read_failures = 0
        last_reconnect_attempt = time.time()

        while self.is_running:
            loop_start = time.time()

            # Handle scheduled camera reconnection (e.g. resolution change)
            if getattr(self, "_need_reconnect", False):
                self._need_reconnect = False
                logger.info(f"Re-opening camera {self.device} for {self.requested_width}x{self.requested_height} @ {self.requested_fps}fps")
                if self.cap is not None:
                    try:
                        self.cap.release()
                    except Exception:
                        pass
                    self.cap = None

                time.sleep(0.15)
                # Retry opening capture device up to 3 times
                for attempt in range(3):
                    self.cap = self._open_capture_device()
                    if self.cap and self.cap.isOpened():
                        break
                    time.sleep(0.15)

                if self.cap and self.cap.isOpened():
                    actual_w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or self.requested_width
                    actual_h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or self.requested_height
                    self.resolution = f"{actual_w}x{actual_h}"
                    self.is_hardware_active = True
                    consecutive_read_failures = 0
                    logger.info(f"Camera {self.device} re-opened successfully @ {self.resolution}")
                else:
                    self.is_hardware_active = False
                    logger.warning(f"Camera {self.device} re-open failed; entering auto-recovery.")

            # Hardware Capture Reading & Processing
            if self.cap and self.cap.isOpened():
                ret, frame = self.cap.read()
                if ret and frame is not None:
                    consecutive_read_failures = 0
                    self.is_hardware_active = True

                    # 1. Flip Controls (Horizontal / Vertical)
                    if self.flip_h and self.flip_v:
                        frame = cv2.flip(frame, -1)
                    elif self.flip_h:
                        frame = cv2.flip(frame, 1)
                    elif self.flip_v:
                        frame = cv2.flip(frame, 0)

                    # 2. Rotation Controls
                    if self.rotation == 90:
                        frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
                    elif self.rotation == 180:
                        frame = cv2.rotate(frame, cv2.ROTATE_180)
                    elif self.rotation == 270:
                        frame = cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)

                    # 3. Digital Zoom & Pan / Crop Controls (ROI Crop)
                    if self.zoom > 1.01:
                        h, w = frame.shape[:2]
                        crop_w = max(10, int(w / self.zoom))
                        crop_h = max(10, int(h / self.zoom))
                        
                        cx = int(w / 2 + (self.pan_x / 100.0) * (w - crop_w))
                        cy = int(h / 2 + (self.pan_y / 100.0) * (h - crop_h))
                        
                        x1 = max(0, min(w - crop_w, cx - crop_w // 2))
                        y1 = max(0, min(h - crop_h, cy - crop_h // 2))
                        x2 = min(w, x1 + crop_w)
                        y2 = min(h, y1 + crop_h)
                        
                        cropped = frame[y1:y2, x1:x2]
                        if cropped.size > 0:
                            frame = cv2.resize(cropped, (w, h), interpolation=cv2.INTER_LINEAR)

                    # 4. Brightness & Contrast Adjustments
                    if self.brightness != 50 or self.contrast != 50:
                        alpha = self.contrast / 50.0
                        beta = (self.brightness - 50) * 2
                        frame = cv2.convertScaleAbs(frame, alpha=alpha, beta=beta)

                    # 5. Saturation Adjustment
                    if self.saturation != 50:
                        try:
                            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV).astype(np.float32)
                            hsv[:, :, 1] = hsv[:, :, 1] * (self.saturation / 50.0)
                            hsv[:, :, 1] = np.clip(hsv[:, :, 1], 0, 255)
                            frame = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
                        except Exception:
                            pass

                    # Pass through Vision Tracker for bounding boxes, identity tags & HUD markers
                    annotated_frame, detections = vision_tracker.process_frame(frame, camera_id=str(self.device))

                    # Encode to JPEG with efficient quality 75
                    _, buf = cv2.imencode('.jpg', annotated_frame, encode_param)
                    with self.lock:
                        self.latest_raw_frame = frame
                        self.latest_frame = annotated_frame
                        self.latest_jpeg = buf.tobytes()
                        self.latest_detections = detections
                else:
                    consecutive_read_failures += 1
                    # Tolerant frame drop handling: during brief resolution change stutters, do not freeze or kill stream
                    if consecutive_read_failures < 15:
                        time.sleep(0.02)
                    else:
                        self.is_hardware_active = False
                        if self.cap:
                            try:
                                self.cap.release()
                            except Exception:
                                pass
                            self.cap = None
            else:
                # Standby / searching state & Auto-reconnection attempt every 1.5s
                now_ts = time.time()
                if now_ts - last_reconnect_attempt >= 1.5:
                    last_reconnect_attempt = now_ts
                    self.cap = self._open_capture_device()
                    if self.cap and self.cap.isOpened():
                        self.is_hardware_active = True
                        consecutive_read_failures = 0
                        actual_w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or self.requested_width
                        actual_h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or self.requested_height
                        self.resolution = f"{actual_w}x{actual_h}"
                        logger.info(f"Camera {self.device} signal recovered @ {self.resolution}")

                if (now_ts - self._last_standby_gen >= 0.5) or (self._cached_standby_jpeg is None):
                    self._last_standby_gen = now_ts
                    frame = self._generate_standby_frame(f"CONNECTING FEED // DEV {self.device}")
                    _, buf = cv2.imencode('.jpg', frame, encode_param)
                    self._cached_standby_jpeg = buf.tobytes()
                    with self.lock:
                        self.latest_raw_frame = frame
                        self.latest_frame = frame
                        self.latest_jpeg = self._cached_standby_jpeg
                        self.latest_detections = []
                time.sleep(0.08)
                continue

            frame_count += 1
            if time.time() - fps_start >= 1.0:
                self.actual_fps = round(frame_count / (time.time() - fps_start), 1)
                frame_count = 0
                fps_start = time.time()

            # Adaptive power saving: If no client is watching this feed for > 5s, throttle to 5 FPS
            is_client_active = (time.time() - self.last_client_access < 6.0)
            effective_delay = frame_delay if is_client_active else 0.20

            elapsed = time.time() - loop_start
            sleep_time = max(0.001, effective_delay - elapsed)
            time.sleep(sleep_time)

        if self.cap:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None
        self.is_hardware_active = False

    def get_latest_jpeg(self) -> Optional[bytes]:
        self.last_client_access = time.time()
        with self.lock:
            return self.latest_jpeg

    def get_latest_frame(self) -> Optional[np.ndarray]:
        self.last_client_access = time.time()
        with self.lock:
            return self.latest_frame.copy() if self.latest_frame is not None else None

    def get_latest_raw_frame(self) -> Optional[np.ndarray]:
        self.last_client_access = time.time()
        with self.lock:
            return self.latest_raw_frame.copy() if self.latest_raw_frame is not None else None

    def get_latest_detections(self) -> List[Dict[str, Any]]:
        self.last_client_access = time.time()
        with self.lock:
            return list(self.latest_detections)

    def stop(self):
        self.is_running = False
        if self.worker_thread:
            self.worker_thread.join(timeout=1.0)
            self.worker_thread = None


class MultiCameraManager:
    """Manages multi-camera streaming workers and hardware device detection."""
    def __init__(self):
        self.workers: Dict[str, CameraWorker] = {}
        self.lock = threading.Lock()
        self._cached_devices: List[Dict[str, Any]] = []
        self._last_scan_time = 0

    def get_worker(self, device_id: str, source: Optional[str] = None) -> CameraWorker:
        with self.lock:
            dev_str = str(device_id)
            if dev_str not in self.workers:
                resolved_source = source
                if resolved_source is None:
                    try:
                        cam_cfg = get_configured_camera(dev_str)
                        if cam_cfg and cam_cfg.get("source"):
                            resolved_source = cam_cfg["source"]
                        else:
                            resolved_source = dev_str
                    except Exception:
                        resolved_source = dev_str
                worker = CameraWorker(device=device_id, source=resolved_source)
                worker.start()
                self.workers[dev_str] = worker
            elif source is not None and self.workers[dev_str].source != source:
                # Source updated: restart worker with new source
                self.workers[dev_str].stop()
                worker = CameraWorker(device=device_id, source=source)
                worker.start()
                self.workers[dev_str] = worker
            return self.workers[dev_str]

    def probe_camera_resolutions(self, source_val: Any) -> List[Dict[str, Any]]:
        """
        Probes real camera hardware sensor to return only the actual resolutions and frame rates
        supported by physical hardware. Results are cached per source.
        """
        source_str = str(source_val).strip()
        if hasattr(self, "_resolution_cache") and source_str in self._resolution_cache:
            return self._resolution_cache[source_str]

        if not hasattr(self, "_resolution_cache"):
            self._resolution_cache = {}

        is_windows = platform.system() == "Windows"
        resolutions = []
        seen = set()

        # 1. On Linux, query v4l2-ctl for instant hardware capability list
        if not is_windows and (source_str.startswith("/dev/video") or source_str.isdigit()):
            dev_path = source_str if source_str.startswith("/dev/") else f"/dev/video{source_str}"
            try:
                import subprocess, re
                out = subprocess.check_output(
                    ["v4l2-ctl", "--list-formats-ext", "-d", dev_path],
                    stderr=subprocess.STDOUT,
                    timeout=2
                ).decode("utf-8", errors="ignore")

                current_size = None
                for line in out.splitlines():
                    size_match = re.search(r"Size:\s+Discrete\s+(\d+)x(\d+)", line)
                    if size_match:
                        w, h = int(size_match.group(1)), int(size_match.group(2))
                        current_size = (w, h)

                    fps_match = re.search(r"\((\d+(?:\.\d+)?)\s*fps\)", line)
                    if fps_match and current_size:
                        w, h = current_size
                        fps_val = int(round(float(fps_match.group(1))))
                        size_key = f"{w}x{h}"
                        if size_key not in seen:
                            seen.add(size_key)
                            lbl = f"{w}x{h}"
                            if w == 3840 and h == 2160: lbl = "4K UHD"
                            elif w == 2560 and h == 1440: lbl = "2K QHD"
                            elif w == 1920 and h == 1080: lbl = "1080p FHD"
                            elif w == 1280 and h == 720: lbl = "720p HD"
                            elif w == 640 and h == 480: lbl = "VGA"
                            else: lbl = f"{h}p"

                            resolutions.append({
                                "label": f"{lbl} ({w}x{h})",
                                "value": size_key,
                                "fps": f"{fps_val} FPS",
                                "width": w,
                                "height": h
                            })
            except Exception:
                pass

        # 2. If Linux v4l2-ctl succeeded, cache and return
        if resolutions:
            resolutions.sort(key=lambda r: (r["width"] * r["height"]), reverse=True)
            self._resolution_cache[source_str] = resolutions
            return resolutions

        # 3. Query live camera worker if running
        if source_str in self.workers:
            w = self.workers[source_str]
            if w.is_hardware_active and w.resolution:
                parts = w.resolution.split("x")
                if len(parts) == 2:
                    try:
                        rw, rh = int(parts[0]), int(parts[1])
                        size_key = f"{rw}x{rh}"
                        if size_key not in seen:
                            seen.add(size_key)
                            resolutions.append({
                                "label": f"Active ({size_key})",
                                "value": size_key,
                                "fps": f"{w.actual_fps or 60} FPS",
                                "width": rw,
                                "height": rh
                            })
                    except Exception:
                        pass

        # 4. Probe standard resolutions via VideoCapture
        COMMON_MODES = [
            (3840, 2160, "4K UHD"),
            (2560, 1440, "2K QHD"),
            (1920, 1080, "1080p FHD"),
            (1280, 720, "720p HD"),
            (1024, 768, "XGA"),
            (800, 600, "SVGA"),
            (640, 480, "VGA"),
            (320, 240, "QVGA")
        ]

        try:
            try:
                dev_idx = int(source_str)
            except (ValueError, TypeError):
                dev_idx = source_str

            cap = cv2.VideoCapture(dev_idx, cv2.CAP_DSHOW if is_windows else cv2.CAP_V4L2)
            if not cap.isOpened():
                cap = cv2.VideoCapture(dev_idx)

            if cap.isOpened():
                for w_cand, h_cand, label in COMMON_MODES:
                    cap.set(cv2.CAP_PROP_FRAME_WIDTH, w_cand)
                    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, h_cand)
                    act_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    act_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    act_fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30

                    if act_w > 0 and act_h > 0 and (act_w == w_cand and act_h == h_cand):
                        size_key = f"{act_w}x{act_h}"
                        if size_key not in seen:
                            seen.add(size_key)
                            resolutions.append({
                                "label": f"{label} ({size_key})",
                                "value": size_key,
                                "fps": f"{act_fps} FPS",
                                "width": act_w,
                                "height": act_h
                            })
                cap.release()
        except Exception:
            pass

        if not resolutions:
            resolutions = [
                {"label": "1080p FHD (1920x1080)", "value": "1920x1080", "fps": "60 FPS", "width": 1920, "height": 1080},
                {"label": "720p HD (1280x720)", "value": "1280x720", "fps": "60 FPS", "width": 1280, "height": 720},
                {"label": "VGA (640x480)", "value": "640x480", "fps": "60 FPS", "width": 640, "height": 480}
            ]

        resolutions.sort(key=lambda r: (r["width"] * r["height"]), reverse=True)
        self._resolution_cache[source_str] = resolutions
        return resolutions

    def remove_worker(self, device_id: str):
        with self.lock:
            dev_str = str(device_id)
            if dev_str in self.workers:
                worker = self.workers.pop(dev_str)
                worker.stop()
            self._cached_devices = [d for d in self._cached_devices if str(d.get("device")) != dev_str]
            self._last_scan_time = 0

    def scan_hardware_devices(self) -> List[Dict[str, Any]]:
        """Scans hardware devices connected to the operating system."""
        devices = []
        is_windows = platform.system() == "Windows"

        if is_windows:
            try:
                import comtypes
                comtypes.CoInitialize()
            except Exception:
                pass

            try:
                from pygrabber.dshow_graph import FilterGraph
                raw_names = FilterGraph().get_input_devices()
            except Exception as e:
                logger.warning(f"pygrabber device scan error: {e}")
                raw_names = []

            # If pygrabber returned empty list, probe physical indices
            if not raw_names:
                for test_idx in range(6):
                    if str(test_idx) in self.workers and self.workers[str(test_idx)].is_hardware_active:
                        raw_names.append(f"Physical Camera Device #{test_idx}")
                        continue
                    test_cap = cv2.VideoCapture(test_idx, cv2.CAP_DSHOW)
                    if test_cap.isOpened():
                        raw_names.append(f"Physical Camera Device #{test_idx}")
                        test_cap.release()

            for idx, name in enumerate(raw_names):
                if "bytecast" in name.lower():
                    continue

                dev_str = str(idx)
                # Check if camera is streaming or accessible
                is_available = False
                if dev_str in self.workers and self.workers[dev_str].is_hardware_active:
                    is_available = True
                else:
                    test_cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
                    if test_cap.isOpened():
                        is_available = True
                        test_cap.release()

                probed = self.probe_camera_resolutions(idx)
                top_res = probed[0]["value"] if probed else "1920x1080"
                top_fps = int(probed[0]["fps"].replace(" FPS", "")) if probed else 60

                devices.append({
                    "device": dev_str,
                    "name": name,
                    "type": "virtual" if ("virtual" in name.lower() or "obs" in name.lower()) else "usb",
                    "resolution": top_res,
                    "fps": top_fps,
                    "supported_resolutions": probed,
                    "is_available": is_available
                })
        else:
            v4l_dir = "/sys/class/video4linux"
            if os.path.exists(v4l_dir):
                for entry in sorted(os.listdir(v4l_dir)):
                    if entry.startswith("video"):
                        dev_path = f"/dev/{entry}"
                        name = entry

                        # 1. Read real hardware device name from sysfs
                        name_file = os.path.join(v4l_dir, entry, "name")
                        if os.path.exists(name_file):
                            try:
                                with open(name_file, "r") as f:
                                    real_name = f.read().strip()
                                    if real_name:
                                        name = real_name
                            except Exception:
                                pass

                        # 2. Skip secondary metadata nodes if index > 0
                        index_file = os.path.join(v4l_dir, entry, "index")
                        if os.path.exists(index_file):
                            try:
                                with open(index_file, "r") as f:
                                    idx_val = f.read().strip()
                                    if idx_val and idx_val != "0":
                                        continue
                            except Exception:
                                pass

                        # 3. Test if device is accessible
                        is_available = False
                        if dev_path in self.workers and self.workers[dev_path].is_hardware_active:
                            is_available = True
                        else:
                            test_cap = cv2.VideoCapture(dev_path, cv2.CAP_V4L2)
                            if test_cap.isOpened():
                                is_available = True
                                test_cap.release()

                        probed = self.probe_camera_resolutions(dev_path)
                        top_res = probed[0]["value"] if probed else "1920x1080"
                        top_fps = int(probed[0]["fps"].replace(" FPS", "")) if probed else 60

                        devices.append({
                            "device": dev_path,
                            "name": name,
                            "type": "usb",
                            "resolution": top_res,
                            "fps": top_fps,
                            "supported_resolutions": probed,
                            "is_available": is_available
                        })
        return devices

    def get_available_cameras(self) -> List[Dict[str, Any]]:
        """Returns all configured cameras synced with the database. Returns empty list if no cameras are configured."""
        try:
            db_cameras = list_configured_cameras()
        except Exception:
            db_cameras = []

        if not db_cameras:
            return []

        devices = []
        for cam in db_cameras:
            dev_str = str(cam["id"])
            source_str = cam.get("source", dev_str)
            res = cam.get("resolution", "1920x1080")
            fps = cam.get("fps", 60)
            if dev_str in self.workers:
                w = self.workers[dev_str]
                res = w.resolution or res
                fps = w.actual_fps or fps

            probed = self.probe_camera_resolutions(source_str)

            devices.append({
                "device": dev_str,
                "name": cam["name"],
                "source": source_str,
                "resolution": res,
                "fps": fps,
                "zone": cam.get("zone", "Main Area"),
                "is_online": bool(cam.get("is_online", 1)),
                "supported_resolutions": probed,
                "resolutions": [r["label"] for r in probed],
                "formats": [f"{r['value']}@{r['fps']}" for r in probed]
            })

        self._cached_devices = devices
        return devices

    def stop_all(self):
        with self.lock:
            for w in self.workers.values():
                w.stop()
            self.workers.clear()


camera_manager = MultiCameraManager()
# Primary worker alias for single-cam routes
camera_worker = camera_manager.get_worker("0")
