import os
import time
import socket
import platform
import psutil
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import APIRouter
from ..services.camera_worker import camera_manager

router = APIRouter()

_last_net_time = time.time()
_last_net_io = psutil.net_io_counters()

def get_hardware_diagnostics() -> Dict[str, Any]:
    """Inspects battery status, hardware thermal sensors, and system device identity."""
    # 1. Battery Telemetry
    battery_info: Dict[str, Any] = {
        "has_battery": False,
        "percent": None,
        "power_plugged": True,
        "status": "AC Mains Supply (No Battery)",
        "time_left_formatted": None,
        "power_source": "Direct AC Mains Supply",
        "voltage_v": None,
        "power_w": None,
        "health_percent": None,
        "cycle_count": None,
        "technology": None,
        "model": None
    }

    # Step A: Check psutil
    try:
        if hasattr(psutil, "sensors_battery"):
            b = psutil.sensors_battery()
            if b is not None:
                is_plugged = bool(b.power_plugged) if b.power_plugged is not None else True
                secs = b.secsleft if (b.secsleft is not None and b.secsleft > 0) else None
                time_left_str = None
                if secs and secs != psutil.POWER_TIME_UNLIMITED:
                    hrs = secs // 3600
                    mins = (secs % 3600) // 60
                    if is_plugged:
                        time_left_str = f"{hrs}h {mins}m until full" if hrs > 0 else f"{mins}m until full"
                    else:
                        time_left_str = f"{hrs}h {mins}m remaining" if hrs > 0 else f"{mins}m remaining"

                if is_plugged:
                    status_text = "AC Connected (100% Fully Charged)" if b.percent >= 99 else "AC Connected (Charging)"
                else:
                    status_text = f"Discharging on Battery ({b.percent}%)"

                battery_info.update({
                    "has_battery": True,
                    "percent": round(b.percent, 1),
                    "power_plugged": is_plugged,
                    "status": status_text,
                    "time_left_formatted": time_left_str,
                    "power_source": "AC Adapter (Charging)" if is_plugged else "Internal Battery Power"
                })
    except Exception:
        pass

    # Step B: Check Linux sysfs /sys/class/power_supply/
    if os.name != "nt":
        try:
            ps_path = Path("/sys/class/power_supply")
            if ps_path.exists():
                for bat in ps_path.glob("BAT*"):
                    battery_info["has_battery"] = True

                    cap_file = bat / "capacity"
                    if cap_file.exists():
                        try:
                            battery_info["percent"] = float(cap_file.read_text().strip())
                        except Exception:
                            pass

                    status_file = bat / "status"
                    if status_file.exists():
                        raw_status = status_file.read_text().strip()
                        is_plugged = raw_status.lower() in ["charging", "full", "not charging"]
                        battery_info["power_plugged"] = is_plugged
                        if raw_status.lower() == "full" or (battery_info["percent"] and battery_info["percent"] >= 99):
                            battery_info["status"] = "AC Connected (100% Fully Charged)"
                        elif raw_status.lower() == "charging":
                            battery_info["status"] = "AC Connected (Charging)"
                        elif raw_status.lower() == "discharging":
                            battery_info["status"] = f"Discharging on Battery ({battery_info['percent']}%)"
                        else:
                            battery_info["status"] = raw_status
                        battery_info["power_source"] = "AC Power Adapter" if is_plugged else "Internal Battery Power"

                    volt_file = bat / "voltage_now"
                    if volt_file.exists():
                        try:
                            battery_info["voltage_v"] = round(float(volt_file.read_text().strip()) / 1_000_000.0, 2)
                        except Exception:
                            pass

                    pwr_file = bat / "power_now"
                    if pwr_file.exists():
                        try:
                            battery_info["power_w"] = round(float(pwr_file.read_text().strip()) / 1_000_000.0, 2)
                        except Exception:
                            pass

                    tech_file = bat / "technology"
                    if tech_file.exists():
                        battery_info["technology"] = tech_file.read_text().strip()

                    model_file = bat / "model_name"
                    if model_file.exists():
                        battery_info["model"] = model_file.read_text().strip()

                    cycle_file = bat / "cycle_count"
                    if cycle_file.exists():
                        try:
                            battery_info["cycle_count"] = int(cycle_file.read_text().strip())
                        except Exception:
                            pass

                    efull_file = bat / "energy_full"
                    edesign_file = bat / "energy_full_design"
                    if efull_file.exists() and edesign_file.exists():
                        try:
                            efull = float(efull_file.read_text().strip())
                            edesign = float(edesign_file.read_text().strip())
                            if edesign > 0:
                                battery_info["health_percent"] = round((efull / edesign) * 100.0, 1)
                        except Exception:
                            pass
                    break
        except Exception:
            pass

    # 2. Hardware Temperatures
    temperatures: List[Dict[str, Any]] = []
    primary_temp: Optional[float] = None

    try:
        if hasattr(psutil, "sensors_temperatures"):
            temp_dict = psutil.sensors_temperatures()
            if temp_dict:
                for sensor_name, entries in temp_dict.items():
                    for entry in entries:
                        label = entry.label or sensor_name
                        current = round(entry.current, 1) if entry.current is not None else None
                        high = round(entry.high, 1) if entry.high is not None else None
                        critical = round(entry.critical, 1) if entry.critical is not None else None
                        if current is not None:
                            temperatures.append({
                                "sensor": label,
                                "current": current,
                                "high": high,
                                "critical": critical
                            })
                            if primary_temp is None or any(k in label.lower() for k in ["package", "cpu", "core 0", "soc"]):
                                primary_temp = current
    except Exception:
        pass

    # Linux sysfs fallback
    if not temperatures and os.name != "nt":
        try:
            thermal_path = Path("/sys/class/thermal")
            if thermal_path.exists():
                for zone in thermal_path.glob("thermal_zone*"):
                    type_file = zone / "type"
                    temp_file = zone / "temp"
                    if temp_file.exists():
                        z_type = type_file.read_text().strip() if type_file.exists() else zone.name
                        raw_temp = float(temp_file.read_text().strip())
                        c_temp = round(raw_temp / 1000.0, 1) if raw_temp > 1000 else round(raw_temp, 1)
                        temperatures.append({
                            "sensor": z_type,
                            "current": c_temp,
                            "high": 85.0,
                            "critical": 100.0
                        })
                        if primary_temp is None:
                            primary_temp = c_temp
        except Exception:
            pass

    # 3. Host Device Details
    cpu_model = None
    if os.name != "nt":
        try:
            with open("/proc/cpuinfo", "r") as f:
                for line in f:
                    if "model name" in line:
                        cpu_model = line.split(":", 1)[1].strip()
                        break
        except Exception:
            pass
    if not cpu_model:
        cpu_model = platform.processor() or "Multi-Core Host Processor"

    device_info = {
        "hostname": socket.gethostname(),
        "platform": platform.system(),
        "os_release": platform.release(),
        "arch": platform.machine(),
        "cpu_model": cpu_model,
        "cpu_cores_physical": psutil.cpu_count(logical=False) or psutil.cpu_count(logical=True),
        "cpu_cores_logical": psutil.cpu_count(logical=True) or 4
    }

    return {
        "battery": battery_info,
        "temperatures": temperatures,
        "primary_temp": primary_temp,
        "device": device_info
    }

