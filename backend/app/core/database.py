import sqlite3
import time
import json
import hashlib
import secrets
from pathlib import Path
from typing import List, Dict, Any, Optional
from .config import settings

DB_PATH = settings.DATA_DIR / "cctv.db"
FACES_DIR = settings.DATA_DIR / "faces"
FACES_DIR.mkdir(parents=True, exist_ok=True)

def _hash_password(password: str, salt: Optional[str] = None) -> str:
    if not salt:
        salt = secrets.token_hex(8)
    h = hashlib.sha256(f"{salt}${password}".encode("utf-8")).hexdigest()
    return f"{salt}${h}"

def _verify_password(password: str, hashed: str) -> bool:
    if not hashed:
        return False
    if "$" not in hashed:
        return hashlib.sha256(password.encode("utf-8")).hexdigest() == hashed or password == hashed
    salt, expected = hashed.split("$", 1)
    computed = hashlib.sha256(f"{salt}${password}".encode("utf-8")).hexdigest()
    return computed == expected

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        # Users Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                display_name TEXT NOT NULL,
                role TEXT DEFAULT 'admin', -- 'admin', 'operator', 'viewer'
                created_at INTEGER NOT NULL,
                last_login INTEGER
            )
        """)

        # Seed default admin user if not exists
        cursor.execute("SELECT COUNT(*) FROM users")
        if cursor.fetchone()[0] == 0:
            now = int(time.time())
            admin_hash = _hash_password("admin")
            cursor.execute("""
                INSERT INTO users (username, password_hash, display_name, role, created_at, last_login)
                VALUES ('admin', ?, 'System Administrator', 'admin', ?, ?)
            """, (admin_hash, now, now))

        # Events Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                event_type TEXT NOT NULL, -- 'motion', 'face', 'vehicle', 'snapshot', 'recording'
                camera_id TEXT NOT NULL,
                title TEXT NOT NULL,
                details TEXT,
                thumbnail_url TEXT,
                clip_url TEXT
            )
        """)

        # Enrolled People / Faces Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS enrolled_faces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                photo_path TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                last_seen INTEGER,
                confidence REAL DEFAULT 95.0
            )
        """)
        # Custom User Object & Zone Trackers Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS custom_trackers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                camera_id TEXT NOT NULL,
                name TEXT NOT NULL,
                action_label TEXT NOT NULL,
                trigger_type TEXT DEFAULT 'door_open', -- 'door_open', 'motion_zone', 'presence', 'line_cross'
                x REAL NOT NULL,
                y REAL NOT NULL,
                width REAL NOT NULL,
                height REAL NOT NULL,
                sensitivity INTEGER DEFAULT 60,
                color TEXT DEFAULT '#3B82F6',
                is_active INTEGER DEFAULT 1,
                last_triggered INTEGER DEFAULT 0,
                state TEXT DEFAULT 'NORMAL'
            )
        """)

        # Configured Video Cameras Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cameras (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                source TEXT NOT NULL,
                resolution TEXT DEFAULT '1920x1080',
                fps INTEGER DEFAULT 60,
                zone TEXT DEFAULT 'Main Area',
                is_online INTEGER DEFAULT 1,
                created_at INTEGER NOT NULL
            )
        """)

        # System Configuration Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS system_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)

        # Seed initial camera only once on brand-new DB setup
        cursor.execute("SELECT value FROM system_config WHERE key = 'cameras_seeded'")
        seeded = cursor.fetchone()
        if not seeded:
            cursor.execute("SELECT COUNT(*) FROM cameras")
            if cursor.fetchone()[0] == 0:
                now = int(time.time())
                cursor.execute("""
                    INSERT INTO cameras (id, name, source, resolution, fps, zone, is_online, created_at)
                    VALUES ('0', 'Primary Live Camera', '0', '1920x1080', 60, 'Front Entrance', 1, ?)
                """, (now,))
            cursor.execute("INSERT OR REPLACE INTO system_config (key, value) VALUES ('cameras_seeded', '1')")
        # User Sessions & Device Audit Log Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                token TEXT,
                username TEXT NOT NULL,
                display_name TEXT,
                role TEXT NOT NULL,
                ip_address TEXT,
                device_info TEXT,
                location TEXT,
                login_time INTEGER NOT NULL,
                last_heartbeat INTEGER NOT NULL,
                logout_time INTEGER,
                logout_reason TEXT DEFAULT 'active', -- 'active', 'manual_logout', 'tab_closed', 'inactive_timeout'
                status TEXT DEFAULT 'active' -- 'active', 'ended'
            )
        """)

        # Migration: ensure token column exists
        cursor.execute("PRAGMA table_info(user_sessions)")
        cols = [c[1] for c in cursor.fetchall()]
        if "token" not in cols:
            try:
                cursor.execute("ALTER TABLE user_sessions ADD COLUMN token TEXT")
            except Exception:
                pass

        conn.commit()

