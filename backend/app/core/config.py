import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "CCTV 60FPS Proxmox Hub"
    API_PORT: int = int(os.getenv("PORT", "18860"))
    GO2RTC_API_URL: str = os.getenv("GO2RTC_API_URL", "http://127.0.0.1:18864")
    GO2RTC_STREAM_NAME: str = os.getenv("GO2RTC_STREAM_NAME", "webcam_60fps")
    
    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    RECORDINGS_DIR: Path = DATA_DIR / "recordings"
    SNAPSHOTS_DIR: Path = DATA_DIR / "snapshots"
    CONFIG_DIR: Path = DATA_DIR / "config"
    
    # Camera & Audio defaults
    DEFAULT_DEVICE: str = os.getenv("CAMERA_DEVICE", "0" if os.name == "nt" else "/dev/video0")
    DEFAULT_AUDIO_DEVICE: str = os.getenv("AUDIO_DEVICE", "default" if os.name != "nt" else "")
    ENABLE_AUDIO: bool = True
    DEFAULT_FPS: int = 60
    DEFAULT_WIDTH: int = 1280
    DEFAULT_HEIGHT: int = 720
    
    # Storage retention
    MAX_RECORDING_DAYS: int = 14
    MAX_STORAGE_PERCENT: int = 90
    
    # S3 Storage Configuration
    S3_ENABLED: bool = False
    S3_ENDPOINT_URL: str = ""
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_BUCKET_NAME: str = ""
    S3_REGION: str = "us-east-1"
    S3_AUTO_UPLOAD: bool = False
    
    # Samba / SMB Storage Configuration
    SAMBA_ENABLED: bool = False
    SAMBA_HOST: str = "" # e.g. 192.168.1.100 or truenas.local
    SAMBA_SHARE: str = "" # e.g. cctv_recordings
    SAMBA_USERNAME: str = ""
    SAMBA_PASSWORD: str = ""
    SAMBA_LOCAL_MOUNT_PATH: str = "" # e.g. /mnt/samba/cctv or \\NAS\cctv
    SAMBA_AUTO_SYNC: bool = False

    class Config:
        env_file = ".env"

settings = Settings()

# Ensure storage directories exist
settings.RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)
settings.SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)
settings.CONFIG_DIR.mkdir(parents=True, exist_ok=True)