@router.get("/system")
def get_system_telemetry():
    """Returns real-time CPU, RAM, Disk, Network throughput, Battery, Temperature, and Hardware info."""
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

    hw = get_hardware_diagnostics()

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
        "network_recv_mbps": recv_mbps,
        "battery": hw["battery"],
        "temperatures": hw["temperatures"],
        "primary_temp": hw["primary_temp"],
        "device": hw["device"]
    }

@router.get("/devices")
def get_camera_devices():
    """Returns all real verified camera devices on the host."""
    devices = camera_manager.get_available_cameras()
    return {"devices": devices, "cameras": devices}

@router.get("/version")
def get_version_info():
    """Returns application version, Git commit hash, branch, and update status."""
    from ..services.updater import updater_service
    status = updater_service.get_status()
    check_info = status.get("check_info", {})
    return {
        "version": "2.1.0",
        "commit": updater_service.get_current_commit(),
        "branch": updater_service.get_current_branch(),
        "git_upgradable": True,
        "update_available": check_info.get("update_available", False),
        "latest_commit": check_info.get("latest_commit", ""),
        "latest_commit_message": check_info.get("latest_commit_message", ""),
        "last_checked": check_info.get("last_checked", 0)
    }

@router.get("/update/check")
def check_for_updates(force: bool = False):
    """Force or query an update check against GitHub."""
    from ..services.updater import updater_service
    return updater_service.check_for_updates(force=force)

@router.post("/update/apply")
def apply_update():
    """Trigger in-app git pull and service upgrade."""
    from ..services.updater import updater_service
    return updater_service.apply_update()

@router.get("/update/status")
def get_update_status():
    """Poll live update progress, status, and terminal log stream."""
    from ..services.updater import updater_service
    return updater_service.get_status()