init_db()

# --- Database Operations ---

def log_event(event_type: str, camera_id: str, title: str, details: str = "", thumbnail_url: str = "", clip_url: str = "") -> int:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO events (timestamp, event_type, camera_id, title, details, thumbnail_url, clip_url)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (int(time.time()), event_type, camera_id, title, details, thumbnail_url, clip_url))
        conn.commit()
        return cursor.lastrowid

def get_events(limit: int = 50) -> List[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM events ORDER BY timestamp DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_events_today_count() -> int:
    start_of_day = int(time.time()) - (int(time.time()) % 86400)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM events WHERE timestamp >= ?", (start_of_day,))
        row = cursor.fetchone()
        return row[0] if row else 0

def enroll_face(name: str, photo_filename: str, confidence: float = 95.0) -> Dict[str, Any]:
    now = int(time.time())
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO enrolled_faces (name, photo_path, created_at, last_seen, confidence)
            VALUES (?, ?, ?, ?, ?)
        """, (name, photo_filename, now, now, confidence))
        conn.commit()
        face_id = cursor.lastrowid
        
        # Also log event
        log_event(
            event_type="face",
            camera_id="CAM 1",
            title=f"Enrolled Face: {name}",
            details=f"New person profile enrolled",
            thumbnail_url=f"/api/faces/photo/{photo_filename}"
        )

        return {
            "id": face_id,
            "name": name,
            "photo_path": photo_filename,
            "photo_url": f"/api/faces/photo/{photo_filename}",
            "created_at": now,
            "last_seen": now,
            "confidence": confidence
        }

def list_enrolled_faces() -> List[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM enrolled_faces ORDER BY last_seen DESC")
        rows = cursor.fetchall()
        return [{
            "id": str(r["id"]),
            "name": r["name"],
            "photo_url": f"/api/faces/photo/{r['photo_path']}",
            "created_at": r["created_at"],
            "last_seen": r["last_seen"],
            "matchPercentage": int(r["confidence"] or 90),
            "isKnown": True
        } for r in rows]

def get_event_by_id(event_id: int) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM events WHERE id = ?", (event_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def delete_event(event_id: int) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM events WHERE id = ?", (event_id,))
        conn.commit()
        return cursor.rowcount > 0

def clear_all_events() -> int:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM events")
        conn.commit()
        return cursor.rowcount

def delete_events_batch(ids: List[int]) -> int:
    if not ids:
        return 0
    with get_db() as conn:
        cursor = conn.cursor()
        placeholders = ",".join("?" for _ in ids)
        cursor.execute(f"DELETE FROM events WHERE id IN ({placeholders})", ids)
        conn.commit()
        return cursor.rowcount

def delete_enrolled_face(face_id: int) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM enrolled_faces WHERE id = ?", (face_id,))
        conn.commit()
        return cursor.rowcount > 0

# --- Custom User Trackers & Objects Operations ---

def create_custom_tracker(
    camera_id: str,
    name: str,
    action_label: str,
    trigger_type: str = "door_open",
    x: float = 0,
    y: float = 0,
    width: float = 100,
    height: float = 100,
    sensitivity: int = 60,
    color: str = "#3B82F6"
) -> Dict[str, Any]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO custom_trackers (camera_id, name, action_label, trigger_type, x, y, width, height, sensitivity, color, is_active, last_triggered, state)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 'NORMAL')
        """, (camera_id, name, action_label, trigger_type, x, y, width, height, sensitivity, color))
        conn.commit()
        tracker_id = cursor.lastrowid
        return get_custom_tracker(tracker_id)

