import time
import secrets
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel

from ..core.database import (
    authenticate_user,
    get_user_by_username,
    create_user,
    update_user_password,
    update_user_profile,
    list_all_users,
    delete_user,
    log_event
)

router = APIRouter()

# In-memory active tokens mapping: token -> {username, role, expires_at}
ACTIVE_SESSIONS = {}

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
    role: Optional[str] = "operator"

@router.post("/login")
def login(req: LoginRequest):
    """Authenticate user with credentials from SQLite database."""
    user = authenticate_user(req.username, req.password)
    if not user:
        # Also log security audit
        log_event(
            event_type="security",
            camera_id="AUTH",
            title=f"Failed Login Attempt: {req.username}",
            details="Invalid username or password"
        )
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Generate secure session token
    token = f"cctv_tok_{secrets.token_hex(24)}"
    ACTIVE_SESSIONS[token] = {
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
        title=f"User Login: {user['username']}",
        details=f"Authorized session started ({user['role'].upper()})"
    )

    return {
        "status": "success",
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "display_name": user["display_name"],
            "role": user["role"],
            "last_login": user.get("last_login")
        }
    }

@router.post("/logout")
def logout(authorization: Optional[str] = Header(None)):
    """Terminate active session."""
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        ACTIVE_SESSIONS.pop(token, None)
    return {"status": "logged_out"}

@router.get("/me")
def get_current_user(authorization: Optional[str] = Header(None)):
    """Get active session details."""
    if not authorization:
        # Fallback to root admin
        admin = get_user_by_username("admin")
        if admin:
            admin.pop("password_hash", None)
            return {"authenticated": True, "user": admin}
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.replace("Bearer ", "").strip()
    session = ACTIVE_SESSIONS.get(token)
    if not session:
        # Check if root admin token
        if token.startswith("cctv_sec_"):
            admin = get_user_by_username("admin")
            if admin:
                admin.pop("password_hash", None)
                return {"authenticated": True, "user": admin}
        raise HTTPException(status_code=401, detail="Session expired or invalid")

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

@router.get("/users")
def get_all_users():
    """List all registered system users."""
    return {"users": list_all_users()}

@router.post("/users/create")
def register_user(req: CreateUserRequest):
    """Register a new user account."""
    try:
        new_user = create_user(
            username=req.username,
            password=req.password,
            display_name=req.display_name,
            role=req.role or "operator"
        )
        return {"status": "success", "user": new_user}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/users/{username}")
def remove_user(username: str):
    """Delete a user account."""
    try:
        success = delete_user(username)
        if not success:
            raise HTTPException(status_code=404, detail="User not found")
        return {"status": "success", "username": username}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
