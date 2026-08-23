import os
import json
import shutil
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from ..core.config import settings

logger = logging.getLogger("samba_storage")
CONFIG_FILE = settings.CONFIG_DIR / "samba_config.json"

class SambaStorageService:
    def __init__(self):
        self.config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        default = {
            "enabled": settings.SAMBA_ENABLED,
            "host": settings.SAMBA_HOST,
            "share": settings.SAMBA_SHARE,
            "username": settings.SAMBA_USERNAME,
            "password": settings.SAMBA_PASSWORD,
            "local_mount_path": settings.SAMBA_LOCAL_MOUNT_PATH,
            "auto_sync": settings.SAMBA_AUTO_SYNC,
        }
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r") as f:
                    saved = json.load(f)
                    default.update(saved)
            except Exception as e:
                logger.error(f"Failed to load Samba config: {e}")
        return default

    def save_config(self, new_config: Dict[str, Any]) -> Dict[str, Any]:
        cfg_copy = dict(new_config)
        if cfg_copy.get("password") in ["••••••••", "••••"]:
            cfg_copy["password"] = self.config.get("password", "")
        self.config.update(cfg_copy)
        try:
            with open(CONFIG_FILE, "w") as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save Samba config: {e}")
        return self.get_config()

    def get_config(self) -> Dict[str, Any]:
        masked = dict(self.config)
        if masked.get("password"):
            masked["password"] = "••••••••" if len(masked["password"]) > 4 else "••••"
        return masked

    def test_connection(self, config_to_test: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        cfg = dict(config_to_test or self.config)
        mount_path = (cfg.get("local_mount_path") or "").strip()
        host = (cfg.get("host") or "").strip()
        share = (cfg.get("share") or "").strip()
        user = (cfg.get("username") or "").strip() or None
        password = cfg.get("password")
        if password in ["••••••••", "••••"]:
            password = self.config.get("password")

        # Normalize Windows UNC paths (e.g. \\samba\Share or \\192.168.1.100\share)
        if mount_path.startswith("\\\\") or mount_path.startswith("//") or mount_path.startswith("smb://"):
            cleaned = mount_path.replace("smb://", "").replace("/", "\\").lstrip("\\")
            parts = [p for p in cleaned.split("\\") if p]
            if len(parts) >= 2:
                if not host:
                    host = parts[0]
                if not share:
                    share = parts[1]
            mount_path = ""

        # Case 1: Direct Network SMB protocol connection (Host IP + Share Name)
        if host and share:
            try:
                import smbclient
                try:
                    smbclient.reset_connection_cache()
                except Exception:
                    pass
                try:
                    smbclient.register_session(host, username=user, password=password, connection_timeout=10)
                except TypeError:
                    smbclient.register_session(host, username=user, password=password)
                unc_path = f"\\\\{host}\\{share}"
                smbclient.listdir(unc_path)
                return {
                    "success": True,
                    "message": f"Successfully connected to network SMB share '{unc_path}'!"
                }
            except Exception as e:
                err_msg = str(e)
                if "ConnectionRefusedError" in err_msg or "timed out" in err_msg.lower():
                    return {"success": False, "error": f"Could not reach Samba host {host}:445 (Check IP or firewall)."}
                elif "STATUS_LOGON_FAILURE" in err_msg or "Logon failure" in err_msg:
                    return {"success": False, "error": "Invalid Samba username or password."}
                elif "STATUS_BAD_NETWORK_NAME" in err_msg or "No such file" in err_msg:
                    return {"success": False, "error": f"Share '{share}' not found on server {host}."}
                return {"success": False, "error": f"SMB Connection Error: {err_msg}"}

        # Case 2: Local Linux CIFS / Mount directory (e.g. /mnt/nas or /media/share)
        if mount_path:
            try:
                p = Path(mount_path)
                if not p.exists():
                    try:
                        p.mkdir(parents=True, exist_ok=True)
                    except Exception:
                        pass
                if p.exists() and os.access(str(p), os.W_OK):
                    return {"success": True, "message": f"Verified write access to local directory '{mount_path}'!"}
                elif p.exists():
                    return {"success": False, "error": f"Path '{mount_path}' exists but is not writable."}
                else:
                    return {"success": False, "error": f"Directory '{mount_path}' does not exist on host."}
            except Exception as e:
                return {"success": False, "error": f"Local path error: {e}"}

        return {
            "success": False,
            "error": "Please enter Host / Server IP (e.g. 192.168.1.100) and Share Name (e.g. share)."
        }

    def sync_file(self, file_path: Path) -> Dict[str, Any]:
        if not self.config.get("enabled"):
            return {"success": False, "error": "Samba storage is disabled"}

        if not file_path.exists():
            return {"success": False, "error": "Local file not found"}

        host = (self.config.get("host") or "").strip()
        share = (self.config.get("share") or "").strip()
        user = (self.config.get("username") or "").strip() or None
        password = self.config.get("password")
        mount_path = (self.config.get("local_mount_path") or "").strip()

        # Normalize UNC paths
        if mount_path.startswith("\\\\") or mount_path.startswith("//") or mount_path.startswith("smb://"):
            cleaned = mount_path.replace("smb://", "").replace("/", "\\").lstrip("\\")
            parts = [p for p in cleaned.split("\\") if p]
            if len(parts) >= 2:
                if not host:
                    host = parts[0]
                if not share:
                    share = parts[1]
                mount_path = ""

        # Option A: Direct SMB network transfer via smbclient
        if host and share:
            try:
                import smbclient
                try:
                    smbclient.register_session(host, username=user, password=password, connection_timeout=20)
                except TypeError:
                    smbclient.register_session(host, username=user, password=password)
                unc_dest = f"\\\\{host}\\{share}\\{file_path.name}"
                with open(file_path, "rb") as local_f:
                    with smbclient.open_file(unc_dest, mode="wb") as smb_f:
                        shutil.copyfileobj(local_f, smb_f)
                return {"success": True, "destination": unc_dest}
            except Exception as e:
                logger.error(f"Samba file sync failed for {file_path.name}: {e}")
                if not mount_path:
                    return {"success": False, "error": str(e)}

        # Option B: Local CIFS mount copy
        if mount_path:
            try:
                dest_dir = Path(mount_path)
                dest_dir.mkdir(parents=True, exist_ok=True)
                dest_file = dest_dir / file_path.name
                shutil.copy2(str(file_path), str(dest_file))
                return {"success": True, "destination": str(dest_file)}
            except Exception as e:
                return {"success": False, "error": f"Local mount sync failed: {e}"}

        return {"success": False, "error": "No valid Samba host/share or mount path configured"}

samba_storage = SambaStorageService()