def list_custom_trackers(camera_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        if camera_id:
            cursor.execute("SELECT * FROM custom_trackers WHERE camera_id = ? ORDER BY id ASC", (str(camera_id),))
        else:
            cursor.execute("SELECT * FROM custom_trackers ORDER BY id ASC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_custom_tracker(tracker_id: int) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM custom_trackers WHERE id = ?", (tracker_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

def update_custom_tracker(
    tracker_id: int,
    name: Optional[str] = None,
    action_label: Optional[str] = None,
    trigger_type: Optional[str] = None,
    x: Optional[float] = None,
    y: Optional[float] = None,
    width: Optional[float] = None,
    height: Optional[float] = None,
    sensitivity: Optional[int] = None,
    color: Optional[str] = None,
    is_active: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    tracker = get_custom_tracker(tracker_id)
    if not tracker:
        return None

    updated_name = name if name is not None else tracker["name"]
    updated_action = action_label if action_label is not None else tracker["action_label"]
    updated_trigger = trigger_type if trigger_type is not None else tracker["trigger_type"]
    updated_x = x if x is not None else tracker["x"]
    updated_y = y if y is not None else tracker["y"]
    updated_w = width if width is not None else tracker["width"]
    updated_h = height if height is not None else tracker["height"]
    updated_sens = sensitivity if sensitivity is not None else tracker["sensitivity"]
    updated_col = color if color is not None else tracker["color"]
    updated_active = is_active if is_active is not None else tracker["is_active"]

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE custom_trackers
            SET name = ?, action_label = ?, trigger_type = ?, x = ?, y = ?, width = ?, height = ?, sensitivity = ?, color = ?, is_active = ?
            WHERE id = ?
        """, (updated_name, updated_action, updated_trigger, updated_x, updated_y, updated_w, updated_h, updated_sens, updated_col, updated_active, tracker_id))
        conn.commit()
        return get_custom_tracker(tracker_id)

def toggle_custom_tracker(tracker_id: int) -> Optional[Dict[str, Any]]:
    tracker = get_custom_tracker(tracker_id)
    if not tracker:
        return None
    new_active = 0 if tracker["is_active"] else 1
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE custom_trackers SET is_active = ? WHERE id = ?", (new_active, tracker_id))
        conn.commit()
        return get_custom_tracker(tracker_id)

def update_tracker_state(tracker_id: int, state: str, last_triggered: int = 0):
    with get_db() as conn:
        cursor = conn.cursor()
        if last_triggered > 0:
            cursor.execute("UPDATE custom_trackers SET state = ?, last_triggered = ? WHERE id = ?", (state, last_triggered, tracker_id))
        else:
            cursor.execute("UPDATE custom_trackers SET state = ? WHERE id = ?", (state, tracker_id))
        conn.commit()

def delete_custom_tracker(tracker_id: int) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM custom_trackers WHERE id = ?", (tracker_id,))
        conn.commit()
        return cursor.rowcount > 0

# --- Camera Management Database Operations ---

def list_configured_cameras() -> List[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cameras ORDER BY id ASC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_configured_camera(camera_id: str) -> Optional[Dict[str, Any]]:
    clean_id = str(camera_id).strip()
    norm_id = clean_id.replace("/dev/video", "") if clean_id.startswith("/dev/video") else clean_id
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM cameras 
            WHERE id = ? OR id = ? OR source = ? OR source = ?
            LIMIT 1
        """, (clean_id, norm_id, clean_id, f"/dev/video{norm_id}"))
        row = cursor.fetchone()
        return dict(row) if row else None

def add_configured_camera(
    camera_id: str,
    name: str,
    source: str,
    resolution: str = "1920x1080",
    fps: int = 60,
    zone: str = "Main Area"
) -> Dict[str, Any]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO cameras (id, name, source, resolution, fps, zone, is_online, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        """, (str(camera_id), name, source, resolution, fps, zone, int(time.time())))
        conn.commit()
        return get_configured_camera(camera_id)

def update_configured_camera(
    camera_id: str,
    name: Optional[str] = None,
    source: Optional[str] = None,
    resolution: Optional[str] = None,
    fps: Optional[int] = None,
    zone: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    existing = get_configured_camera(camera_id)
    if not existing:
        return None

    updated_name = name if name is not None else existing["name"]
    updated_source = source if source is not None else existing["source"]
    updated_res = resolution if resolution is not None else existing["resolution"]
    updated_fps = fps if fps is not None else existing["fps"]
    updated_zone = zone if zone is not None else existing["zone"]

    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE cameras
            SET name = ?, source = ?, resolution = ?, fps = ?, zone = ?
            WHERE id = ?
        """, (updated_name, updated_source, updated_res, updated_fps, updated_zone, str(camera_id)))
        conn.commit()
        return get_configured_camera(camera_id)

def delete_configured_camera(camera_id: str) -> bool:
    clean_id = str(camera_id).strip()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM cameras
            WHERE id = ? OR source = ? OR name = ?
               OR id = ? OR source = ?
               OR source LIKE ?
        """, (
            clean_id, clean_id, clean_id,
            clean_id.replace("/dev/", ""), f"/dev/{clean_id}",
            f"%{clean_id}%"
        ))
        conn.commit()
        return cursor.rowcount > 0

def delete_all_configured_cameras() -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM cameras")
        cursor.execute("DELETE FROM system_config WHERE key = 'active_camera'")
        conn.commit()
        return True

def get_active_camera() -> str:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM system_config WHERE key = 'active_camera'")
        row = cursor.fetchone()
        if row and row[0]:
            return str(row[0])
        # Fallback to first configured camera in DB if available
        cursor.execute("SELECT id FROM cameras ORDER BY id ASC LIMIT 1")
        cam_row = cursor.fetchone()
        if cam_row and cam_row[0]:
            return str(cam_row[0])
        return "0"

def set_active_camera(camera_id: str) -> str:
    clean_id = str(camera_id).strip()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT OR REPLACE INTO system_config (key, value) VALUES ('active_camera', ?)", (clean_id,))
        conn.commit()
    return clean_id

def get_camera_adjustments(camera_id: str) -> Dict[str, Any]:
    clean_id = str(camera_id).strip()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM system_config WHERE key = ?", (f"camera_adjustments_{clean_id}",))
        row = cursor.fetchone()
        if row and row[0]:
            try:
                return json.loads(row[0])
            except Exception:
                pass
    return {
        "flip_h": False,
        "flip_v": False,
        "rotation": 0,
        "zoom": 1.0,
        "pan_x": 0.0,
        "pan_y": 0.0,
        "brightness": 50,
        "contrast": 50,
        "saturation": 50
    }

def set_camera_adjustments(camera_id: str, adjustments: Dict[str, Any]) -> Dict[str, Any]:
    clean_id = str(camera_id).strip()
    current = get_camera_adjustments(clean_id)
    current.update(adjustments)
    val = json.dumps(current)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)",
            (f"camera_adjustments_{clean_id}", val)
        )
        conn.commit()
    return current

def get_camera_quality_mode(camera_id: str) -> str:
    clean_id = str(camera_id).strip()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM system_config WHERE key = ?", (f"camera_quality_{clean_id}",))
        row = cursor.fetchone()
        if row and row[0]:
            mode = str(row[0]).lower().strip()
            if mode in ["sd", "hd"]:
                return mode
    return "sd" # Default to low bandwidth SD mode to save bandwidth

def set_camera_quality_mode(camera_id: str, mode: str) -> str:
    clean_id = str(camera_id).strip()
    clean_mode = "hd" if str(mode).lower().strip() == "hd" else "sd"
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)",
            (f"camera_quality_{clean_id}", clean_mode)
        )
        conn.commit()
    return clean_mode


# --- User Authentication & Management Database Operations ---

def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username.strip(),))
        row = cursor.fetchone()
        return dict(row) if row else None

def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    user = get_user_by_username(username)
    if not user:
        return None
    if _verify_password(password, user["password_hash"]):
        now = int(time.time())
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE users SET last_login = ? WHERE id = ?", (now, user["id"]))
            conn.commit()
        user["last_login"] = now
        # Do not leak password hash
        user_copy = dict(user)
        user_copy.pop("password_hash", None)
        return user_copy
    return None

def create_user(username: str, password: str, display_name: str, role: str = "operator") -> Dict[str, Any]:
    clean_user = username.strip().lower()
    existing = get_user_by_username(clean_user)
    if existing:
        raise ValueError(f"Username '{clean_user}' already exists")

    now = int(time.time())
    hashed = _hash_password(password)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (username, password_hash, display_name, role, created_at, last_login)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (clean_user, hashed, display_name.strip(), role, now, None))
        conn.commit()
        user_id = cursor.lastrowid

    return {
        "id": user_id,
        "username": clean_user,
        "display_name": display_name.strip(),
        "role": role,
        "created_at": now
    }

def update_user_password(username: str, new_password: str) -> bool:
    user = get_user_by_username(username)
    if not user:
        return False
    hashed = _hash_password(new_password)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET password_hash = ? WHERE username = ?", (hashed, username.strip()))
        conn.commit()
        return cursor.rowcount > 0

def update_user_profile(username: str, display_name: Optional[str] = None, role: Optional[str] = None) -> Optional[Dict[str, Any]]:
    user = get_user_by_username(username)
    if not user:
        return None
    new_name = display_name.strip() if display_name else user["display_name"]
    new_role = role if role else user["role"]
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET display_name = ?, role = ? WHERE username = ?", (new_name, new_role, username.strip()))
        conn.commit()
    return get_user_by_username(username)

def list_all_users() -> List[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, username, display_name, role, created_at, last_login FROM users ORDER BY created_at ASC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def delete_user(username: str) -> bool:
    if username.lower() == "admin":
        raise ValueError("Cannot delete root admin account")
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE username = ?", (username.strip(),))
        conn.commit()
        return cursor.rowcount > 0


# --- User Session & Audit Logging Database Operations ---

def create_user_session(
    session_id: str,
    username: str,
    display_name: str,
    role: str,
    ip_address: str,
    device_info: str,
    location: str,
    token: Optional[str] = None
) -> Dict[str, Any]:
    now = int(time.time())
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_sessions (
                session_id, token, username, display_name, role, ip_address,
                device_info, location, login_time, last_heartbeat, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        """, (session_id, token, username, display_name, role, ip_address, device_info, location, now, now))
        conn.commit()
        session_id_row = cursor.lastrowid

    return {
        "id": session_id_row,
        "session_id": session_id,
        "token": token,
        "username": username,
        "display_name": display_name,
        "role": role,
        "ip_address": ip_address,
        "device_info": device_info,
        "location": location,
        "login_time": now,
        "last_heartbeat": now,
        "status": "active"
    }

def get_session_by_token(token: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM user_sessions
            WHERE (token = ? OR session_id = ?) AND status = 'active'
            ORDER BY id DESC LIMIT 1
        """, (token, token))
        row = cursor.fetchone()
        return dict(row) if row else None

def update_session_heartbeat(session_id: str) -> bool:
    now = int(time.time())
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE user_sessions
            SET last_heartbeat = ?, status = 'active'
            WHERE (session_id = ? OR token = ?) AND status = 'active'
        """, (now, session_id, session_id))
        conn.commit()
        return cursor.rowcount > 0

def end_user_session(session_id: str, reason: str = "manual_logout") -> bool:
    now = int(time.time())
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE user_sessions
            SET logout_time = ?, logout_reason = ?, status = 'ended'
            WHERE (session_id = ? OR token = ?) AND status = 'active'
        """, (now, reason, session_id, session_id))
        conn.commit()
        return cursor.rowcount > 0

def cleanup_stale_sessions(timeout_seconds: int = 75) -> int:
    """Auto-mark sessions as ended if heartbeat missed for more than timeout_seconds."""
    threshold = int(time.time()) - timeout_seconds
    now = int(time.time())
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE user_sessions
            SET logout_time = last_heartbeat, logout_reason = 'tab_closed_or_timeout', status = 'ended'
            WHERE status = 'active' AND last_heartbeat < ?
        """, (threshold,))
        conn.commit()
        return cursor.rowcount

def list_user_sessions(limit: int = 100) -> List[Dict[str, Any]]:
    # Run automatic cleanup first to update inactive sessions
    cleanup_stale_sessions(75)
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, session_id, username, display_name, role, ip_address,
                   device_info, location, login_time, last_heartbeat, logout_time,
                   logout_reason, status
            FROM user_sessions
            ORDER BY login_time DESC
            LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def clear_user_sessions(keep_active: bool = False) -> int:
    with get_db() as conn:
        cursor = conn.cursor()
        if keep_active:
            cursor.execute("DELETE FROM user_sessions WHERE status != 'active'")
        else:
            cursor.execute("DELETE FROM user_sessions")
        conn.commit()
        return cursor.rowcount

def get_system_setting(key: str, default: Optional[str] = None) -> Optional[str]:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS system_config (key TEXT PRIMARY KEY, value TEXT)")
        cursor.execute("SELECT value FROM system_config WHERE key = ?", (key,))
        row = cursor.fetchone()
        return row["value"] if row else default

def set_system_setting(key: str, value: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS system_config (key TEXT PRIMARY KEY, value TEXT)")
        cursor.execute("INSERT OR REPLACE INTO system_config (key, value) VALUES (?, ?)", (key, str(value)))
        conn.commit()


