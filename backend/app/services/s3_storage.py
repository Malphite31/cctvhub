import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from ..core.config import settings

logger = logging.getLogger("s3_storage")
CONFIG_FILE = settings.CONFIG_DIR / "s3_config.json"

class S3StorageService:
    def __init__(self):
        self.config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        default = {
            "enabled": settings.S3_ENABLED,
            "endpoint_url": settings.S3_ENDPOINT_URL,
            "access_key": settings.S3_ACCESS_KEY,
            "secret_key": settings.S3_SECRET_KEY,
            "bucket_name": settings.S3_BUCKET_NAME,
            "region": settings.S3_REGION,
            "auto_upload": settings.S3_AUTO_UPLOAD,
        }
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r") as f:
                    saved = json.load(f)
                    default.update(saved)
            except Exception as e:
                logger.error(f"Failed to load S3 config: {e}")
        return default

    def save_config(self, new_config: Dict[str, Any]) -> Dict[str, Any]:
        cfg_copy = dict(new_config)
        if cfg_copy.get("secret_key") in ["••••••••", "••••"]:
            cfg_copy["secret_key"] = self.config.get("secret_key", "")
        self.config.update(cfg_copy)
        try:
            with open(CONFIG_FILE, "w") as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save S3 config: {e}")
        return self.get_config()

    def get_config(self) -> Dict[str, Any]:
        masked = dict(self.config)
        if masked.get("secret_key"):
            masked["secret_key"] = "••••••••" if len(masked["secret_key"]) > 4 else "••••"
        return masked

    def _get_client(self, override_config: Optional[Dict[str, Any]] = None):
        cfg = dict(override_config or self.config)
        if cfg.get("secret_key") in ["••••••••", "••••"]:
            cfg["secret_key"] = self.config.get("secret_key", "")

        endpoint = cfg.get("endpoint_url") or None
        region = cfg.get("region") or "us-east-1"
        
        session = boto3.session.Session()
        return session.client(
            "s3",
            region_name=region,
            endpoint_url=endpoint,
            aws_access_key_id=cfg.get("access_key"),
            aws_secret_access_key=cfg.get("secret_key"),
            config=Config(signature_version="s3v4", s3={"addressing_style": "auto"})
        )

    def test_connection(self, config_to_test: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        cfg = dict(config_to_test or self.config)
        if cfg.get("secret_key") in ["••••••••", "••••"]:
            cfg["secret_key"] = self.config.get("secret_key", "")

        bucket = cfg.get("bucket_name")
        if not bucket or not cfg.get("access_key") or not cfg.get("secret_key"):
            return {"success": False, "error": "Missing bucket name or access/secret credentials"}

        try:
            client = self._get_client(cfg)
            client.head_bucket(Bucket=bucket)
            return {"success": True, "message": f"Successfully connected to S3 bucket '{bucket}'!"}
        except ClientError as e:
            return {"success": False, "error": str(e)}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def upload_file(self, file_path: Path, remote_key: Optional[str] = None) -> Dict[str, Any]:
        if not self.config.get("enabled"):
            return {"success": False, "error": "S3 storage is disabled"}

        if not file_path.exists():
            return {"success": False, "error": "Local file not found"}

        bucket = self.config.get("bucket_name")
        key = remote_key or f"cctv/{file_path.name}"

        try:
            client = self._get_client()
            content_type = "video/mp4" if file_path.suffix == ".mp4" else "image/jpeg"
            
            client.upload_file(
                str(file_path),
                bucket,
                key,
                ExtraArgs={"ContentType": content_type}
            )
            return {"success": True, "bucket": bucket, "key": key}
        except Exception as e:
            logger.error(f"S3 Upload failed for {file_path.name}: {e}")
            return {"success": False, "error": str(e)}

s3_storage = S3StorageService()
