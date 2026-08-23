import os
import time
import shutil
import cv2
import threading
import subprocess
import numpy as np
try:
    import soundfile as sf
except Exception:
    sf = None

try:
    import imageio_ffmpeg
except Exception:
    imageio_ffmpeg = None
from pathlib import Path
from typing import List, Dict, Any, Optional
from ..core.config import settings
from ..core.database import log_event, get_db
from .camera_worker import camera_worker
from .audio_worker import audio_worker
from .s3_storage import s3_storage
from .samba_storage import samba_storage

class DVRManager:
    def __init__(self):
        self.is_recording = False
        self.current_recording_file: Optional[str] = None
        self.recording_start_time: Optional[float] = None
        self._record_thread: Optional[threading.Thread] = None
        self._custom_storage_dir: Optional[Path] = None
        self._storage_target_mode: str = "local"  # 'local', 'samba', 's3', 'all'
        self._purge_local_after_upload: bool = False

        # Load persisted custom storage directory and storage target mode
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT value FROM system_config WHERE key = 'custom_storage_dir'")
                row = cursor.fetchone()
                if row and row[0]:
                    p = Path(row[0])
                    p.mkdir(parents=True, exist_ok=True)
                    self._custom_storage_dir = p

                cursor.execute("SELECT value FROM system_config WHERE key = 'storage_target_mode'")
                row = cursor.fetchone()
                if row and row[0]:
                    self._storage_target_mode = row[0]

                cursor.execute("SELECT value FROM system_config WHERE key = 'purge_local_after_upload'")
                row = cursor.fetchone()
                if row and row[0]:
                    self._purge_local_after_upload = row[0].lower() in ['true', '1', 'yes']
        except Exception:
            pass

        # Transcode any legacy mp4v recordings to browser-compatible H.264 in background
        t = threading.Thread(target=self._transcode_legacy_recordings, daemon=True)
        t.start()

    def get_recordings_dir(self) -> Path:
        p = self._custom_storage_dir or settings.RECORDINGS_DIR
        p.mkdir(parents=True, exist_ok=True)
        return p

    def get_snapshots_dir(self) -> Path:
        if self._custom_storage_dir:
            p = self._custom_storage_dir / "snapshots"
        else:
            p = settings.SNAPSHOTS_DIR
        p.mkdir(parents=True, exist_ok=True)
        return p

    def _transcode_legacy_recordings(self):
        """Checks existing recordings and transcodes to standard H.264 if needed."""
        try:
            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe() if imageio_ffmpeg else "ffmpeg"
            rec_dir = self.get_recordings_dir()
            for mp4_file in list(rec_dir.glob("*.mp4")):
                if mp4_file.name.endswith(".raw.mp4") or mp4_file.name.endswith(".h264tmp.mp4"):
                    continue
                temp_out = mp4_file.with_suffix('.h264tmp.mp4')
                cmd = [
                    ffmpeg_exe, "-y",
                    "-i", str(mp4_file),
                    "-c:v", "libx264",
                    "-preset", "ultrafast",
                    "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart",
                    str(temp_out)
                ]
                res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                if res.returncode == 0 and temp_out.exists() and temp_out.stat().st_size > 0:
                    temp_out.replace(mp4_file)
        except Exception:
            pass

    def set_custom_storage_dir(self, path_str: str) -> Dict[str, Any]:
        try:
            new_path = Path(path_str).resolve()
            new_path.mkdir(parents=True, exist_ok=True)
            self._custom_storage_dir = new_path
            try:
                with get_db() as conn:
                    cursor = conn.cursor()
                    cursor.execute(
                        "INSERT OR REPLACE INTO system_config (key, value) VALUES ('custom_storage_dir', ?)",
                        (str(new_path),)
                    )
                    conn.commit()
            except Exception:
                pass
            return {
                "success": True,
                "current_path": str(new_path),
                "is_writable": os.access(str(new_path), os.W_OK)
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_storage_target_mode(self) -> Dict[str, Any]:
        return {
            "target_mode": self._storage_target_mode,
            "purge_local_after_upload": self._purge_local_after_upload
        }

    def set_storage_target_mode(self, mode: str, purge_local: bool = False) -> Dict[str, Any]:
        if mode not in ["local", "samba", "s3", "all"]:
            mode = "local"
        self._storage_target_mode = mode
        self._purge_local_after_upload = bool(purge_local)
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT OR REPLACE INTO system_config (key, value) VALUES ('storage_target_mode', ?)",
                    (mode,)
                )
                cursor.execute(
                    "INSERT OR REPLACE INTO system_config (key, value) VALUES ('purge_local_after_upload', ?)",
                    (str(self._purge_local_after_upload),)
                )
                conn.commit()
        except Exception:
            pass
        return {
            "success": True,
            "target_mode": self._storage_target_mode,
            "purge_local_after_upload": self._purge_local_after_upload
        }

    def open_storage_folder(self) -> Dict[str, Any]:
        target_dir = self.get_recordings_dir()
        try:
            if os.name == 'nt':
                os.startfile(str(target_dir))
            else:
                subprocess.Popen(["xdg-open", str(target_dir)])
            return {"success": True, "path": str(target_dir)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _auto_sync(self, file_path: Path):
        def _sync_worker():
            if not file_path.exists() or file_path.stat().st_size == 0:
                return
            mode = self._storage_target_mode
            purge = self._purge_local_after_upload

            if mode == "local":
                # Local Only - Do not offload to cloud or remote network
                return

            uploaded_success = False

            if mode in ["s3", "all"]:
                try:
                    if s3_storage.config.get("enabled"):
                        res = s3_storage.upload_file(file_path)
                        if res.get("success"):
                            uploaded_success = True
                except Exception:
                    pass

            if mode in ["samba", "all"]:
                try:
                    if samba_storage.config.get("enabled"):
                        res = samba_storage.sync_file(file_path)
                        if res.get("success"):
                            uploaded_success = True
                except Exception:
                    pass

            if purge and mode in ["samba", "s3"] and uploaded_success:
                try:
                    file_path.unlink(missing_ok=True)
                except Exception:
                    pass

        t = threading.Thread(target=_sync_worker, daemon=True)
        t.start()

    def capture_snapshot(self, camera_id: str = "0", filename: Optional[str] = None) -> Optional[str]:
        if not filename:
            filename = f"snapshot_{camera_id}_{int(time.time())}.jpg"
        filepath = self.get_snapshots_dir() / filename
        filepath.parent.mkdir(parents=True, exist_ok=True)

        from .camera_worker import camera_manager, camera_worker
        worker = camera_manager.get_worker(camera_id) if hasattr(camera_manager, "get_worker") else camera_worker
        if worker is None:
            worker = camera_worker
        frame = worker.get_latest_frame()

        if frame is not None:
            cv2.imwrite(str(filepath), frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
        else:
            jpeg = worker.get_latest_jpeg()
            if jpeg:
                filepath.write_bytes(jpeg)

        if filepath.exists() and filepath.stat().st_size > 0:
            url = f"/api/recordings/snapshots/{filename}"
            # Log real event in DB
            log_event(
                event_type="snapshot",
                camera_id=f"CAM {camera_id}",
                title="Snapshot Captured",
                details=f"File: {filename}",
                thumbnail_url=url
            )
            self._auto_sync(filepath)
            return url
            
        return None

    def record_clip(self, camera_id: str = "0", filename: Optional[str] = None, duration_seconds: int = 15) -> Optional[Path]:
        """Records a video clip for a specific camera in background, encoding to browser-compatible H.264."""
        if not filename:
            filename = f"clip_{camera_id}_{int(time.time())}.mp4"
        filepath = self.get_recordings_dir() / filename
        filepath.parent.mkdir(parents=True, exist_ok=True)
        raw_filepath = filepath.with_suffix('.raw.mp4')
        writer = None
        start_t = time.time()

        from .camera_worker import camera_manager, camera_worker
        worker = camera_manager.get_worker(camera_id) if hasattr(camera_manager, "get_worker") else camera_worker
        if worker is None:
            worker = camera_worker

        frames_written = 0
        while time.time() - start_t < duration_seconds:
            frame = worker.get_latest_frame()
            if frame is not None:
                if writer is None:
                    h, w = frame.shape[:2]
                    for codec in ['mp4v', 'XVID', 'MJPG']:
                        try:
                            fourcc = cv2.VideoWriter_fourcc(*codec)
                            writer = cv2.VideoWriter(str(raw_filepath), fourcc, 25.0, (w, h))
                            if writer and writer.isOpened():
                                break
                        except Exception:
                            pass
                if writer and writer.isOpened():
                    writer.write(frame)
                    frames_written += 1
            time.sleep(1.0 / 25.0)

        if writer:
            try:
                writer.release()
            except Exception:
                pass
            writer = None

        if raw_filepath.exists() and raw_filepath.stat().st_size > 0 and frames_written > 0:
            try:
                ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe() if imageio_ffmpeg else "ffmpeg"
                cmd = [
                    ffmpeg_exe, "-y",
                    "-i", str(raw_filepath),
                    "-c:v", "libx264",
                    "-preset", "ultrafast",
                    "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart",
                    str(filepath)
                ]
                subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            except Exception as e:
                print(f"Error encoding motion clip {filename}: {e}")
                if raw_filepath.exists() and not filepath.exists():
                    shutil.copy(raw_filepath, filepath)
            finally:
                if raw_filepath.exists():
                    try:
                        raw_filepath.unlink()
                    except Exception:
                        pass

        if filepath.exists() and filepath.stat().st_size > 0:
            self._auto_sync(filepath)
            return filepath
        return None

    def start_manual_recording(self, duration_seconds: int = 60) -> Dict[str, Any]:
        if self.is_recording:
            return {"status": "success", "file": self.current_recording_file, "filename": self.current_recording_file}

        filename = f"recording_{int(time.time())}.mp4"
        filepath = self.get_recordings_dir() / filename
        self.current_recording_file = filename
        self.recording_start_time = time.time()
        self.is_recording = True

        # Start capturing audio buffer
        audio_worker.start_recording()

        # Log recording started event
        log_event(
            event_type="recording",
            camera_id="CAM 1",
            title="Recording Started",
            details=f"Target: {filename}"
        )

        def _record_worker():
            raw_filepath = filepath.with_suffix('.raw.mp4')
            audio_filepath = filepath.with_suffix('.wav')
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = None
            start_t = time.time()

            while self.is_recording and (time.time() - start_t < duration_seconds):
                frame = camera_worker.get_latest_frame()
                if frame is not None:
                    if writer is None:
                        h, w = frame.shape[:2]
                        writer = cv2.VideoWriter(str(raw_filepath), fourcc, 30.0, (w, h))
                    writer.write(frame)
                time.sleep(1.0 / 30.0)

            if writer:
                writer.release()
                writer = None

            # Save companion audio file if audio data was recorded
            audio_data = audio_worker.stop_recording()
            has_audio = False
            if audio_data is not None and len(audio_data) > 0 and sf is not None:
                try:
                    sf.write(str(audio_filepath), audio_data, audio_worker.sample_rate)
                    has_audio = audio_filepath.exists() and audio_filepath.stat().st_size > 0
                except Exception:
                    pass

            # Convert to HTML5-compatible H.264 MP4 with faststart
            if raw_filepath.exists() and raw_filepath.stat().st_size > 0:
                try:
                    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
                    cmd = [ffmpeg_exe, "-y", "-i", str(raw_filepath)]
                    if has_audio:
                        cmd.extend(["-i", str(audio_filepath), "-c:a", "aac", "-b:a", "128k", "-shortest"])
                    cmd.extend([
                        "-c:v", "libx264",
                        "-preset", "ultrafast",
                        "-pix_fmt", "yuv420p",
                        "-movflags", "+faststart",
                        str(filepath)
                    ])
                    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
                except Exception as e:
                    print(f"Error encoding H264: {e}")
                    if not filepath.exists() and raw_filepath.exists():
                        shutil.copy(raw_filepath, filepath)
                finally:
                    if raw_filepath.exists():
                        try:
                            raw_filepath.unlink()
                        except Exception:
                            pass
                    if audio_filepath.exists():
                        try:
                            audio_filepath.unlink()
                        except Exception:
                            pass

            self.is_recording = False
            if filepath.exists():
                log_event(
                    event_type="recording",
                    camera_id="CAM 1",
                    title="Recording Saved",
                    details=f"Saved {filename} ({round(filepath.stat().st_size/(1024*1024), 2)} MB)",
                    clip_url=f"/api/recordings/clips/{filename}"
                )
                self._auto_sync(filepath)

        self._record_thread = threading.Thread(target=_record_worker, daemon=True)
        self._record_thread.start()
        return {
            "status": "success",
            "file": filename,
            "filename": filename,
            "max_duration": duration_seconds,
            "save_location": str(self.get_recordings_dir())
        }

    def stop_recording(self) -> Dict[str, Any]:
        if self.is_recording or self.current_recording_file:
            self.is_recording = False
            saved_file = self.current_recording_file
            size_mb = 0.0
            if saved_file:
                p = self.get_recordings_dir() / saved_file
                # Give ffmpeg a moment if finishing encode
                for _ in range(25):
                    if p.exists() and p.stat().st_size > 0:
                        size_mb = round(p.stat().st_size / (1024 * 1024), 2)
                        self._auto_sync(p)
                        break
                    time.sleep(0.1)

            self.current_recording_file = None
            self.recording_start_time = None
            return {
                "status": "success",
                "file": saved_file or "recording.mp4",
                "filename": saved_file or "recording.mp4",
                "size_mb": size_mb,
                "location": str(self.get_recordings_dir())
            }
            
        return {"status": "success", "file": None, "filename": None, "size_mb": 0.0}

    def get_status(self) -> Dict[str, Any]:
        elapsed = time.time() - self.recording_start_time if self.is_recording and self.recording_start_time else 0
        return {
            "is_recording": self.is_recording,
            "current_file": self.current_recording_file,
            "elapsed_seconds": int(elapsed),
            "save_location": str(self.get_recordings_dir())
        }

    def list_recordings(self) -> List[Dict[str, Any]]:
        items = []
        rec_dir = self.get_recordings_dir()
        for file in sorted(rec_dir.glob("*.mp4"), key=os.path.getmtime, reverse=True):
            if file.name.endswith(".raw.mp4"):
                continue
            stat = file.stat()
            items.append({
                "filename": file.name,
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "created_at": int(stat.st_mtime),
                "url": f"/api/recordings/clips/{file.name}",
                "path": str(file)
            })
        return items

    def list_snapshots(self) -> List[Dict[str, Any]]:
        items = []
        snap_dir = self.get_snapshots_dir()
        patterns = ["*.jpg", "*.jpeg", "*.png", "*.webp"]
        files = []
        for pat in patterns:
            files.extend(snap_dir.glob(pat))
            files.extend(snap_dir.glob(pat.upper()))

        # Deduplicate and sort by modification time descending
        unique_files = list({f.resolve(): f for f in files}.values())
        for file in sorted(unique_files, key=os.path.getmtime, reverse=True):
            try:
                stat = file.stat()
                size_bytes = stat.st_size
                items.append({
                    "filename": file.name,
                    "size_kb": round(size_bytes / 1024, 1),
                    "size_mb": round(size_bytes / (1024 * 1024), 2),
                    "created_at": int(stat.st_mtime),
                    "url": f"/api/recordings/snapshots/{file.name}",
                    "path": str(file)
                })
            except Exception:
                continue
        return items

dvr_manager = DVRManager()
