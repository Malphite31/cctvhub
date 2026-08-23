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
        
        # Test Case 1: Local mount directory (e.g. /mnt/samba/cctv)
        mount_path = (cfg.get("local_mount_path") or "").strip()
        host = (cfg.get("host") or "").strip()
        share = (cfg.get("share") or "").strip()

        if mount_path and not host:
            p = Path(mount_path)
            if p.exists() and os.access(str(p), os.W_OK):
                return {"success": True, "message": f"Verified write access to local mount '{mount_path}'!"}
            elif p.exists():
                return {"success": False, "error": f"Path '{mount_path}' exists but is not writable."}
            else:
                return {"success": False, "error": f"Mount path '{mount_path}' does not exist on host."}

        # Test Case 2: Direct SMB protocol connection
        user = (cfg.get("username") or "").strip() or None
        password = cfg.get("password")
        if password in ["••••••••", "••••"]:
            password = self.config.get("password")

        if not host or not share:
            if mount_path:
                p = Path(mount_path)
                if p.exists() and os.access(str(p), os.W_OK):
                    return {"success": True, "message": f"Verified write access to mount '{mount_path}'!"}
            return {"success": False, "error": "Please provide Host/IP, Share Name, and Login credentials."}

        try:
            import smbclient
            # Clear previous session cache
            try:
                smbclient.reset_connection_cache()
            except Exception:
                pass
            smbclient.register_session(host, username=user, password=password)
            unc_path = f"\\\\{host}\\{share}"
            smbclient.listdir(unc_path)
            return {"success": True, "message": f"Successfully authenticated to SMB Share '{unc_path}'!"}
        except Exception as e:
            return {"success": False, "error": f"SMB Login Error: {str(e)}"}

    def sync_file(self, file_path: Path) -> Dict[str, Any]:
        if not self.config.get("enabled"):
            return {"success": False, "error": "Samba storage is disabled"}

        if not file_path.exists():
            return {"success": False, "error": "Local file not found"}

        # Option A: Local / CIFS mount copy
        mount_path = self.config.get("local_mount_path")
        if mount_path:
            dest_dir = Path(mount_path)
            if dest_dir.exists():
                dest_file = dest_dir / file_path.name
                shutil.copy2(str(file_path), str(dest_file))
                return {"success": True, "destination": str(dest_file)}

        # Option B: Direct smbclient transfer
        host = self.config.get("host")
        share = self.config.get("share")
        user = self.config.get("username")
        password = self.config.get("password")

        if host and share:
            try:
                import smbclient
                smbclient.register_session(host, username=user, password=password)
                unc_dest = f"\\\\{host}\\{share}\\{file_path.name}"
                with open(file_path, "rb") as local_f:
                    with smbclient.open_file(unc_dest, mode="wb") as smb_f:
                        shutil.copyfileobj(local_f, smb_f)
                return {"success": True, "destination": unc_dest}
            except Exception as e:
                logger.error(f"Samba file sync failed for {file_path.name}: {e}")
                return {"success": False, "error": str(e)}

        return {"success": False, "error": "No valid Samba mount or host configured"}

samba_storage = SambaStorageService()
