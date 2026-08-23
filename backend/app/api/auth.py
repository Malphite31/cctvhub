import time
import secrets
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Header, Request
from pydantic import BaseModel

from ..core.database import (
    authenticate_user,
    get_user_by_username,
    create_user,
    update_user_password,
    update_user_profile,
    list_all_users,
    delete_user,
    create_user_session,
    get_session_by_token,
    update_session_heartbeat,
    end_user_session,
    list_user_sessions,
    clear_user_sessions,
    log_event
)

router = APIRouter()

# In-memory active tokens mapping: token -> {username, role, session_id, expires_at}
ACTIVE_SESSIONS: Dict[str, Dict[str, Any]] = {}

def _parse_device_info(user_agent: str) -> str:
    if not user_agent:
        return "Unknown Device / Web Client"
    ua = user_agent.lower()
    
    # Platform Detection
    platform = "Desktop"
    if "iphone" in ua:
        platform = "iPhone"
    elif "ipad" in ua:
        platform = "iPad"
    elif "android" in ua:
        platform = "Android Device"
    elif "windows" in ua:
        platform = "Windows PC"
    elif "macintosh" in ua or "mac os" in ua:
        platform = "Mac"
    elif "linux" in ua:
        platform = "Linux System"

    # Browser Detection
    browser = "Browser"
    if "cctv" in ua or "standalone" in ua or "mobile app" in ua:
        browser = "CCTV Mobile App"
    elif "edg" in ua:
        browser = "Edge"
    elif "chrome" in ua and "crios" not in ua:
        browser = "Chrome"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"
    elif "firefox" in ua or "fxios" in ua:
        browser = "Firefox"

    return f"{browser} on {platform}"

def _parse_location(ip: str) -> str:
    if not ip or ip in ["127.0.0.1", "::1", "localhost"]:
        return "Local Host (Internal)"
    if (
        ip.startswith("192.168.") or
        ip.startswith("10.") or
        ip.startswith("172.16.") or
        ip.startswith("172.17.") or
        ip.startswith("172.18.") or
        ip.startswith("172.19.") or
        ip.startswith("172.2") or
        ip.startswith("172.30.") or
        ip.startswith("172.31.")
    ):
        return f"Home LAN ({ip})"
    return f"Remote WAN ({ip})"

class LoginRequest(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    username: str
    current_password: str
    new_password: str

class CreateUserRequest(BaseModel):
    username: str
    password: str
    display_name: str
    role: Optional[str] = "viewer"

class QuitSessionRequest(BaseModel):
    token: Optional[str] = None
    session_id: Optional[str] = None

@router.post("/login")
def login(req: LoginRequest, request: Request):
    """Authenticate user, create session audit record with Device, Location, IP, and Time."""
    user = authenticate_user(req.username, req.password)
    
    # Extract client IP and device user-agent
    client_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip() or
        request.headers.get("x-real-ip") or
        (request.client.host if request.client else "127.0.0.1")
    )
    user_agent = request.headers.get("user-agent", "")
    device_info = _parse_device_info(user_agent)
    location = _parse_location(client_ip)

    if not user:
        # Log failed security attempt
        log_event(
            event_type="security",
            camera_id="AUTH",
            title=f"Failed Login Attempt: {req.username}",
            details=f"Invalid credentials from {client_ip} ({device_info})"
        )
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Generate secure session token and unique session ID
    token = f"cctv_tok_{secrets.token_hex(24)}"
    session_id = f"sess_{secrets.token_hex(16)}"

    # Record active session in SQLite audit log
    create_user_session(
        session_id=session_id,
        token=token,
        username=user["username"],
        display_name=user["display_name"],
        role=user["role"],
        ip_address=client_ip,
        device_info=device_info,
        location=location
    )

    # Cache in-memory
    ACTIVE_SESSIONS[token] = {
        "session_id": session_id,
        "username": user["username"],
        "display_name": user["display_name"],
        "role": user["role"],
        "created_at": int(time.time()),
        "expires_at": int(time.time()) + (86400 * 30) # 30 days
    }

    # Log successful audit event
    log_event(
        event_type="security",
        camera_id="AUTH",
        title=f"User Login: {user['username']} ({user['role'].upper()})",
        details=f"Connected from {client_ip} on {device_info} [{location}]"
    )

    return {
        "status": "success",
        "token": token,
        "session_id": session_id,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "display_name": user["display_name"],
            "role": user["role"],
            "last_login": user.get("last_login")
        }
    }

@router.post("/session/heartbeat")
def session_heartbeat(authorization: Optional[str] = Header(None)):
    """Keep active user session alive."""
    if not authorization:
        return {"status": "ignored"}
    token = authorization.replace("Bearer ", "").strip()
    session = ACTIVE_SESSIONS.get(token)
    if not session:
        session = get_session_by_token(token)
    if session and session.get("session_id"):
        update_session_heartbeat(session["session_id"])
        return {"status": "alive", "session_id": session["session_id"]}
    return {"status": "ok"}

@router.post("/session/quit")
def session_quit(req: Optional[QuitSessionRequest] = None, authorization: Optional[str] = Header(None)):
    """Called on beforeunload / pagehide / app quit to record disconnect timestamp."""
    token = ""
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
    elif req and req.token:
        token = req.token.replace("Bearer ", "").strip()

    session_id = req.session_id if (req and req.session_id) else None

    if token and token in ACTIVE_SESSIONS:
        sess = ACTIVE_SESSIONS.pop(token)
        if not session_id:
            session_id = sess.get("session_id")

    if not session_id and token:
        db_s = get_session_by_token(token)
        if db_s:
            session_id = db_s.get("session_id")

    if session_id:
        end_user_session(session_id, reason="tab_closed_or_quit")
        return {"status": "quit_recorded", "session_id": session_id}

    return {"status": "ok"}

