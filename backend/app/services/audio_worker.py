try:
    import sounddevice as sd
except Exception:
    sd = None

import numpy as np
import threading
import time
import asyncio
import logging
from typing import Set, Optional, List, Dict, Any

logger = logging.getLogger("audio_worker")

class AudioWorker:
    """Captures microphone audio using sounddevice and streams PCM chunks to WebSocket queues."""
    def __init__(self, sample_rate: int = 44100, channels: int = 1):
        self.sample_rate = sample_rate
        self.channels = channels
        self.stream: Optional[Any] = None
        self.is_running = False
        self.active_queues: Set[asyncio.Queue] = set()
        self.lock = threading.Lock()
        self.current_volume_rms = 0.0
        self.device_index: Optional[int] = None
        self.recorded_audio_chunks: List[np.ndarray] = []
        self.is_recording = False
        self.main_loop: Optional[asyncio.AbstractEventLoop] = None
        self.latest_raw_chunk: Optional[bytes] = None

    def set_loop(self, loop: asyncio.AbstractEventLoop):
        self.main_loop = loop

    def list_devices(self) -> List[Dict[str, Any]]:
        """Returns deduplicated, clean list of real microphone input devices."""
        devices = []
        seen_names = set()
        
        if sd is None:
            return [{"index": 0, "name": "Default Microphone", "channels": 1, "default_samplerate": 44100}]

        try:
            all_devs = sd.query_devices()
            host_apis = {idx: api['name'] for idx, api in enumerate(sd.query_hostapis())}
            
            # 1. Default system microphone
            try:
                def_in = sd.default.device[0]
                if def_in is not None and def_in >= 0:
                    dev = all_devs[def_in]
                    devices.append({
                        "index": def_in,
                        "name": "Default System Microphone",
                        "raw_name": dev.get('name', ''),
                        "channels": dev.get('max_input_channels', 1),
                        "default_samplerate": int(dev.get('default_samplerate') or 44100)
                    })
                    seen_names.add("default")
            except Exception:
                pass

            # 2. Iterate through devices preferring DirectSound, MME, WASAPI and filter out duplicate WDM-KS junk
            # Sort devices preferring DirectSound/WASAPI/MME
            def get_priority(dev):
                api = host_apis.get(dev.get('hostapi', -1), '')
                if 'DirectSound' in api: return 1
                if 'WASAPI' in api: return 2
                if 'MME' in api: return 3
                return 4

            sorted_indices = sorted(range(len(all_devs)), key=lambda i: get_priority(all_devs[i]))

            for dev_idx in sorted_indices:
                dev = all_devs[dev_idx]
                if dev.get('max_input_channels', 0) <= 0:
                    continue

                raw_name = dev.get('name', f'Microphone {dev_idx}')
                api_name = host_apis.get(dev.get('hostapi', -1), '')
                
                # Filter out raw internal Windows driver paths
                if '@System32' in raw_name or 'WDM-KS' in api_name:
                    continue
                if 'sound mapper' in raw_name.lower() or 'primary sound capture' in raw_name.lower():
                    continue

                # Clean friendly name
                clean_name = raw_name
                for prefix in ['Microphone (', 'Input (', 'Headset (', 'Mic (']:
                    if clean_name.startswith(prefix) and clean_name.endswith(')'):
                        clean_name = clean_name[len(prefix):-1]

                # Specific hardware naming
                norm_key = clean_name.strip().lower()
                if 'emeet' in norm_key:
                    clean_name = 'EMEET SmartCam C60E 4K Microphone'
                    norm_key = 'emeet'
                elif 'usbaudio2.0' in norm_key or 'usb audio 2.0' in norm_key:
                    clean_name = 'USB Audio 2.0 Microphone'
                    norm_key = 'usbaudio2.0'
                elif 'iriun' in norm_key:
                    clean_name = 'Iriun Webcam Microphone'
                    norm_key = 'iriun'
                elif 'realtek' in norm_key:
                    clean_name = 'Realtek High Definition Audio Mic'
                    norm_key = 'realtek'

                if norm_key in seen_names:
                    continue
                seen_names.add(norm_key)

                devices.append({
                    "index": dev_idx,
                    "name": clean_name,
                    "raw_name": raw_name,
                    "channels": dev.get('max_input_channels', 1),
                    "default_samplerate": int(dev.get('default_samplerate') or 44100)
                })

        except Exception as e:
            logger.error(f"Error querying audio devices: {e}")

        if not devices:
            devices = [{"index": 0, "name": "Default Microphone", "channels": 1, "default_samplerate": 44100}]

        return devices

    def start(self, device_index: Optional[int] = None):
        if self.is_running or sd is None:
            return

        self.device_index = device_index
        try:
            # Query device info for optimal sample rate and channel count
            dev_sr = 44100
            dev_ch = 1
            if self.device_index is not None:
                try:
                    dev_info = sd.query_devices(self.device_index)
                    dev_sr = int(dev_info.get('default_samplerate') or 44100)
                    dev_ch = min(2, dev_info.get('max_input_channels', 1))
                except Exception:
                    pass

            self.sample_rate = dev_sr
            self.channels = dev_ch

            self.stream = sd.InputStream(
                samplerate=self.sample_rate,
                channels=self.channels,
                dtype='int16',
                device=self.device_index,
                blocksize=1024,
                callback=self._audio_callback
            )
            self.stream.start()
            self.is_running = True
            logger.info(f"Audio capture started on device {self.device_index} ({self.sample_rate}Hz, {self.channels}ch)")
        except Exception as e:
            logger.error(f"Failed to start audio stream: {e}")
            self.is_running = False

    def switch_device(self, device_index: Optional[int]) -> Dict[str, Any]:
        """Switches the active microphone input device on the fly."""
        logger.info(f"Switching audio device to {device_index}")
        self.stop()
        time.sleep(0.15)
        self.start(device_index)
        return {
            "status": "success",
            "active_device": self.device_index,
            "sample_rate": self.sample_rate,
            "is_running": self.is_running
        }

    def _audio_callback(self, indata, frames, time_info, status):
        # Calculate volume level RMS for visualizer
        int_data = indata[:, 0] if self.channels == 1 else indata.mean(axis=1)
        rms = np.sqrt(np.mean(int_data.astype(float)**2))
        self.current_volume_rms = min(100.0, (rms / 32767.0) * 400.0)

        # Buffer for active manual recording
        if self.is_recording:
            self.recorded_audio_chunks.append(indata.copy())

        # If stereo, mix to mono int16 for lightweight browser streaming
        if self.channels > 1:
            mono_int16 = (indata.mean(axis=1)).astype(np.int16)
            raw_bytes = mono_int16.tobytes()
        else:
            raw_bytes = indata.tobytes()

        self.latest_raw_chunk = raw_bytes

        # Broadcast PCM bytes to active browser websocket queues
        if not self.main_loop or self.main_loop.is_closed():
            return

        with self.lock:
            for q in list(self.active_queues):
                try:
                    if q.full():
                        try:
                            q.get_nowait()
                        except Exception:
                            pass
                    self.main_loop.call_soon_threadsafe(q.put_nowait, raw_bytes)
                except Exception:
                    pass

    def register_queue(self, queue: asyncio.Queue):
        with self.lock:
            self.active_queues.add(queue)
        if not self.is_running:
            self.start(self.device_index)

    def unregister_queue(self, queue: asyncio.Queue):
        with self.lock:
            self.active_queues.discard(queue)

    def start_recording(self):
        self.recorded_audio_chunks = []
        self.is_recording = True

    def stop_recording(self) -> Optional[np.ndarray]:
        self.is_recording = False
        if self.recorded_audio_chunks:
            combined = np.concatenate(self.recorded_audio_chunks, axis=0)
            self.recorded_audio_chunks = []
            return combined
        return None

    def stop(self):
        self.is_running = False
        if self.stream:
            try:
                self.stream.stop()
                self.stream.close()
            except Exception:
                pass
            self.stream = None

audio_worker = AudioWorker()
