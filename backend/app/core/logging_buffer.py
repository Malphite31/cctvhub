import collections
import logging
import time
from typing import List, Dict, Any, Optional

class RingBufferLogHandler(logging.Handler):
    def __init__(self, capacity: int = 1000):
        super().__init__()
        self.buffer = collections.deque(maxlen=capacity)
        self.setFormatter(logging.Formatter("[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S"))

    def emit(self, record: logging.LogRecord):
        try:
            msg = self.format(record)
            self.buffer.append({
                "timestamp": record.created,
                "time_str": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(record.created)),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
                "raw": msg
            })
        except Exception:
            pass

    def get_logs(self, limit: int = 250, level: Optional[str] = None) -> List[Dict[str, Any]]:
        logs = list(self.buffer)
        if level and level.upper() != "ALL":
            target = level.upper()
            logs = [l for l in logs if l["level"].upper() == target]
        return logs[-limit:]

    def clear(self):
        self.buffer.clear()

log_buffer = RingBufferLogHandler(capacity=1000)

# Attach to root logger
root_logger = logging.getLogger()
if log_buffer not in root_logger.handlers:
    root_logger.addHandler(log_buffer)