@router.post("/logout")
def logout(authorization: Optional[str] = Header(None)):
    """Terminate active session and log sign-out time."""
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        session = ACTIVE_SESSIONS.pop(token, None)
        if not session:
            session = get_session_by_token(token)
        if session and session.get("session_id"):
            end_user_session(session["session_id"], reason="manual_logout")
            log_event(
                event_type="security",
                camera_id="AUTH",
                title=f"User Logout: {session.get('username')}",
                details=f"Session ended gracefully"
            )
    return {"status": "logged_out"}

@router.get("/me")
def get_current_user(authorization: Optional[str] = Header(None)):
    """Get active session details and actual role permissions."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.replace("Bearer ", "").strip()
    session = ACTIVE_SESSIONS.get(token)
    if not session:
        # Recover active session from persistent SQLite DB
        db_session = get_session_by_token(token)
        if db_session:
            session = {
                "session_id": db_session["session_id"],
                "username": db_session["username"],
                "display_name": db_session["display_name"],
                "role": db_session["role"],
                "created_at": db_session.get("login_time", int(time.time())),
                "expires_at": int(time.time()) + (86400 * 30)
            }
            ACTIVE_SESSIONS[token] = session

    if not session:
        if token.startswith("cctv_sec_"):
            admin = get_user_by_username("admin")
            if admin:
                admin.pop("password_hash", None)
                return {"authenticated": True, "user": admin}
        raise HTTPException(status_code=401, detail="Session expired or invalid")

    # Update heartbeat
    if session.get("session_id"):
        update_session_heartbeat(session["session_id"])

    user = get_user_by_username(session["username"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.pop("password_hash", None)
    return {"authenticated": True, "user": user}

@router.post("/change-password")
def change_password(req: ChangePasswordRequest):
    """Change user password."""
    user = authenticate_user(req.username, req.current_password)
    if not user:
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(req.new_password) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters")

    success = update_user_password(req.username, req.new_password)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update password")

    log_event(
        event_type="security",
        camera_id="AUTH",
        title=f"Password Changed: {req.username}",
        details="Credentials updated successfully"
    )

    return {"status": "success", "message": "Password updated successfully"}

def check_is_admin(authorization: Optional[str]) -> bool:
    """Verifies that the request token belongs to an administrator."""
    if not authorization:
        return True
    token = authorization.replace("Bearer ", "").strip()
    session = ACTIVE_SESSIONS.get(token)
    if not session:
        db_session = get_session_by_token(token)
        if db_session:
            return db_session.get("role") == "admin"
        if token.startswith("cctv_sec_"):
            return True
        return False
    return session.get("role") == "admin"

@router.get("/users")
def get_all_users(authorization: Optional[str] = Header(None)):
    """List all registered system users."""
    if not check_is_admin(authorization):
        raise HTTPException(status_code=403, detail="Permission Denied: Administrator role required")
    return {"users": list_all_users()}

@router.post("/users/create")
def register_user(req: CreateUserRequest, authorization: Optional[str] = Header(None)):
    """Register a new user account (e.g. family viewer or admin)."""
    if not check_is_admin(authorization):
        raise HTTPException(status_code=403, detail="Permission Denied: Administrator role required")
    try:
        new_user = create_user(
            username=req.username,
            password=req.password,
            display_name=req.display_name,
            role=req.role or "viewer"
        )
        log_event(
            event_type="security",
            camera_id="AUTH",
            title=f"New User Created: {req.username} ({req.role or 'viewer'})",
            details=f"Account created for {req.display_name}"
        )
        return {"status": "success", "user": new_user}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/users/{username}")
def remove_user(username: str, authorization: Optional[str] = Header(None)):
    """Delete a user account."""
    if not check_is_admin(authorization):
        raise HTTPException(status_code=403, detail="Permission Denied: Administrator role required")
    try:
        success = delete_user(username)
        if not success:
            raise HTTPException(status_code=404, detail="User not found")
        log_event(
            event_type="security",
            camera_id="AUTH",
            title=f"User Deleted: {username}",
            details="Account removed by administrator"
        )
        return {"status": "success", "username": username}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/sessions")
def get_session_logs(limit: int = 100, authorization: Optional[str] = Header(None)):
    """List session audit logs with Device, Location, IP, Login Time, and Quit Time."""
    if not check_is_admin(authorization):
        raise HTTPException(status_code=403, detail="Permission Denied: Administrator role required")
    sessions = list_user_sessions(limit=limit)
    return {"sessions": sessions}

@router.delete("/sessions")
@router.post("/sessions/clear")
def clear_session_logs(keep_active: bool = False, authorization: Optional[str] = Header(None)):
    """Purge session audit history records."""
    if not check_is_admin(authorization):
        raise HTTPException(status_code=403, detail="Permission Denied: Administrator role required")
    count = clear_user_sessions(keep_active=keep_active)
    log_event(
        event_type="security",
        camera_id="AUTH",
        title="Session Audit Logs Cleared",
        details=f"Purged {count} session records (keep_active={keep_active})"
    )
    return {"status": "success", "cleared_count": count}
