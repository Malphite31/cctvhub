import os
import time
import psutil
from fastapi import APIRouter
from ..services.camera_worker import camera_manager

router = APIRouter()

_last_net_time = time.time()
_last_net_io = psutil.net_io_counters()

@router.get("/system")
def get_system_telemetry():
    """Returns real-time CPU, RAM, Disk, Network throughput, and System Uptime."""
    global _last_net_time, _last_net_io
    
    cpu_percent = psutil.cpu_percent(interval=None)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage('/')

    # System Uptime
    boot_time = psutil.boot_time()
    uptime_secs = int(time.time() - boot_time)
    days = uptime_secs // 86400
    hours = (uptime_secs % 86400) // 3600
    mins = (uptime_secs % 3600) // 60
    uptime_str = f"{days}d {hours}h {mins}m" if days > 0 else f"{hours}h {mins}m"

    # Real Network I/O
    now = time.time()
    current_net_io = psutil.net_io_counters()
    elapsed = max(0.1, now - _last_net_time)
    
    sent_bps = (current_net_io.bytes_sent - _last_net_io.bytes_sent) * 8 / elapsed
    recv_bps = (current_net_io.bytes_recv - _last_net_io.bytes_recv) * 8 / elapsed
    
    _last_net_time = now
    _last_net_io = current_net_io

    sent_mbps = round(sent_bps / 1_000_000, 1)
    recv_mbps = round(recv_bps / 1_000_000, 1)

    return {
        "cpu_percent": round(cpu_percent, 1),
        "ram_used_mb": round(ram.used / (1024 * 1024), 1),
        "ram_total_mb": round(ram.total / (1024 * 1024), 1),
        "ram_percent": round(ram.percent, 1),
        "disk_free_gb": round(disk.free / (1024 * 1024 * 1024), 2),
        "disk_total_gb": round(disk.total / (1024 * 1024 * 1024), 2),
        "disk_percent": round(disk.percent, 1),
        "cpu_count": psutil.cpu_count(logical=True) or 4,
        "uptime_seconds": uptime_secs,
        "uptime_formatted": uptime_str,
        "network_sent_mbps": sent_mbps,
        "network_recv_mbps": recv_mbps
    }

@router.get("/devices")
def get_camera_devices():
    """Returns all real verified camera devices on the host."""
    devices = camera_manager.get_available_cameras()
    return {"devices": devices, "cameras": devices}

@router.get("/version")
def get_version_info():
    """Returns application version, Git commit hash, and branch."""
    import subprocess
    commit = "v2.1.0"
    branch = "main"
    try:
        commit = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], stderr=subprocess.DEVNULL).decode().strip()
        branch = subprocess.check_output(["git", "rev-parse", "--abbrev-ref", "HEAD"], stderr=subprocess.DEVNULL).decode().strip()
    except Exception:
        pass

    return {
        "version": "2.1.0",
        "commit": commit,
        "branch": branch,
        "git_upgradable": True
    }
