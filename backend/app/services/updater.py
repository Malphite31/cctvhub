import os
import time
import json
import httpx
import logging
import threading
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from ..core.config import settings
from ..core.database import get_db, log_event

logger = logging.getLogger("updater")

GITHUB_REPO = "Malphite31/cctvhub"
GITHUB_API_URL = f"https://api.github.com/repos/{GITHUB_REPO}/commits/main"

class AppUpdaterService:
    def __init__(self):
        self.is_updating = False
        self.update_status = "idle" # idle | downloading | installing | building | restarting | success | error
        self.update_logs: List[str] = []
        self.error_message: Optional[str] = None
        self.last_check_info: Dict[str, Any] = self._load_last_check()
        self._lock = threading.Lock()

        # Start periodic background update checker thread
        t = threading.Thread(target=self._background_check_loop, daemon=True)
        t.start()

    def _load_last_check(self) -> Dict[str, Any]:
        default = {
            "update_available": False,
            "current_commit": self.get_current_commit(),
            "latest_commit": self.get_current_commit(),
            "latest_commit_message": "",
            "latest_commit_date": "",
            "last_checked": 0
        }
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT value FROM system_config WHERE key = 'last_update_check'")
                row = cursor.fetchone()
                if row:
                    loaded = json.loads(row[0])
                    default.update(loaded)
        except Exception:
            pass
        return default

    def _save_last_check(self, data: Dict[str, Any]):
        self.last_check_info = data
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT OR REPLACE INTO system_config (key, value) VALUES ('last_update_check', ?)",
                    (json.dumps(data),)
                )
                conn.commit()
        except Exception:
            pass

    def get_current_commit(self) -> str:
        try:
            return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], stderr=subprocess.DEVNULL).decode().strip()
        except Exception:
            return "main"

    def get_current_branch(self) -> str:
        try:
            return subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"], stderr=subprocess.DEVNULL).decode().strip()
        except Exception:
            return "main"

    def check_for_updates(self, force: bool = False) -> Dict[str, Any]:
        """Queries GitHub for latest commit and checks if a newer version is available."""
        current_commit = self.get_current_commit()
        branch = self.get_current_branch()
        now = int(time.time())

        # If checked within last 60 seconds and not forced, return cached info
        if not force and (now - self.last_check_info.get("last_checked", 0) < 60):
            self.last_check_info["current_commit"] = current_commit
            return self.last_check_info

        latest_sha = current_commit
        commit_msg = ""
        commit_date = ""
        update_available = False

        # 1. Try GitHub API
        try:
            with httpx.Client(timeout=8.0) as client:
                res = client.get(
                    GITHUB_API_URL,
                    headers={"User-Agent": "CCTV-Hub-Updater", "Accept": "application/vnd.github.v3+json"}
                )
                if res.status_code == 200:
                    data = res.json()
                    full_sha = data.get("sha", "")
                    latest_sha = full_sha[:7] if full_sha else current_commit
                    commit_msg = data.get("commit", {}).get("message", "").split("\n")[0]
                    commit_date = data.get("commit", {}).get("author", {}).get("date", "")
        except Exception as e:
            logger.warning(f"GitHub API check failed: {e}")

        # 2. Fallback: Git ls-remote if API failed or rate-limited
        if latest_sha == current_commit:
            try:
                out = subprocess.check_output(
                    ["git", "ls-remote", "origin", f"refs/heads/{branch}"],
                    stderr=subprocess.DEVNULL,
                    timeout=10
                ).decode().strip()
                if out:
                    full_sha = out.split()[0]
                    latest_sha = full_sha[:7]
            except Exception:
                pass

        if latest_sha and current_commit and latest_sha.lower() != current_commit.lower() and current_commit != "main":
            update_available = True

        result = {
            "update_available": update_available,
            "current_commit": current_commit,
            "latest_commit": latest_sha,
            "latest_commit_message": commit_msg or "New system features & performance updates",
            "latest_commit_date": commit_date,
            "branch": branch,
            "last_checked": now
        }
        self._save_last_check(result)

        # Log an event in DB if an update was newly detected
        if update_available:
            try:
                log_event(
                    event_type="update",
                    camera_id="SYS",
                    title="System Update Available",
                    details=f"Build {latest_sha} is ready to install. {commit_msg}"
                )
            except Exception:
                pass

        return result

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "is_updating": self.is_updating,
                "status": self.update_status,
                "logs": list(self.update_logs[-30:]),
                "error": self.error_message,
                "check_info": self.last_check_info
            }

    def apply_update(self) -> Dict[str, Any]:
        """Starts the update process in a background thread."""
        with self._lock:
            if self.is_updating:
                return {"success": False, "error": "An update is already in progress"}
            self.is_updating = True
            self.update_status = "downloading"
            self.update_logs = [">> Initializing CCTV Surveillance Hub update..."]
            self.error_message = None

        def _worker():
            def _log(msg: str):
                logger.info(msg)
                with self._lock:
                    self.update_logs.append(msg)

            try:
                install_dir = Path("/opt/cctv-hub")
                if not install_dir.exists():
                    # Local repo path fallback
                    install_dir = Path(__file__).resolve().parent.parent.parent.parent

                _log(f">> Application directory: {install_dir}")

                # Step 1: Pull Git updates
                _log(">> [1/4] Fetching and pulling latest code from GitHub...")
                self.update_status = "downloading"
                res = subprocess.run(
                    ["git", "pull", "origin", "main"],
                    cwd=str(install_dir),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    timeout=60
                )
                _log(res.stdout.strip())
                if res.returncode != 0:
                    raise Exception(f"Git pull failed: {res.stdout}")

                # Step 2: Update Python dependencies
                _log(">> [2/4] Upgrading backend dependencies...")
                self.update_status = "installing"
                pip_exe = install_dir / ".venv" / "bin" / "pip"
                if not pip_exe.exists():
                    pip_exe = "pip3"
                else:
                    pip_exe = str(pip_exe)

                req_file = install_dir / "backend" / "requirements.txt"
                if req_file.exists():
                    res = subprocess.run(
                        [pip_exe, "install", "-r", str(req_file)],
                        cwd=str(install_dir),
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        timeout=120
                    )
                    _log(">> Python packages verified.")

                # Step 3: Compile React Frontend
                _log(">> [3/4] Compiling frontend UI bundle...")
                self.update_status = "building"
                frontend_dir = install_dir / "frontend"
                if frontend_dir.exists() and (frontend_dir / "package.json").exists():
                    npm_build = subprocess.run(
                        ["npm", "run", "build"],
                        cwd=str(frontend_dir),
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        timeout=180
                    )
                    if npm_build.returncode == 0:
                        _log(">> Frontend production bundle built successfully.")
                    else:
                        _log(f">> Warning during frontend build: {npm_build.stdout}")

                # Step 4: Restart Service
                _log(">> [4/4] Restarting CCTV Hub systemd service...")
                self.update_status = "restarting"
                _log(">> System is restarting. Web UI will auto-reconnect in 5 seconds.")
                
                # Check for new commit after update
                new_commit = self.get_current_commit()
                self.last_check_info["current_commit"] = new_commit
                self.last_check_info["update_available"] = False
                self._save_last_check(self.last_check_info)

                with self._lock:
                    self.update_status = "success"
                    self.is_updating = False

                # Delay slightly so client receives "restarting" status before daemon restart
                time.sleep(2)
                
                if os.name != 'nt':
                    subprocess.Popen(["systemctl", "restart", "cctv-hub"])

            except Exception as e:
                logger.error(f"Update error: {e}")
                _log(f"[!] Update error: {str(e)}")
                with self._lock:
                    self.update_status = "error"
                    self.error_message = str(e)
                    self.is_updating = False

        t = threading.Thread(target=_worker, daemon=True)
        t.start()
        return {"success": True, "status": "started"}

    def _background_check_loop(self):
        """Periodically checks GitHub for updates every 30 minutes."""
        time.sleep(15) # Wait for server boot
        while True:
            try:
                self.check_for_updates()
            except Exception as e:
                logger.debug(f"Periodic update check error: {e}")
            time.sleep(1800) # 30 minutes

updater_service = AppUpdaterService()
