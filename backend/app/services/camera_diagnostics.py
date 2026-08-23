import subprocess
import shutil
import re
import psutil
from typing import Dict, Any, List
from ..core.config import settings

def get_v4l2_devices() -> List[Dict[str, Any]]:
    """List available video devices using v4l2-ctl or /dev/video* entries."""
    devices = []
    if not shutil.which("v4l2-ctl"):
        # Fallback inspection if v4l2-ctl is not installed
        import glob
        for dev in sorted(glob.glob("/dev/video*")):
            devices.append({
                "device": dev,
                "name": f"Camera Device ({dev})",
                "formats": ["Unknown (v4l2-utils not installed)"]
            })
        return devices

    try:
        output = subprocess.check_output(["v4l2-ctl", "--list-devices"], text=True, stderr=subprocess.DEVNULL)
        current_name = "Unknown Camera"
        for line in output.splitlines():
            line = line.strip()
            if not line:
                continue
            if not line.startswith("/dev/video"):
                current_name = line.rstrip(":")
            else:
                devices.append({
                    "device": line,
                    "name": current_name,
                    "formats": get_device_formats(line)
                })
    except Exception as e:
        devices.append({"device": settings.DEFAULT_DEVICE, "name": "Default Webcam", "error": str(e)})
        
    return devices

def get_device_formats(device_path: str) -> List[str]:
    """Query supported formats and frame rates for a specific V4L2 device."""
    try:
        output = subprocess.check_output(
            ["v4l2-ctl", "-d", device_path, "--list-formats-ext"], 
            text=True, 
            stderr=subprocess.DEVNULL
        )
        formats = []
        for line in output.splitlines():
            if "Size: Discrete" in line or "Interval: Discrete" in line or "Pixel Format:" in line:
                formats.append(line.strip())
        return formats[:15] # Return top 15 entries
    except Exception:
        return ["N/A"]

def get_system_telemetry() -> Dict[str, Any]:
    """Get host/container CPU, RAM, Disk, and uptime stats."""
    cpu_percent = psutil.cpu_percent(interval=0.1)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage(str(settings.DATA_DIR))
    
    return {
        "cpu_percent": cpu_percent,
        "ram_used_mb": round(ram.used / (1024 * 1024), 1),
        "ram_total_mb": round(ram.total / (1024 * 1024), 1),
        "ram_percent": ram.percent,
        "disk_free_gb": round(disk.free / (1024 * 1024 * 1024), 2),
        "disk_total_gb": round(disk.total / (1024 * 1024 * 1024), 2),
        "disk_percent": disk.percent,
        "cpu_count": psutil.cpu_count(logical=True)
    }
